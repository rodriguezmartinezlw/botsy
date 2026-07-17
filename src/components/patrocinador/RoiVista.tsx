import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { HeartPulse } from "lucide-react";
import type { MetricasRoi } from "@/lib/patrocinador/roi";
import TarjetaKpi from "./TarjetaKpi";

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

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="informe-seccion flex flex-col gap-3">
      <h2 className="border-b border-borde pb-1 text-lg font-bold text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Documento imprimible del informe ROI pagador (WP-15). Solo cifras REALES
 * calculadas en `calcularRoi` (sin ML ni proyección — regla de oro 4), con las
 * definiciones metodológicas al pie (incluida la honestidad del proxy de
 * "urgencias evitadas"). Respeta el k-anonimato: cohorte < 5 => sin cifras.
 */
export default function RoiVista({
  patrocinador,
  roi,
  hoy,
}: {
  patrocinador: string;
  roi: MetricasRoi;
  hoy: string;
}) {
  return (
    <article className="informe-doc flex flex-col gap-6 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6 md:p-8">
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
            <span className="text-sm text-texto-tenue">· Informe ROI · Pagador</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-texto">{patrocinador}</h1>
          <p className="text-base text-texto-suave">
            Cohorte agregada y pseudonimizada · métricas de datos ya capturados
          </p>
        </div>
        <div className="text-sm text-texto-suave sm:text-right">
          <p className="font-semibold text-texto">Generado</p>
          <p>{fechaLarga(hoy)}</p>
        </div>
      </header>

      {!roi.suficiente ? (
        <Seccion titulo="Datos insuficientes">
          <p className="text-base text-texto-suave">
            La cohorte tiene menos de 5 pacientes. Por privacidad (k-anonimato ≥ 5)
            no se reportan cifras.
          </p>
        </Seccion>
      ) : (
        <>
          <Seccion titulo="Indicadores clave">
            <div className="flex flex-wrap gap-3">
              <TarjetaKpi
                etiqueta="Urgencias evitadas / 100 pacientes-mes"
                valor={num(roi.urgenciasEvitadas100)}
                nota={`proxy · ${roi.urgenciasEvitadas} eventos resueltos sin evento · ${roi.pacientesMes} pacientes-mes`}
              />
              <TarjetaKpi
                etiqueta="Tasa de respuesta al check-in"
                valor={num(roi.tasaCheckin)}
                sufijo="%"
                nota="benchmark Noona 90% (formularios)"
              />
              <TarjetaKpi
                etiqueta="Persistencia en tratamiento"
                valor={num(roi.persistenciaPct)}
                sufijo="%"
                nota="pautas aún activas al cierre"
              />
            </div>
          </Seccion>

          <Seccion titulo="Tiempo de escalado (señal → decisión clínica)">
            <div className="flex flex-wrap gap-3">
              <TarjetaKpi
                etiqueta="Señal → alerta (mediana)"
                valor={num(roi.horasSenalAlerta)}
                sufijo=" h"
              />
              <TarjetaKpi
                etiqueta="Alerta → disposición (mediana)"
                valor={num(roi.horasAlertaDisposicion)}
                sufijo=" h"
              />
              <TarjetaKpi etiqueta="Pacientes en la cohorte" valor={String(roi.n)} />
            </div>
          </Seccion>

          <Seccion titulo="Resumen de cifras">
            <table className="w-full border-collapse text-left text-sm">
              <tbody>
                {[
                  ["Pacientes (n)", String(roi.n)],
                  ["Pacientes-mes observados", num(roi.pacientesMes)],
                  ["Eventos resueltos sin evento (proxy urgencias evitadas)", String(roi.urgenciasEvitadas)],
                  ["Urgencias evitadas / 100 pacientes-mes", num(roi.urgenciasEvitadas100)],
                  ["Tasa de respuesta al check-in (30 días)", num(roi.tasaCheckin, "%")],
                  ["Persistencia (pautas activas)", num(roi.persistenciaPct, "%")],
                  ["Tiempo señal → alerta (mediana)", num(roi.horasSenalAlerta, " h")],
                  ["Tiempo alerta → disposición (mediana)", num(roi.horasAlertaDisposicion, " h")],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-borde/60">
                    <td className="py-1.5 text-texto">{k}</td>
                    <td className="py-1.5 text-right font-semibold text-texto">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        </>
      )}

      {/* Definiciones metodológicas (al pie, siempre) */}
      <Seccion titulo="Definiciones metodológicas">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-texto-suave">
          <li>
            <span className="font-semibold text-texto">Pacientes-mes:</span> suma
            por paciente de los días observados (primer a último check-in) dividida
            entre 30.
          </li>
          <li>
            <span className="font-semibold text-texto">Urgencias evitadas (proxy v1, honesto):</span>{" "}
            número de alertas de nivel «contactar» o «urgencia» cuya disposición se
            cerró con desenlace «resuelto sin evento». <em>No es una medición de
            urgencias realmente evitadas</em>: es un proxy conservador de episodios
            gestionados por el equipo clínico sin que escalaran a urgencias u
            hospitalización. Se reporta como proxy, no como resultado clínico.
            La definición del proxy es ajustable con cada pagador.
          </li>
          <li>
            <span className="font-semibold text-texto">Tiempo hasta escalado:</span>{" "}
            mediana de horas entre la señal (check-in) y la alerta, y entre la
            alerta y su disposición estructurada.
          </li>
          <li>
            <span className="font-semibold text-texto">Tasa de respuesta al check-in:</span>{" "}
            días con check-in completado dividido entre (pacientes × 30) en los
            últimos 30 días. Referencia externa: 90 % de Noona con formularios.
          </li>
          <li>
            <span className="font-semibold text-texto">Persistencia:</span> porcentaje
            de pautas que siguen activas (no discontinuadas) al cierre del período.
          </li>
        </ul>
      </Seccion>

      <footer className="mt-2 flex flex-col gap-1 border-t border-borde pt-4 text-sm text-texto-tenue">
        <p className="font-medium">
          v1 reporta lo observado: sin aprendizaje automático, sin proyecciones y
          sin sugerencias terapéuticas. Todas las cifras proceden de datos ya
          capturados.
        </p>
        <p>
          Datos agregados y pseudonimizados con k-anonimato ≥ 5.
          Documento de apoyo a la evaluación del pagador; no constituye diagnóstico
          ni predicción.
        </p>
      </footer>
    </article>
  );
}
