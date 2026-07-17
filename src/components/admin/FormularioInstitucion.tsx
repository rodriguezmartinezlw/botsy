"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, X } from "lucide-react";
import {
  crearInstitucion,
  crearPais,
} from "@/app/(panel)/admin/instituciones/acciones";
import {
  TIPOS_INSTITUCION,
  ETIQUETA_TIPO_INSTITUCION,
} from "@/lib/admin/esquemas";
import type { PaisVista } from "@/lib/admin/tipos";

type Aviso = { ok: boolean; texto: string } | null;

const claseCampo =
  "rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto focus:border-primario focus:outline-none";

/**
 * Alta de institución (WP-23 §2): nombre, tipo y país (del catálogo). Incluye una
 * mini-alta de país (fila simple) para cuando el país aún no está en el catálogo.
 */
export default function FormularioInstitucion({
  paises,
}: {
  paises: PaisVista[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<string>("clinica");
  const [paisCodigo, setPaisCodigo] = useState(paises[0]?.codigo ?? "");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enviando, iniciar] = useTransition();

  // Mini-alta de país.
  const [paisAbierto, setPaisAbierto] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [avisoPais, setAvisoPais] = useState<Aviso>(null);
  const [creandoPais, iniciarPais] = useTransition();

  function enviar() {
    setAviso(null);
    iniciar(async () => {
      const r = await crearInstitucion({ nombre: nombre.trim(), tipo, paisCodigo });
      if (r.ok) {
        setAviso({ ok: true, texto: r.mensaje ?? "Institución creada." });
        setNombre("");
        router.refresh();
      } else {
        setAviso({ ok: false, texto: r.error });
      }
    });
  }

  function enviarPais() {
    setAvisoPais(null);
    iniciarPais(async () => {
      const codigo = nuevoCodigo.trim().toUpperCase();
      const r = await crearPais({ codigo, nombre: nuevoNombre.trim() });
      if (r.ok) {
        setAvisoPais({ ok: true, texto: r.mensaje ?? "País añadido." });
        setNuevoCodigo("");
        setNuevoNombre("");
        setPaisCodigo(codigo);
        router.refresh();
      } else {
        setAvisoPais({ ok: false, texto: r.error });
      }
    });
  }

  const sinPaises = paises.length === 0;
  const puedeEnviar = nombre.trim().length > 0 && paisCodigo.length > 0;

  return (
    <section
      aria-label="Alta de institución"
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6"
    >
      <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
        <Building2 className="h-5 w-5 text-primario" aria-hidden />
        Nueva institución
      </h2>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (puedeEnviar) enviar();
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoComplete="off"
            placeholder="Clínica Nueva"
            className={claseCampo}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
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
              disabled={sinPaises}
              className={claseCampo}
            >
              {sinPaises ? (
                <option value="">Sin países en el catálogo</option>
              ) : (
                paises.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre} ({p.codigo})
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        {aviso ? (
          <p
            role={aviso.ok ? "status" : "alert"}
            className={`rounded-[var(--radius-md)] px-4 py-3 text-base font-medium ${
              aviso.ok
                ? "bg-acento-suave text-acento-fuerte"
                : "bg-superficie-suave text-[#b91c1c]"
            }`}
          >
            {aviso.texto}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={enviando || !puedeEnviar}
            className="rounded-[var(--radius-md)] bg-primario px-5 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
          >
            {enviando ? "Creando…" : "Crear institución"}
          </button>
          <button
            type="button"
            onClick={() => setPaisAbierto((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-borde px-4 py-2.5 text-sm font-semibold text-texto-suave hover:bg-superficie-suave"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Añadir país
          </button>
        </div>
      </form>

      {paisAbierto ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-borde bg-superficie-suave p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-texto">Nuevo país (catálogo)</h3>
            <button
              type="button"
              onClick={() => setPaisAbierto(false)}
              aria-label="Cerrar el alta de país"
              className="rounded-[var(--radius-sm)] p-1 text-texto-tenue hover:text-texto"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (nuevoCodigo.trim().length === 2 && nuevoNombre.trim().length > 0) {
                enviarPais();
              }
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
              Código ISO (2 letras)
              <input
                value={nuevoCodigo}
                onChange={(e) => setNuevoCodigo(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="CO"
                className={`${claseCampo} w-28 uppercase`}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-texto-suave">
              Nombre
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Colombia"
                className={claseCampo}
              />
            </label>
            <button
              type="submit"
              disabled={creandoPais}
              className="rounded-[var(--radius-md)] bg-primario px-4 py-2.5 text-sm font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
            >
              {creandoPais ? "Añadiendo…" : "Añadir"}
            </button>
          </form>
          {avisoPais ? (
            <p
              role={avisoPais.ok ? "status" : "alert"}
              className={`text-sm font-medium ${
                avisoPais.ok ? "text-acento-fuerte" : "text-[#b91c1c]"
              }`}
            >
              {avisoPais.texto}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
