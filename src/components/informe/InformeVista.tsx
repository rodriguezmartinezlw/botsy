import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { HeartPulse } from "lucide-react";
import PuntosAdherencia from "@/components/graficos/PuntosAdherencia";
import BadgeNivel from "@/components/panel/BadgeNivel";
import EvidenciaAlerta from "@/components/panel/EvidenciaAlerta";
import type { DatosInforme } from "@/lib/informes/tipos";
import type { ResultadoResumen } from "@/lib/informes/resumen";
import type { EstadoAlerta, TipoConsentimiento, VerticalPaciente } from "@/types/db";
import MiniSparkline from "./MiniSparkline";

const ETIQUETA_VERTICAL: Record<VerticalPaciente, string> = {
  cardiovascular: "Cardiovascular",
  cronica: "Crónica",
  geriatrica: "Geriátrica",
  mental: "Salud mental",
  ocupacional: "Ocupacional",
  general: "General",
};

const ETIQUETA_ESTADO_ALERTA: Record<EstadoAlerta, string> = {
  nueva: "Nueva (sin gestionar)",
  vista: "Vista",
  resuelta: "Resuelta",
  descartada: "Descartada",
};

const ETIQUETA_CONSENT: Record<TipoConsentimiento, string> = {
  conversacion: "Registro de conversaciones",
  voz_grabacion: "Grabación de voz",
  voz_biomarcadores: "Biomarcadores de voz",
};

function fechaLarga(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return iso;
  }
}

