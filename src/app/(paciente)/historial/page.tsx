import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
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
};

/**
 * Historial de la paciente (WP-24 §C.3): lista cronológica de check-ins y
 * consultas, paginada. La RLS `checkins_select_propio` / `mensajes_select_propio`
 * (0002) hace trivial la lectura: el cliente de servidor con su sesión solo ve
 * SUS filas (mismo patrón que la línea temporal del panel, versión paciente).
 * Nunca lanza: ante fallo devuelve vacío y la UI muestra un estado amable.
 */
async function cargarHistorial(pagina: number): Promise<DatosHistorial> {
  const vacio: DatosHistorial = { sesiones: [], pagina: 1, totalPaginas: 1 };
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return vacio;

    const desde = (pagina - 1) * POR_PAGINA;
    const {
      data: checkins,
      count,
    } = await supabase
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
      return { sesiones: [], pagina, totalPaginas };
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
        tipo: c.tipo,
        canal: c.canal,
        estado: c.estado,
        riesgo: c.riesgo,
        resumen: c.resumen,
        mensajes: porCheckin.get(c.id) ?? [],
      })),
      pagina,
      totalPaginas,
    };
  } catch {
    return vacio;
  }
}

function fechaLegible(fecha: string): string {
  try {
    return format(parseISO(fecha), "EEEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return fecha;
  }
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
  return (
    <details className="group rounded-[var(--radius-lg)] border border-borde bg-superficie">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-2 p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
              esConsulta
                ? "bg-primario-suave text-primario"
                : "bg-acento-suave text-acento-fuerte"
            }`}
          >
            {esConsulta ? "Conversación" : "Check-in"}
          </span>
          {sesion.canal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-superficie-suave px-3 py-1 text-sm font-medium text-texto-suave">
              {sesion.canal === "voz" ? (
                <Mic className="h-4 w-4" aria-hidden />
              ) : (
                <MessagesSquare className="h-4 w-4" aria-hidden />
              )}
              {sesion.canal === "voz" ? "Voz" : "Texto"}
            </span>
          )}
          {sesion.estado === "en_curso" && (
            <span className="inline-flex items-center rounded-full bg-superficie-suave px-3 py-1 text-sm font-medium text-texto-tenue">
              Sin terminar
            </span>
          )}
          {sesion.riesgo && <BadgeRiesgo nivel={sesion.riesgo} />}
        </div>
        <p className="text-base font-semibold capitalize text-texto">
          {fechaLegible(sesion.fecha)}
        </p>
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
      <div className="flex flex-col gap-3 border-t border-borde p-5">
        {sesion.mensajes.length === 0 ? (
          <p className="text-base text-texto-tenue">
            No hay mensajes guardados de esta conversación.
          </p>
        ) : (
          sesion.mensajes.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.rol === "asistente" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-4 py-3 text-base leading-relaxed ${
                  m.rol === "asistente"
                    ? "bg-superficie-suave text-texto"
                    : "bg-primario text-white"
                }`}
              >
                <span className="sr-only">
                  {m.rol === "asistente" ? "Botsy: " : "Tú: "}
                </span>
                {m.contenido}
              </div>
            </div>
          ))
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

  const { sesiones, totalPaginas } = await cargarHistorial(pagina);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Tu historial"
        descripcion="Aquí están tus check-ins y conversaciones con Botsy, de la más reciente a la más antigua."
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
          <section aria-label="Conversaciones" className="flex flex-col gap-4">
            {sesiones.map((s) => (
              <TarjetaSesion key={s.id} sesion={s} />
            ))}
          </section>

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
