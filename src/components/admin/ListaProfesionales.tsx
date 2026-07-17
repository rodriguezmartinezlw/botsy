"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Building2, Plus } from "lucide-react";
import {
  asignarMembresia,
  retirarMembresia,
} from "@/app/(panel)/admin/profesionales/acciones";
import type { InstitucionOpcion, ProfesionalVista } from "@/lib/admin/tipos";

const claseCampo =
  "rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none";

export default function ListaProfesionales({
  profesionales,
  instituciones,
}: {
  profesionales: ProfesionalVista[];
  instituciones: InstitucionOpcion[];
}) {
  if (profesionales.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-3 text-base text-texto-suave">
        Aún no hay profesionales. Invita al primero arriba.
      </p>
    );
  }

  return (
    <section aria-label="Profesionales" className="flex flex-col gap-3">
      <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
        <Users className="h-5 w-5 text-primario" aria-hidden />
        Profesionales ({profesionales.length})
      </h2>
      <ul className="flex flex-col gap-3">
        {profesionales.map((p) => (
          <TarjetaProfesional
            key={p.id}
            profesional={p}
            instituciones={instituciones}
          />
        ))}
      </ul>
    </section>
  );
}

function TarjetaProfesional({
  profesional,
  instituciones,
}: {
  profesional: ProfesionalVista;
  instituciones: InstitucionOpcion[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Aviso de "última institución" pendiente de confirmar, por membresía.
  const [confirmar, setConfirmar] = useState<{ id: string; texto: string } | null>(
    null,
  );
  const [nuevaInstitucion, setNuevaInstitucion] = useState("");
  const [pendiente, iniciar] = useTransition();

  // Instituciones aún NO vinculadas a este profesional (por membresía existente).
  const disponibles = useMemo(() => {
    const vinculadas = new Set(profesional.membresias.map((m) => m.institucionId));
    return instituciones.filter((i) => !vinculadas.has(i.id));
  }, [instituciones, profesional.membresias]);

  function asignar(institucionId: string) {
    if (!institucionId) return;
    setError(null);
    iniciar(async () => {
      const r = await asignarMembresia({
        profesionalId: profesional.id,
        institucionId,
      });
      if (r.ok) {
        setNuevaInstitucion("");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function retirar(membresiaId: string, forzar: boolean) {
    setError(null);
    iniciar(async () => {
      const r = await retirarMembresia({ membresiaId, confirmar: forzar });
      if (r.ok) {
        setConfirmar(null);
        router.refresh();
      } else if (r.confirmable) {
        setConfirmar({ id: membresiaId, texto: r.error });
      } else {
        setError(r.error);
      }
    });
  }

  const activas = profesional.membresias.filter((m) => m.activa);

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold text-texto">{profesional.nombre}</span>
        {profesional.telefono ? (
          <span className="text-sm text-texto-tenue">{profesional.telefono}</span>
        ) : null}
      </div>

      {/* Membresías */}
      {profesional.membresias.length === 0 ? (
        <p className="text-sm text-texto-tenue">
          Sin institución asignada: no puede ver ni dar de alta pacientes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {profesional.membresias.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] bg-superficie-suave px-3 py-2"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-texto">
                <Building2 className="h-4 w-4 text-texto-tenue" aria-hidden />
                {m.institucionNombre}
                {!m.activa ? (
                  <span className="rounded-full bg-superficie px-2 py-0.5 text-xs font-semibold text-texto-tenue">
                    Retirada
                  </span>
                ) : null}
              </span>
              {m.activa ? (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => retirar(m.id, false)}
                  className="rounded-[var(--radius-sm)] border border-borde px-3 py-1.5 text-sm font-semibold text-texto-suave hover:bg-superficie disabled:opacity-60"
                >
                  Retirar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => asignar(m.institucionId)}
                  className="rounded-[var(--radius-sm)] border border-borde px-3 py-1.5 text-sm font-semibold text-primario hover:bg-superficie disabled:opacity-60"
                >
                  Reactivar
                </button>
              )}

              {/* Confirmación del aviso de última institución */}
              {confirmar?.id === m.id ? (
                <div className="flex w-full flex-col gap-2 rounded-[var(--radius-sm)] bg-superficie px-3 py-2">
                  <p role="alert" className="text-sm font-medium text-[#b45309]">
                    {confirmar.texto}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => retirar(m.id, true)}
                      className="rounded-[var(--radius-sm)] bg-[#b91c1c] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      Confirmar retiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmar(null)}
                      className="rounded-[var(--radius-sm)] border border-borde px-3 py-1.5 text-sm font-semibold text-texto-suave hover:bg-superficie-suave"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Asignar a una institución nueva */}
      {disponibles.length > 0 ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            asignar(nuevaInstitucion);
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-texto-suave">
            Asignar a institución
            <select
              value={nuevaInstitucion}
              onChange={(e) => setNuevaInstitucion(e.target.value)}
              className={claseCampo}
            >
              <option value="">Elige una institución…</option>
              {disponibles.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                  {i.paisNombre ? ` · ${i.paisNombre}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pendiente || nuevaInstitucion.length === 0}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-primario px-4 py-2 text-sm font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Asignar
          </button>
        </form>
      ) : activas.length === 0 && instituciones.length === 0 ? (
        <p className="text-sm text-texto-tenue">
          No hay instituciones activas. Crea una en la pestaña Instituciones.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-[#b91c1c]">
          {error}
        </p>
      ) : null}
    </li>
  );
}
