"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Pause, Play } from "lucide-react";
import {
  asignarPrograma,
  suspenderPrograma,
  reactivarPrograma,
  actualizarOverrideModulo,
} from "@/app/(panel)/pacientes/[id]/programa-acciones";
import type {
  ProgramaPacienteVista,
  ResultadoAccion,
} from "@/lib/panel/tipos";

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: "Activo",
  suspendido: "Suspendido",
  completado: "Completado",
};

/**
 * Pestaña "Programa" de la ficha 360º (WP-11 v2 §A.5). Asignar plantilla, ver la
 * config efectiva en lenguaje humano (SIN JSON), ajustar overrides de módulo con
 * toggles y suspender/reactivar. Toda mutación pasa por Server Actions auditadas.
 */
export default function PanelPrograma({
  pacienteId,
  programa,
}: {
  pacienteId: string;
  programa: ProgramaPacienteVista;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [plantillaSel, setPlantillaSel] = useState<string>(
    programa.plantillas[0]?.clave ?? "",
  );
  const [enviando, iniciar] = useTransition();

  function ejecutar(promesa: Promise<ResultadoAccion>) {
    setError(null);
    iniciar(async () => {
      const r = await promesa;
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const tieneAsignacion = programa.asignacionId !== null;
  const estaActivo = programa.estado === "activo";

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="text-base font-medium text-[#b91c1c]">
          {error}
        </p>
      ) : null}

      {/* Programa asignado */}
      {tieneAsignacion ? (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
              <ClipboardList className="h-5 w-5 text-primario" aria-hidden />
              {programa.programaNombre}
            </h3>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                estaActivo
                  ? "bg-acento-suave text-acento-fuerte"
                  : "bg-superficie-suave text-texto-suave"
              }`}
            >
              {ETIQUETA_ESTADO[programa.estado ?? ""] ?? programa.estado}
            </span>
          </div>

          {/* Config efectiva en lenguaje humano */}
          <dl className="grid gap-2 sm:grid-cols-2">
            {programa.resumenConfig.map((linea) => (
              <div
                key={linea.etiqueta}
                className="rounded-[var(--radius-md)] bg-superficie-suave p-3"
              >
                <dt className="text-sm font-semibold text-texto-suave">
                  {linea.etiqueta}
                </dt>
                <dd className="text-base text-texto">{linea.valor}</dd>
              </div>
            ))}
          </dl>

          {/* Overrides de módulo (toggles) */}
          <div className="flex flex-col gap-2">
            <h4 className="text-base font-semibold text-texto">
              Módulos para este paciente
            </h4>
            <ul className="flex flex-col gap-2" role="list">
              {programa.modulos.map((m) => (
                <li
                  key={m.clave}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-borde bg-superficie-suave px-4 py-3"
                >
                  <span className="text-base text-texto">{m.etiqueta}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={m.activo}
                    aria-label={`${m.activo ? "Desactivar" : "Activar"} ${m.etiqueta}`}
                    disabled={enviando || !estaActivo}
                    onClick={() =>
                      ejecutar(
                        actualizarOverrideModulo({
                          pacienteId,
                          asignacionId: programa.asignacionId,
                          modulo: m.clave,
                          activo: !m.activo,
                        }),
                      )
                    }
                    className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      m.activo ? "bg-acento" : "bg-borde"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                        m.activo ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-sm text-texto-tenue">
              Un módulo desactivado se bloquea también en el acceso directo del
              paciente, no solo en la interfaz.
            </p>
          </div>

          {/* Suspender / reactivar */}
          <div className="flex flex-wrap gap-2">
            {estaActivo ? (
              <button
                type="button"
                disabled={enviando}
                onClick={() =>
                  ejecutar(
                    suspenderPrograma({
                      pacienteId,
                      asignacionId: programa.asignacionId,
                    }),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-borde px-4 py-2 text-base font-semibold text-texto-suave hover:bg-superficie-suave disabled:opacity-60"
              >
                <Pause className="h-4 w-4" aria-hidden />
                Suspender programa
              </button>
            ) : (
              <button
                type="button"
                disabled={enviando}
                onClick={() =>
                  ejecutar(
                    reactivarPrograma({
                      pacienteId,
                      asignacionId: programa.asignacionId,
                    }),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
              >
                <Play className="h-4 w-4" aria-hidden />
                Reactivar programa
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
          <p className="text-base text-texto-suave">
            Este paciente no tiene ningún programa asignado. Se comporta con la
            configuración estándar.
          </p>
        </section>
      )}

      {/* Asignar (solo si no hay uno activo) */}
      {!estaActivo && programa.plantillas.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
          <h3 className="text-lg font-bold text-texto">Asignar un programa</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
              Plantilla
              <select
                value={plantillaSel}
                onChange={(e) => setPlantillaSel(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
              >
                {programa.plantillas.map((p) => (
                  <option key={p.id} value={p.clave}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={enviando || !plantillaSel}
              onClick={() =>
                ejecutar(
                  asignarPrograma({
                    pacienteId,
                    programaClave: plantillaSel,
                  }),
                )
              }
              className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
            >
              Asignar programa
            </button>
          </div>
          <p className="text-sm text-texto-tenue">
            Al asignar el programa se activan sus reglas de aviso para este
            paciente.
          </p>
        </section>
      ) : null}
    </div>
  );
}
