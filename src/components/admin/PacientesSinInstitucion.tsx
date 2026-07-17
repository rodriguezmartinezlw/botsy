"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserX, ShieldCheck } from "lucide-react";
import { asignarInstitucionPaciente } from "@/app/(panel)/admin/pacientes/acciones";
import type {
  InstitucionOpcion,
  PacienteSinInstitucionVista,
} from "@/lib/admin/tipos";

const claseCampo =
  "rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none";

/**
 * Pacientes con `institucion_id` NULL (WP-23 §5): no los ve ningún profesional.
 * El admin les asigna una institución activa para hacerlos visibles a su equipo.
 */
export default function PacientesSinInstitucion({
  pacientes,
  instituciones,
}: {
  pacientes: PacienteSinInstitucionVista[];
  instituciones: InstitucionOpcion[];
}) {
  if (pacientes.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
        <ShieldCheck className="h-6 w-6 text-acento-fuerte" aria-hidden />
        <p className="text-base text-texto-suave">
          Todos los pacientes tienen institución asignada. No hay ninguno invisible.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Pacientes sin institución" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
          <UserX className="h-5 w-5 text-primario" aria-hidden />
          Pacientes sin institución ({pacientes.length})
        </h2>
        <p className="text-sm text-texto-suave">
          Estos pacientes no son visibles para ningún profesional hasta que se les
          asigne una institución.
        </p>
      </div>
      {instituciones.length === 0 ? (
        <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-3 text-sm text-texto-suave">
          No hay instituciones activas. Crea una en la pestaña Instituciones para
          poder asignarlas.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {pacientes.map((p) => (
          <FilaPaciente key={p.id} paciente={p} instituciones={instituciones} />
        ))}
      </ul>
    </section>
  );
}

function FilaPaciente({
  paciente,
  instituciones,
}: {
  paciente: PacienteSinInstitucionVista;
  instituciones: InstitucionOpcion[];
}) {
  const router = useRouter();
  const [institucionId, setInstitucionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function asignar() {
    if (!institucionId) return;
    setError(null);
    iniciar(async () => {
      const r = await asignarInstitucionPaciente({
        pacienteId: paciente.id,
        institucionId,
      });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primario-suave text-base font-bold text-primario"
          >
            {paciente.inicial}
          </span>
          <span className="text-base font-bold text-texto">{paciente.nombre}</span>
        </div>
        {instituciones.length > 0 ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              asignar();
            }}
          >
            <select
              aria-label={`Institución para ${paciente.nombre}`}
              value={institucionId}
              onChange={(e) => setInstitucionId(e.target.value)}
              className={claseCampo}
            >
              <option value="">Elige una institución…</option>
              {instituciones.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                  {i.paisNombre ? ` · ${i.paisNombre}` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pendiente || institucionId.length === 0}
              className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-sm font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
            >
              Asignar
            </button>
          </form>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-[#b91c1c]">
          {error}
        </p>
      ) : null}
    </li>
  );
}