function num(v: number | null, sufijo = ""): string {
  return v === null ? "—" : `${v}${sufijo}`;
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="informe-seccion flex flex-col gap-3">
      <h2 className="border-b border-borde pb-1 text-lg font-bold text-texto">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Documento del informe de seguimiento (WP-07). Server Component presentacional:
 * cabecera con marca + datos + período, resumen ejecutivo (o aviso si falló el
 * LLM), tablas/gráficos de dolor/ánimo/adherencia, alertas y observaciones, y
 * pie con el disclaimer clínico. Optimizado para impresión (ver `@media print`).
 */
export default function InformeVista({
  datos,
  resumen,
  fechaGeneracion,
}: {
  datos: DatosInforme;
  resumen: ResultadoResumen;
  fechaGeneracion: string;
}) {
  const { paciente, periodo } = datos;
  const datosPaciente = [
    paciente.edad !== null ? `${paciente.edad} años` : null,
    paciente.sexo,
    ETIQUETA_VERTICAL[paciente.vertical],
  ].filter((x): x is string => Boolean(x));

  return (
    <article className="informe-doc flex flex-col gap-6 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6 md:p-8">
      {/* Cabecera */}
      <header className="flex flex-col gap-4 border-b-2 border-primario pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-primario text-white"
            >
              <HeartPulse className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="text-xl font-bold text-texto">Botsy</span>
            <span className="text-sm text-texto-tenue">
              · Informe de seguimiento
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-texto">
            {paciente.nombre}
          </h1>
          <p className="text-base text-texto-suave">{datosPaciente.join(" · ")}</p>
          {paciente.condiciones.length > 0 ? (
            <p className="text-sm text-texto-suave">
              Condiciones: {paciente.condiciones.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="text-sm text-texto-suave sm:text-right">
          <p className="font-semibold text-texto">Período</p>
          <p>
            {fechaLarga(periodo.desde)} — {fechaLarga(periodo.hasta)}
          </p>
          <p className="text-texto-tenue">
            {periodo.dias} días · {datos.totalCheckins} check-ins
          </p>
        </div>
      </header>

      {/* Resumen ejecutivo */}
      <Seccion titulo="Resumen ejecutivo">
        {resumen.estado === "ok" ? (
          <p className="text-base leading-relaxed text-texto">{resumen.resumen}</p>
        ) : (
          <p className="rounded-[var(--radius-md)] border border-borde bg-superficie-suave px-4 py-3 text-base text-texto-suave">
            {resumen.motivo === "sin_datos"
              ? "No hay datos suficientes en el período para redactar un resumen."
              : "No se pudo generar el resumen ejecutivo automático en este momento. El resto del informe se ha generado con normalidad; los datos siguientes son completos."}
          </p>
        )}
      </Seccion>

      {/* Dolor */}
      <Seccion titulo="Dolor">
        {datos.dolor.registros > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <Metrica etiqueta="Media" valor={num(datos.dolor.media, "/10")} />
              <Metrica etiqueta="Máximo" valor={num(datos.dolor.pico, "/10")} />
              <Metrica etiqueta="Mínimo" valor={num(datos.dolor.minimo, "/10")} />
              <Metrica
                etiqueta="Días con registro"
                valor={String(datos.dolor.registros)}
              />
            </div>
            <MiniSparkline serie={datos.dolor.serie} maxY={10} color="#2563eb" />
          </div>
        ) : (
          <p className="text-base text-texto-suave">
            Sin registros de dolor en el período.
          </p>
        )}
      </Seccion>

      {/* Ánimo / ansiedad / estrés */}
      <Seccion titulo="Ánimo, ansiedad y estrés">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-borde text-texto-tenue">
              <th className="py-1.5 font-semibold">Dominio</th>
              <th className="py-1.5 font-semibold">Media (0–10)</th>
              <th className="py-1.5 font-semibold">Días con registro</th>
            </tr>
          </thead>
          <tbody>
            {[
              { clave: "animo", etiqueta: "Ánimo" },
              { clave: "ansiedad", etiqueta: "Ansiedad" },
              { clave: "estres", etiqueta: "Estrés" },
            ].map(({ clave, etiqueta }) => {
              const m = datos.animo[clave as keyof typeof datos.animo];
              return (
                <tr key={clave} className="border-b border-borde/60">
                  <td className="py-1.5 text-texto">{etiqueta}</td>
                  <td className="py-1.5 text-texto-suave">{num(m.media)}</td>
                  <td className="py-1.5 text-texto-suave">{m.registros}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Seccion>

      {/* Adherencia por fármaco */}
      <Seccion titulo="Adherencia a la medicación">
        {datos.adherencia.farmacos.length > 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-texto-suave">
              Adherencia global del período:{" "}
              <span className="font-semibold text-texto">
                {num(datos.adherencia.global.porcentaje, "%")}
              </span>{" "}
              ({datos.adherencia.global.tomadas} tomadas ·{" "}
              {datos.adherencia.global.omitidas} omitidas)
            </p>
            <div className="flex flex-col gap-4">
              {datos.adherencia.farmacos.map((f) => (
                <div
                  key={f.farmaco}
                  className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-borde p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-base font-semibold text-texto">
                      {f.farmaco}
                      {f.dosis ? (
                        <span className="text-texto-tenue"> · {f.dosis}</span>
                      ) : null}
                      {f.critica ? (
                        <span className="ml-2 rounded-full bg-primario-suave px-2 py-0.5 text-xs font-semibold text-primario">
                          Importante
                        </span>
                      ) : null}
                    </span>
                    <span className="text-sm text-texto-suave">
                      {num(f.porcentaje, "%")} · {f.tomadas} tomadas /{" "}
                      {f.omitidas} omitidas
                    </span>
                  </div>
                  <PuntosAdherencia dias={f.semana} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-base text-texto-suave">
            No hay pautas de medicación activas con registro en el período.
          </p>
        )}
      </Seccion>

      {/* Alertas */}
      <Seccion titulo={`Alertas del período (${datos.alertas.length})`}>
        {datos.alertas.length > 0 ? (
          <ul className="flex flex-col gap-3" role="list">
            {datos.alertas.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-borde p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-base font-semibold text-texto">
                    {a.motivo}
                    <BadgeNivel nivel={a.nivel} />
                  </span>
                  <span className="text-sm text-texto-tenue">
                    {fechaLarga(a.creadoEn.slice(0, 10))}
                  </span>
                </div>
                <p className="text-sm text-texto-suave">
                  Estado: {ETIQUETA_ESTADO_ALERTA[a.estado]}
                  {a.gestionadaEn
                    ? ` · gestionada el ${fechaLarga(a.gestionadaEn.slice(0, 10))}`
                    : ""}
                  {a.motivoDescarte ? ` · motivo: ${a.motivoDescarte}` : ""}
                </p>
                <EvidenciaAlerta evidencia={a.evidencia} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-texto-suave">
            No se generaron alertas en el período.
          </p>
        )}
      </Seccion>

      {/* Observaciones destacadas */}
      <Seccion titulo="Observaciones destacadas">
        {datos.sintomas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {datos.sintomas.map((s) => (
              <span
                key={s.codigo}
                className="rounded-full bg-superficie-suave px-3 py-1 text-sm text-texto-suave"
              >
                {s.codigo} ({s.recuento})
              </span>
            ))}
          </div>
        ) : null}
        {datos.observaciones.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5" role="list">
            {datos.observaciones.map((o, i) => (
              <li key={i} className="text-sm text-texto-suave">
                <span className="text-texto-tenue">
                  {fechaLarga(o.fecha)} · {o.dominio}:
                </span>{" "}
                {o.texto}
              </li>
            ))}
          </ul>
        ) : datos.sintomas.length === 0 ? (
          <p className="text-base text-texto-suave">
            Sin observaciones destacadas en el período.
          </p>
        ) : null}
      </Seccion>

      {/* Consentimientos vigentes (solo lectura) */}
      <Seccion titulo="Consentimientos vigentes">
        <ul className="flex flex-col gap-1.5" role="list">
          {datos.consentimientos.map((c) => (
            <li
              key={c.tipo}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-texto">{ETIQUETA_CONSENT[c.tipo]}</span>
              <span
                className={`font-medium ${c.otorgado ? "text-acento-fuerte" : "text-texto-tenue"}`}
              >
                {c.otorgado ? "Otorgado" : "No otorgado"}
              </span>
            </li>
          ))}
        </ul>
      </Seccion>

      {/* Pie */}
      <footer className="mt-2 flex flex-col gap-1 border-t border-borde pt-4 text-sm text-texto-tenue">
        <p className="font-medium">
          Documento de seguimiento generado por Botsy. No constituye diagnóstico.
        </p>
        <p>
          [PENDIENTE LEGAL] Documento de apoyo al seguimiento clínico; no
          sustituye el juicio profesional. Contiene datos de salud: trátese de
          forma confidencial conforme al RGPD.
        </p>
        <p>Generado el {fechaLarga(fechaGeneracion.slice(0, 10))}.</p>
      </footer>
    </article>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-texto-tenue">{etiqueta}</span>
      <span className="text-lg font-bold text-texto">{valor}</span>
    </div>
  );
}
