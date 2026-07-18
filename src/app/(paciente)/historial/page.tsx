import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronDown,
  History,
  MessagesSquare,
  Mic,
  PhoneCall,
} from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";
import type {
  CanalCheckin,
  EstadoCheckin,
  NivelRiesgo,
  RolMensaje,
  TipoCheckin,
} from "@/types/db";

export const metadata: Metadata = { title: "Historial" };

const POR_PAGINA = 10;

type SesionHistorial = {
  id: string;
  fecha: string;
  hora: string;
  tipo: TipoCheckin;
  canal: CanalCheckin | null;
  estado: EstadoCheckin;
  riesgo: NivelRiesgo | null;
  resumen: string | null;
  mensajes: { rol: RolMensaje; contenido: string }[];
};

type DatosHistorial = {
  sesiones: SesionHistorial[];
  pagina: number;
  totalPaginas: number;
  hoy: string;
};

/**
 * Historial de la paciente (WP-24 §C.3 + rediseño 2026-07-18): lista cronológica
 * de check-ins y consultas, AGRUPADA por día (Hoy / Ayer / fecha), paginada. La
 * RLS `checkins_select_propio` / `mensajes_select_propio` (0002) hace trivial la
 * lectura: el cliente de servidor con su sesión solo ve SUS filas. Nunca lanza:
 * ante fallo devuelve vacío y la UI muestra un estado amable.
 */
async function cargarHistorial(pagina: number): Promise<DatosHistorial> {
  const vacio: DatosHistorial = {
    sesiones: [],
    pagina: 1,
    totalPaginas: 1,
    hoy: "",
  };
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return vacio;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("zona_horaria")
      .eq("id", user.id)
      .maybeSingle();
    const zona = perfil?.zona_horaria ?? "Europe/Madrid";
    const hoy = fechaHoyEnZona(zona);

    const desde = (pagina - 1) * POR_PAGINA;
    const { data: checkins, count } = await supabase
      .from("checkins")
      .select("id, fecha, tipo, canal, estado, riesgo, resumen, creado_en", {
        count: "exact",
      })
      .eq("paciente_id", user.id)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);

    const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
    if (!checkins || checkins.length === 0) {
      return { sesiones: [], pagina, totalPaginas, hoy };
    }

    // Transcripts de la página actual (RLS: solo los propios).
    const ids = checkins.map((c) => c.id);
    const { data: mensajes } = await supabase
      .from("mensajes")
      .select("checkin_id, rol, contenido, orden")
      .in("checkin_id", ids)
      .order("orden", { ascending: true });
    const porCheckin = new Map<string, { rol: RolMensaje; contenido: string }[]>();
    for (const m of mensajes ?? []) {
      const lista = porCheckin.get(m.checkin_id) ?? [];
      lista.push({ rol: m.rol, contenido: m.contenido });
      porCheckin.set(m.checkin_id, lista);
    }

    return {
      sesiones: checkins.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        hora: horaLegible(c.creado_en),
        tipo: c.tipo,
        canal: c.canal,
        estado: c.estado,
        riesgo: c.riesgo,
        resumen: c.resumen,
        mensajes: porCheckin.get(c.id) ?? [],
      })),
      pagina,
      totalPaginas,
      hoy,
    };
  } catch {
    return vacio;
  }
}

function horaLegible(creadoEn: string | null): string {
  if (!creadoEn) return "";
  try {
    return format(parseISO(creadoEn), "HH:mm");
  } catch {
    return "";
  }
}

/** Encabezado amable de cada grupo diario: "Hoy", "Ayer" o la fecha completa. */
function etiquetaDia(fecha: string, hoy: string): string {
  if (hoy && fecha === hoy) return "Hoy";
  try {
    if (hoy && fecha === format(subDays(parseISO(hoy), 1), "yyyy-MM-dd")) {
      return "Ayer";
    }
    return format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return fecha;
  }
}

type GrupoDia = { fecha: string; etiqueta: string; sesiones: SesionHistorial[] };

/** Agrupa la lista (ya ordenada por fecha desc) en bloques por día. */
function agruparPorDia(sesiones: SesionHistorial[], hoy: string): GrupoDia[] {
  const grupos: GrupoDia[] = [];
  for (const s of sesiones) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fecha === s.fecha) {
      ultimo.sesiones.push(s);
    } else {
      grupos.push({
        fecha: s.fecha,
        etiqueta: etiquetaDia(s.fecha, hoy),
        sesiones: [s],
      });
    }
  }
  return grupos;
}

/** Badge de riesgo: misma paleta calmada que el chat (señal, no diagnóstico). */
function BadgeRiesgo({ nivel }: { nivel: NivelRiesgo }) {
  if (nivel === "normal") return null;
  const color =
    nivel === "urgencia" ? "var(--color-urgencia)" : "var(--color-vigilancia)";
  const etiqueta =
    nivel === "urgencia"
      ? "Señal: atender pronto"
      : nivel === "contactar"
        ? "Señal: contactar con tu médico"
        : "Señal en vigilancia";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border-2 bg-superficie px-3 py-1 text-sm font-semibold"
      style={{ borderColor: color, color: "var(--color-texto)" }}
    >
      <PhoneCall className="h-4 w-4" aria-hidden style={{ color }} />
      {etiqueta}
    </span>
  );
}

