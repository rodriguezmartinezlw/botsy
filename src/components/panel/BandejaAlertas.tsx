"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Check, ChevronDown, ExternalLink, X } from "lucide-react";
import {
  descartarAlerta,
  marcarVista,
  resolverAlerta,
} from "@/app/(panel)/alertas/acciones";
import {
  filtrarBandeja,
  ordenarBandeja,
  type FiltrosBandeja,
} from "@/lib/panel/bandeja";
import type { EstadoAlerta, NivelEscalado } from "@/types/db";
import type { AlertaDetalle, ResultadoAccion } from "@/lib/panel/tipos";
import BadgeNivel from "./BadgeNivel";
import EvidenciaAlerta from "./EvidenciaAlerta";

const ESTADO_ETIQUETA: Record<EstadoAlerta, string> = {
  nueva: "Nueva",
  vista: "Vista",
  resuelta: "Resuelta",
  descartada: "Descartada",
};

function fechaHora(ts: string): string {
  try {
    return format(parseISO(ts), "d MMM yyyy · HH:mm", { locale: es });
  } catch {
    return ts;
  }
}

function TarjetaAlerta({ alerta }: { alerta: AlertaDetalle }) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<null | "resolver" | "descartar">(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function ejecutar(promesa: Promise<ResultadoAccion>) {
    setError(null);
    iniciar(async () => {
      const r = await promesa;
      if (!r.ok) setError(r.error);
      else {
        setModo(null);
        setTexto("");
      }
    });
  }

  const gestionada =
    alerta.estado === "resuelta" || alerta.estado === "descartada";

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeNivel nivel={alerta.nivel} />
            <span className="text-base font-semibold text-texto">{alerta.motivo}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-texto-suave">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primario-suave text-xs font-bold text-primario"
              >
                {alerta.pacienteInicial}
              </span>
              {alerta.pacienteNombre}
            </span>
            <span aria-hidden>·</span>
            <time>{fechaHora(alerta.creadoEn)}</time>
            <span aria-hidden>·</span>
            <span>{ESTADO_ETIQUETA[alerta.estado]}</span>
          </div>
        </div>
        <Link
          href={`/pacientes/${alerta.pacienteId}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primario hover:underline"
        >
          Ver ficha
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-texto-suave hover:text-primario"
      >
        {abierto ? "Ocultar evidencia" : "Ver evidencia"}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {abierto ? (
        <div className="rounded-[var(--radius-md)] bg-superficie-suave p-3">
          <EvidenciaAlerta evidencia={alerta.evidencia} />
        </div>
      ) : null}

      {alerta.estado === "descartada" && alerta.motivoDescarte ? (
        <p className="text-sm text-texto-suave">
          <span className="font-semibold">Motivo del descarte:</span>{" "}
          {alerta.motivoDescarte}
        </p>
      ) : null}

      {!gestionada ? (
        <div className="flex flex-col gap-2">
          {modo === null ? (
            <div className="flex flex-wrap gap-2">
              {alerta.estado === "nueva" ? (
                <button
                  type="button"
                  onClick={() => ejecutar(marcarVista({ alertaId: alerta.id }))}
                  disabled={enviando}
                  className="rounded-[var(--radius-md)] border border-borde px-3 py-1.5 text-sm font-semibold text-texto-suave hover:bg-superficie-suave disabled:opacity-60"
                >
                  Marcar vista
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setModo("resolver");
                  setError(null);
                }}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-acento px-3 py-1.5 text-sm font-semibold text-white hover:bg-acento-fuerte disabled:opacity-60"
              >
                <Check className="h-4 w-4" aria-hidden />
                Resolver
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo("descartar");
                  setError(null);
                }}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-borde px-3 py-1.5 text-sm font-semibold text-texto-suave hover:bg-superficie-suave disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden />
                Descartar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-superficie-suave p-3">
              <label className="text-sm font-medium text-texto-suave">
                {modo === "resolver"
                  ? "Nota (opcional)"
                  : "Motivo del descarte (obligatorio)"}
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
                  placeholder={
                    modo === "resolver"
                      ? "Ej.: hablado con el paciente, ajustada la pauta."
                      : "Ej.: falso positivo, el paciente lo confirmó."
                  }
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() =>
                    ejecutar(
                      modo === "resolver"
                        ? resolverAlerta({ alertaId: alerta.id, nota: texto })
                        : descartarAlerta({ alertaId: alerta.id, motivo: texto }),
                    )
                  }
                  className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
                >
                  {enviando ? "Guardando…" : "Confirmar"}
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => {
                    setModo(null);
                    setTexto("");
                    setError(null);
                  }}
                  className="rounded-[var(--radius-md)] border border-borde px-4 py-2 text-base font-semibold text-texto-suave hover:bg-superficie"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

function Selector<T extends string>({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: T | "";
  opciones: { valor: T; texto: string }[];
  onChange: (v: T | "") => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
      {etiqueta}
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as T | "")}
        className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
      >
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function BandejaAlertas({
  alertas,
}: {
  alertas: AlertaDetalle[];
}) {
  const [estado, setEstado] = useState<EstadoAlerta | "">("");
  const [nivel, setNivel] = useState<NivelEscalado | "">("");
  const [pacienteId, setPacienteId] = useState<string | "">("");

  const pacientes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const a of alertas) mapa.set(a.pacienteId, a.pacienteNombre);
    return [...mapa.entries()].map(([valor, texto]) => ({ valor, texto }));
  }, [alertas]);

  const visibles = useMemo(() => {
    const filtros: FiltrosBandeja = {
      estado: estado || undefined,
      nivel: nivel || undefined,
      pacienteId: pacienteId || undefined,
    };
    return ordenarBandeja(filtrarBandeja(alertas, filtros));
  }, [alertas, estado, nivel, pacienteId]);

  if (alertas.length === 0) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
        <p className="text-base text-texto-suave">
          No hay alertas por ahora. Cuando el escalado detecte una señal en un
          check-in, aparecerá aquí priorizada por nivel.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Selector
          etiqueta="Estado"
          valor={estado}
          onChange={setEstado}
          opciones={[
            { valor: "nueva", texto: "Nueva" },
            { valor: "vista", texto: "Vista" },
            { valor: "resuelta", texto: "Resuelta" },
            { valor: "descartada", texto: "Descartada" },
          ]}
        />
        <Selector
          etiqueta="Nivel"
          valor={nivel}
          onChange={setNivel}
          opciones={[
            { valor: "urgencia", texto: "Urgencia" },
            { valor: "contactar", texto: "Contactar" },
            { valor: "vigilancia", texto: "Vigilancia" },
          ]}
        />
        <Selector
          etiqueta="Paciente"
          valor={pacienteId}
          onChange={setPacienteId}
          opciones={pacientes}
        />
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-6 text-center text-base text-texto-suave">
          Ninguna alerta coincide con los filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {visibles.map((a) => (
            <TarjetaAlerta key={a.id} alerta={a} />
          ))}
        </ul>
      )}
    </div>
  );
}
