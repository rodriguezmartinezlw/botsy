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
import {
  DECISIONES_DISPOSICION,
  ETIQUETA_DECISION,
  ETIQUETA_DESENLACE,
} from "@/lib/disposiciones/nucleo";
import type { AmbitoMotivo, EstadoAlerta, NivelEscalado } from "@/types/db";
import type {
  AlertaDetalle,
  MotivoCatalogo,
  ResultadoAccion,
} from "@/lib/panel/tipos";
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

/** Formulario de disposición estructurada obligatoria (WP-11 v2 §B). */
function FormularioDisposicion({
  modo,
  motivos,
  enviando,
  onConfirmar,
  onCancelar,
}: {
  modo: "resolver" | "descartar";
  motivos: MotivoCatalogo[];
  enviando: boolean;
  onConfirmar: (d: {
    decision: string;
    motivoCodigo: string;
    diasSeguimiento: number;
    motivoTexto?: string;
  }) => void;
  onCancelar: () => void;
}) {
  const ambito: AmbitoMotivo = modo === "resolver" ? "disposicion" : "descarte";
  const motivosAmbito = motivos.filter((m) => m.ambito === ambito);

  const [decision, setDecision] = useState<string>(
    modo === "descartar" ? "sin_accion_justificada" : "contactado_paciente",
  );
  const [motivoCodigo, setMotivoCodigo] = useState<string>("");
  const [dias, setDias] = useState<number>(7);
  const [nota, setNota] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  function confirmar() {
    if (!motivoCodigo) {
      setErrorLocal("Selecciona un motivo del catálogo.");
      return;
    }
    setErrorLocal(null);
    onConfirmar({
      decision,
      motivoCodigo,
      diasSeguimiento: dias,
      motivoTexto: nota.trim().length > 0 ? nota.trim() : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-superficie-suave p-3">
      <p className="text-sm font-semibold text-texto">
        {modo === "resolver"
          ? "Resolver con disposición"
          : "Descartar con disposición"}
      </p>

      <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
        Decisión
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
        >
          {DECISIONES_DISPOSICION.map((d) => (
            <option key={d} value={d}>
              {ETIQUETA_DECISION[d]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
        Motivo (catálogo)
        <select
          value={motivoCodigo}
          onChange={(e) => setMotivoCodigo(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
        >
          <option value="">— Selecciona un motivo —</option>
          {motivosAmbito.map((m) => (
            <option key={m.id} value={m.id}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
        Programar seguimiento (días)
        <input
          type="number"
          min={0}
          max={365}
          value={dias}
          onChange={(e) => setDias(Math.max(0, Number(e.target.value) || 0))}
          className="w-28 rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
        Nota (opcional)
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
          placeholder="Detalle libre del seguimiento (opcional)."
        />
      </label>

      {errorLocal ? <p className="text-sm text-[#b91c1c]">{errorLocal}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={confirmar}
          className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Confirmar disposición"}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={onCancelar}
          className="rounded-[var(--radius-md)] border border-borde px-4 py-2 text-base font-semibold text-texto-suave hover:bg-superficie"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function TarjetaAlerta({
  alerta,
  motivos,
}: {
  alerta: AlertaDetalle;
  motivos: MotivoCatalogo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<null | "resolver" | "descartar">(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function ejecutar(promesa: Promise<ResultadoAccion>) {
    setError(null);
    iniciar(async () => {
      const r = await promesa;
      if (!r.ok) setError(r.error);
      else setModo(null);
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
            <span className="text-base font-semibold text-texto">
              {alerta.motivo}
            </span>
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

      {/* Disposición registrada (alerta ya cerrada) */}
      {gestionada && alerta.disposicion ? (
        <div className="rounded-[var(--radius-md)] border border-borde bg-superficie-suave p-3 text-sm text-texto-suave">
          <p>
            <span className="font-semibold text-texto">Disposición:</span>{" "}
            {ETIQUETA_DECISION[alerta.disposicion.decision]}
            {alerta.disposicion.motivoEtiqueta
              ? ` · ${alerta.disposicion.motivoEtiqueta}`
              : ""}
          </p>
          <p>
            <span className="font-semibold text-texto">Seguimiento:</span>{" "}
            {alerta.disposicion.diasSeguimiento} día(s) ·{" "}
            <span className="font-semibold text-texto">Desenlace:</span>{" "}
            {ETIQUETA_DESENLACE[alerta.disposicion.desenlace]}
          </p>
          {alerta.disposicion.motivoTexto ? (
            <p className="mt-1">{alerta.disposicion.motivoTexto}</p>
          ) : null}
        </div>
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
            <FormularioDisposicion
              modo={modo}
              motivos={motivos}
              enviando={enviando}
              onCancelar={() => {
                setModo(null);
                setError(null);
              }}
              onConfirmar={(d) =>
                ejecutar(
                  modo === "resolver"
                    ? resolverAlerta({ alertaId: alerta.id, ...d })
                    : descartarAlerta({ alertaId: alerta.id, ...d }),
                )
              }
            />
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
  motivos,
}: {
  alertas: AlertaDetalle[];
  motivos: MotivoCatalogo[];
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
            <TarjetaAlerta key={a.id} alerta={a} motivos={motivos} />
          ))}
        </ul>
      )}
    </div>
  );
}