function TarjetaSesion({ sesion }: { sesion: SesionHistorial }) {
  const esConsulta = sesion.tipo === "consulta";
  const esVoz = sesion.canal === "voz";
  // Acento por tipo (calmado): consulta = azul de marca, check-in = verde salud.
  const acento = esConsulta ? "var(--color-primario)" : "var(--color-acento-fuerte)";
  const titulo = esConsulta ? "Consulta" : "Check-in diario";
  const Canal = esVoz ? Mic : MessagesSquare;

  return (
    <details
      className="group overflow-hidden rounded-[var(--radius-lg)] border border-borde bg-superficie"
      style={{ borderLeftWidth: "4px", borderLeftColor: acento }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-2 p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-superficie-suave)", color: acento }}
          >
            <Canal className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-semibold text-texto">{titulo}</span>
            <span className="text-sm text-texto-suave">
              {esVoz ? "Por voz" : "Por escrito"}
              {sesion.hora ? ` · ${sesion.hora}` : ""}
            </span>
          </div>
        </div>

        {(sesion.estado === "en_curso" || sesion.riesgo) && (
          <div className="flex flex-wrap items-center gap-2">
            {sesion.estado === "en_curso" && (
              <span className="inline-flex items-center rounded-full bg-superficie-suave px-3 py-1 text-sm font-medium text-texto-tenue">
                Sin terminar
              </span>
            )}
            {sesion.riesgo && <BadgeRiesgo nivel={sesion.riesgo} />}
          </div>
        )}

        {sesion.resumen && (
          <p className="text-base leading-relaxed text-texto-suave">
            {sesion.resumen}
          </p>
        )}

        <span className="flex items-center gap-1 text-base font-semibold text-primario">
          <ChevronDown
            className="h-5 w-5 transition-transform group-open:rotate-180"
            aria-hidden
          />
          <span className="group-open:hidden">Ver la conversación</span>
          <span className="hidden group-open:inline">Ocultar la conversación</span>
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-borde p-5">
        {sesion.mensajes.length === 0 ? (
          <p className="text-base text-texto-tenue">
            No hay mensajes guardados de esta conversación.
          </p>
        ) : (
          sesion.mensajes.map((m, i) => {
            const esBotsy = m.rol === "asistente";
            return (
              <div
                key={i}
                className={`flex flex-col gap-1 ${esBotsy ? "items-start" : "items-end"}`}
              >
                <span className="px-1 text-sm font-semibold text-texto-tenue">
                  {esBotsy ? "Botsy" : "Tú"}
                </span>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-4 py-3 text-base leading-relaxed ${
                    esBotsy
                      ? "bg-superficie-suave text-texto"
                      : "bg-primario text-white"
                  }`}
                >
                  {m.contenido}
                </div>
              </div>
            );
          })
        )}
      </div>
    </details>
  );
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const sp = await searchParams;
  const paginaPedida = Number.parseInt(sp.pagina ?? "1", 10);
  const pagina =
    Number.isFinite(paginaPedida) && paginaPedida >= 1 ? paginaPedida : 1;

  const { sesiones, totalPaginas, hoy } = await cargarHistorial(pagina);
  const grupos = agruparPorDia(sesiones, hoy);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Tu historial"
        descripcion="Tus check-ins y conversaciones con Botsy, de lo más reciente a lo más antiguo."
        icono={<History className="h-6 w-6" aria-hidden />}
      />

      {sesiones.length === 0 ? (
        <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6">
          <p className="text-base text-texto-suave">
            Todavía no hay conversaciones guardadas. Cuando hagas tu check-in o
            hables conmigo, aparecerán aquí.
          </p>
          <Link
            href="/inicio"
            className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-base font-semibold text-white transition-colors hover:bg-primario-fuerte"
          >
            Volver al inicio
          </Link>
        </div>
      ) : (
        <>
          {grupos.map((grupo) => (
            <section
              key={grupo.fecha}
              aria-label={grupo.etiqueta}
              className="flex flex-col gap-3"
            >
              <h2 className="text-lg font-bold capitalize text-texto">
                {grupo.etiqueta}
              </h2>
              {grupo.sesiones.map((s) => (
                <TarjetaSesion key={s.id} sesion={s} />
              ))}
            </section>
          ))}

          {/* Paginación (targets grandes, perfil geriátrico) */}
          {totalPaginas > 1 && (
            <nav
              aria-label="Páginas del historial"
              className="flex items-center justify-between gap-3"
            >
              {pagina > 1 ? (
                <Link
                  href={`/historial?pagina=${pagina - 1}`}
                  className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-4 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
                >
                  Más recientes
                </Link>
              ) : (
                <span aria-hidden className="flex-1" />
              )}
              <span className="text-base font-medium text-texto-suave">
                {pagina} de {totalPaginas}
              </span>
              {pagina < totalPaginas ? (
                <Link
                  href={`/historial?pagina=${pagina + 1}`}
                  className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-4 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
                >
                  Más antiguas
                </Link>
              ) : (
                <span aria-hidden className="flex-1" />
              )}
            </nav>
          )}
        </>
      )}

      <p className="text-sm text-texto-tenue">
        Botsy no diagnostica ni sustituye a tu médico.
      </p>
    </div>
  );
}
