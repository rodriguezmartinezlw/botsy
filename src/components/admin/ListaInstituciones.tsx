"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, Users, UserRound } from "lucide-react";
import {
  editarInstitucion,
  cambiarEstadoInstitucion,
} from "@/app/(panel)/admin/instituciones/acciones";
import {
  TIPOS_INSTITUCION,
  ETIQUETA_TIPO_INSTITUCION,
} from "@/lib/admin/esquemas";
import type { InstitucionVista, PaisVista } from "@/lib/admin/tipos";

const claseCampo =
  "rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none";

export default function ListaInstituciones({
  instituciones,
  paises,
}: {
  instituciones: InstitucionVista[];
  paises: PaisVista[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Campos del formulario de edición (sólo para la fila abierta).
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<string>("clinica");
  const [paisCodigo, setPaisCodigo] = useState("");

  function abrirEdicion(i: InstitucionVista) {
    setError(null);
    setEditando(i.id);
    setNombre(i.nombre);
    setTipo(i.tipo);
    setPaisCodigo(i.paisCodigo);
  }

  function guardar(id: string) {
    setError(null);
    iniciar(async () => {
      const r = await editarInstitucion({
        id,
        nombre: nombre.trim(),
        tipo,
        paisCodigo,
      });
      if (r.ok) {
        setEditando(null);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function cambiarEstado(id: string, activa: boolean) {
    setError(null);
    iniciar(async () => {
      const r = await cambiarEstadoInstitucion({ id, activa });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  if (instituciones.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-3 text-base text-texto-suave">
        Aún no hay instituciones. Crea la primera arriba.
      </p>
    );
  }

  return (
    <section aria-label="Instituciones" className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-texto">
        Instituciones ({instituciones.length})
      </h2>
      {error ? (
        <p role="alert" className="text-base font-medium text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {instituciones.map((i) => (
          <li
            key={i.id}
            className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-5"
          >
            {editando === i.id ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (nombre.trim().length > 0) guardar(i.id);
                }}
              >
                <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
                  Nombre
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className={claseCampo}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
                    Tipo
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className={claseCampo}
                    >
                      {TIPOS_INSTITUCION.map((t) => (
                        <option key={t} value={t}>
                          {ETIQUETA_TIPO_INSTITUCION[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
                    País
                    <select
                      value={paisCodigo}
                      onChange={(e) => setPaisCodigo(e.target.value)}
                      className={claseCampo}
                    >
                      {paises.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.nombre} ({p.codigo})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={pendiente}
                    className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-sm font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(null)}
                    className="rounded-[var(--radius-md)] border border-borde px-4 py-2 text-sm font-semibold text-texto-suave hover:bg-superficie-suave"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-texto">{i.nombre}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        i.activa
                          ? "bg-acento-suave text-acento-fuerte"
                          : "bg-superficie-suave text-texto-tenue"
                      }`}
                    >
                      {i.activa ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <span className="text-sm text-texto-suave">
                    {ETIQUETA_TIPO_INSTITUCION[i.tipo]}
                    {i.paisNombre ? ` · ${i.paisNombre}` : ` · ${i.paisCodigo}`}
                  </span>
                  <span className="flex flex-wrap gap-4 text-sm text-texto-tenue">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" aria-hidden />
                      {i.profesionales} profesional{i.profesionales === 1 ? "" : "es"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-4 w-4" aria-hidden />
                      {i.pacientes} paciente{i.pacientes === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => abrirEdicion(i)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-borde px-3 py-2 text-sm font-semibold text-texto-suave hover:bg-superficie-suave"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => cambiarEstado(i.id, !i.activa)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-borde px-3 py-2 text-sm font-semibold text-texto-suave hover:bg-superficie-suave disabled:opacity-60"
                  >
                    <Power className="h-4 w-4" aria-hidden />
                    {i.activa ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
