"use client";

import { useState, useTransition } from "react";
import { Pill, Plus } from "lucide-react";
import {
  altaPauta,
  cambiarEstadoPauta,
  editarPauta,
} from "@/app/(panel)/pacientes/[id]/acciones";
import type { PautaVista, ResultadoAccion } from "@/lib/panel/tipos";

const MOMENTOS = ["mañana", "mediodía", "tarde", "noche"] as const;

type DatosPauta = {
  farmaco: string;
  dosis: string;
  momentos: string[];
  critica: boolean;
};

function FormularioPauta({
  inicial,
  enviando,
  onGuardar,
  onCancelar,
}: {
  inicial: DatosPauta;
  enviando: boolean;
  onGuardar: (d: DatosPauta) => void;
  onCancelar: () => void;
}) {
  const [farmaco, setFarmaco] = useState(inicial.farmaco);
  const [dosis, setDosis] = useState(inicial.dosis);
  const [momentos, setMomentos] = useState<string[]>(inicial.momentos);
  const [critica, setCritica] = useState(inicial.critica);
  const [error, setError] = useState<string | null>(null);

  function toggleMomento(m: string) {
    setMomentos((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  function guardar() {
    if (farmaco.trim().length === 0) {
      setError("Indica el nombre del fármaco.");
      return;
    }
    if (momentos.length === 0) {
      setError("Selecciona al menos un momento de toma.");
      return;
    }
    setError(null);
    onGuardar({ farmaco: farmaco.trim(), dosis: dosis.trim(), momentos, critica });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-borde bg-superficie-suave p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
          Fármaco
          <input
            value={farmaco}
            onChange={(e) => setFarmaco(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
            placeholder="Ej.: Warfarina"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
          Dosis (opcional)
          <input
            value={dosis}
            onChange={(e) => setDosis(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
            placeholder="Ej.: 5 mg"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-texto-suave">Momentos de toma</legend>
        <div className="flex flex-wrap gap-2">
          {MOMENTOS.map((m) => {
            const activo = momentos.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMomento(m)}
                aria-pressed={activo}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activo
                    ? "bg-primario text-white"
                    : "bg-superficie text-texto-suave hover:bg-primario-suave"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="inline-flex items-center gap-2 text-sm font-medium text-texto-suave">
        <input
          type="checkbox"
          checked={critica}
          onChange={(e) => setCritica(e.target.checked)}
          className="h-4 w-4"
        />
        Medicación importante (crítica) — cuenta para el escalado por omisión
      </label>

      {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={enviando}
          className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={enviando}
          className="rounded-[var(--radius-md)] border border-borde px-4 py-2 text-base font-semibold text-texto-suave hover:bg-superficie-suave"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function TarjetaPauta({
  pauta,
  pacienteId,
}: {
  pauta: PautaVista;
  pacienteId: string;
}) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function manejar(resultado: Promise<ResultadoAccion>, alTerminar?: () => void) {
    iniciar(async () => {
      const r = await resultado;
      if (!r.ok) setError(r.error);
      else {
        setError(null);
        alTerminar?.();
      }
    });
  }

  if (editando) {
    return (
      <FormularioPauta
        inicial={{
          farmaco: pauta.farmaco,
          dosis: pauta.dosis ?? "",
          momentos: pauta.momentos,
          critica: pauta.critica,
        }}
        enviando={enviando}
        onCancelar={() => setEditando(false)}
        onGuardar={(d) =>
          manejar(
            editarPauta({ pacienteId, pautaId: pauta.id, ...d }),
            () => setEditando(false),
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-borde bg-superficie p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-texto">{pauta.farmaco}</span>
            {pauta.dosis ? (
              <span className="text-sm text-texto-suave">{pauta.dosis}</span>
            ) : null}
            {pauta.critica ? (
              <span className="rounded-full bg-superficie-suave px-2 py-0.5 text-xs font-medium text-vigilancia">
                Importante
              </span>
            ) : null}
          </div>
          <span className="text-sm text-texto-tenue">
            {pauta.momentos.join(", ")}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={enviando}
            className="rounded-[var(--radius-sm)] border border-borde px-3 py-1.5 text-sm font-semibold text-texto-suave hover:bg-superficie-suave"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() =>
              manejar(
                cambiarEstadoPauta({ pacienteId, pautaId: pauta.id, activa: !pauta.activa }),
              )
            }
            disabled={enviando}
            className="rounded-[var(--radius-sm)] border border-borde px-3 py-1.5 text-sm font-semibold text-texto-suave hover:bg-superficie-suave"
          >
            {pauta.activa ? "Desactivar" : "Reactivar"}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}
    </div>
  );
}

export default function PanelMedicacion({
  pacienteId,
  pautas,
}: {
  pacienteId: string;
  pautas: PautaVista[];
}) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const activas = pautas.filter((p) => p.activa);
  const historicas = pautas.filter((p) => !p.activa);

  function crear(d: DatosPauta) {
    iniciar(async () => {
      const r = await altaPauta({ pacienteId, ...d });
      if (!r.ok) setError(r.error);
      else {
        setError(null);
        setCreando(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
          <Pill className="h-5 w-5 text-primario" aria-hidden />
          Medicación
        </h2>
        {!creando ? (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte"
          >
            <Plus className="h-5 w-5" aria-hidden />
            Añadir pauta
          </button>
        ) : null}
      </div>

      {creando ? (
        <FormularioPauta
          inicial={{ farmaco: "", dosis: "", momentos: [], critica: false }}
          enviando={enviando}
          onCancelar={() => setCreando(false)}
          onGuardar={crear}
        />
      ) : null}
      {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-texto-suave">Pautas activas</h3>
        {activas.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-4 text-base text-texto-suave">
            No hay pautas activas.
          </p>
        ) : (
          activas.map((p) => (
            <TarjetaPauta key={p.id} pauta={p} pacienteId={pacienteId} />
          ))
        )}
      </div>

      {historicas.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-texto-suave">Histórico</h3>
          {historicas.map((p) => (
            <TarjetaPauta key={p.id} pauta={p} pacienteId={pacienteId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
