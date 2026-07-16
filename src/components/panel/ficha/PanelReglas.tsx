"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";
import {
  cambiarEstadoRegla,
  crearReglaPaciente,
} from "@/app/(panel)/pacientes/[id]/acciones";
import {
  ETIQUETA_NIVEL,
  NIVELES,
  PLANTILLAS,
  plantillaPorId,
  type IdPlantilla,
} from "@/lib/panel/reglas-plantillas";
import type { NivelEscalado } from "@/types/db";
import type { ReglaVista } from "@/lib/panel/tipos";
import BadgeNivel from "../BadgeNivel";

function TarjetaRegla({
  regla,
  accion,
}: {
  regla: ReglaVista;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-borde bg-superficie p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-texto">{regla.nombre}</span>
          <BadgeNivel nivel={regla.nivel} />
          {!regla.activa ? (
            <span className="rounded-full bg-superficie-suave px-2 py-0.5 text-xs font-medium text-texto-tenue">
              Inactiva
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-texto-suave">{regla.condicionTexto}</p>
      </div>
      {accion ? <div className="shrink-0">{accion}</div> : null}
    </div>
  );
}

function FormularioRegla({
  pacienteId,
  onHecho,
}: {
  pacienteId: string;
  onHecho: () => void;
}) {
  const [plantillaId, setPlantillaId] = useState<IdPlantilla>(PLANTILLAS[0].id);
  const plantilla = useMemo(() => plantillaPorId(plantillaId)!, [plantillaId]);
  const [valores, setValores] = useState<Record<string, number>>(() =>
    Object.fromEntries(plantilla.campos.map((c) => [c.clave, c.porDefecto])),
  );
  const [nivel, setNivel] = useState<NivelEscalado>(plantilla.nivelPorDefecto);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function cambiarPlantilla(id: IdPlantilla) {
    const p = plantillaPorId(id)!;
    setPlantillaId(id);
    setValores(Object.fromEntries(p.campos.map((c) => [c.clave, c.porDefecto])));
    setNivel(p.nivelPorDefecto);
    setError(null);
  }

  const frase = plantilla.patronFrase
    .replace("{umbral}", String(valores.umbral ?? ""))
    .replace("{dias}", String(valores.dias ?? ""));

  function crear() {
    setError(null);
    iniciar(async () => {
      const r = await crearReglaPaciente({
        pacienteId,
        plantilla: plantillaId,
        nivel,
        umbral: valores.umbral,
        dias: valores.dias,
      });
      if (!r.ok) setError(r.error);
      else onHecho();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-borde bg-superficie-suave p-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
        Tipo de aviso
        <select
          value={plantillaId}
          onChange={(e) => cambiarPlantilla(e.target.value as IdPlantilla)}
          className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
        >
          {PLANTILLAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titulo}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {plantilla.campos.map((campo) => (
          <label
            key={campo.clave}
            className="flex flex-col gap-1 text-sm font-medium text-texto-suave"
          >
            {campo.etiqueta}
            <input
              type="number"
              min={campo.min}
              max={campo.max}
              value={valores[campo.clave] ?? campo.porDefecto}
              onChange={(e) =>
                setValores((v) => ({
                  ...v,
                  [campo.clave]: Number(e.target.value),
                }))
              }
              className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
          Prioridad del aviso
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value as NivelEscalado)}
            className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
          >
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {ETIQUETA_NIVEL[n]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="rounded-[var(--radius-sm)] bg-superficie px-3 py-2 text-sm text-texto-suave">
        <span className="font-semibold text-texto">Vista previa: </span>
        {frase}
      </p>

      {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={crear}
          disabled={enviando}
          className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
        >
          {enviando ? "Creando…" : "Crear regla"}
        </button>
        <button
          type="button"
          onClick={onHecho}
          disabled={enviando}
          className="rounded-[var(--radius-md)] border border-borde px-4 py-2 text-base font-semibold text-texto-suave hover:bg-superficie"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function BotonEstadoRegla({
  pacienteId,
  regla,
}: {
  pacienteId: string;
  regla: ReglaVista;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() =>
          iniciar(async () => {
            const r = await cambiarEstadoRegla({
              pacienteId,
              reglaId: regla.id,
              activa: !regla.activa,
            });
            setError(r.ok ? null : r.error);
          })
        }
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-borde px-3 py-1.5 text-sm font-semibold text-texto-suave hover:bg-superficie-suave"
      >
        {regla.activa ? (
          <ToggleRight className="h-5 w-5 text-acento-fuerte" aria-hidden />
        ) : (
          <ToggleLeft className="h-5 w-5 text-texto-tenue" aria-hidden />
        )}
        {regla.activa ? "Activa" : "Inactiva"}
      </button>
      {error ? <span className="text-xs text-[#b91c1c]">{error}</span> : null}
    </div>
  );
}

export default function PanelReglas({
  pacienteId,
  reglasGlobales,
  reglasPaciente,
}: {
  pacienteId: string;
  reglasGlobales: ReglaVista[];
  reglasPaciente: ReglaVista[];
}) {
  const [creando, setCreando] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
            <ShieldAlert className="h-5 w-5 text-primario" aria-hidden />
            Reglas de este paciente
          </h2>
          {!creando ? (
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte"
            >
              <Plus className="h-5 w-5" aria-hidden />
              Añadir regla
            </button>
          ) : null}
        </div>

        {creando ? (
          <FormularioRegla pacienteId={pacienteId} onHecho={() => setCreando(false)} />
        ) : null}

        {reglasPaciente.length === 0 && !creando ? (
          <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-4 text-base text-texto-suave">
            Aún no hay reglas específicas para este paciente. Crea una a partir de
            una plantilla (por ejemplo, “Avísame si el dolor llega a 8 o más”).
          </p>
        ) : (
          reglasPaciente.map((r) => (
            <TarjetaRegla
              key={r.id}
              regla={r}
              accion={<BotonEstadoRegla pacienteId={pacienteId} regla={r} />}
            />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-texto">Reglas globales aplicables</h2>
        <p className="text-sm text-texto-suave">
          Estas reglas las mantiene el equipo de Botsy y se aplican a todos los
          pacientes (según su vertical). Aquí sólo se muestran; no se editan.
        </p>
        {reglasGlobales.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-4 text-base text-texto-suave">
            No hay reglas globales aplicables a este paciente.
          </p>
        ) : (
          reglasGlobales.map((r) => <TarjetaRegla key={r.id} regla={r} />)
        )}
      </section>
    </div>
  );
}
