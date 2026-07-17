"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { registrarDesenlace } from "@/app/(panel)/alertas/acciones";
import {
  DESENLACES_REGISTRABLES,
  ETIQUETA_DECISION,
  ETIQUETA_DESENLACE,
} from "@/lib/disposiciones/nucleo";
import type { DesenlacePendienteVista, ResultadoAccion } from "@/lib/panel/tipos";
import BadgeNivel from "./BadgeNivel";

function fecha(ts: string): string {
  try {
    return format(parseISO(ts), "d MMM yyyy", { locale: es });
  } catch {
    return ts;
  }
}

function Fila({ item }: { item: DesenlacePendienteVista }) {
  const [desenlace, setDesenlace] = useState<string>(
    DESENLACES_REGISTRABLES[0],
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function registrar() {
    setError(null);
    iniciar(async () => {
      const r: ResultadoAccion = await registrarDesenlace({
        disposicionId: item.disposicionId,
        desenlace,
      });
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeNivel nivel={item.nivel} />
            <span className="text-base font-semibold text-texto">
              {item.alertaMotivo}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-texto-suave">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primario-suave text-xs font-bold text-primario"
              >
                {item.pacienteInicial}
              </span>
              {item.pacienteNombre}
            </span>
            <span aria-hidden>·</span>
            <span>{ETIQUETA_DECISION[item.decision]}</span>
            {item.motivoEtiqueta ? (
              <>
                <span aria-hidden>·</span>
                <span>{item.motivoEtiqueta}</span>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#b45309]">
            Seguimiento a {item.diasSeguimiento} día(s) · venció el{" "}
            {fecha(item.venceEn)}
          </p>
        </div>
        <Link
          href={`/pacientes/${item.pacienteId}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primario hover:underline"
        >
          Ver ficha
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
          Desenlace observado
          <select
            value={desenlace}
            onChange={(e) => setDesenlace(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base text-texto focus:border-primario focus:outline-none"
          >
            {DESENLACES_REGISTRABLES.map((d) => (
              <option key={d} value={d}>
                {ETIQUETA_DESENLACE[d]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={enviando}
          onClick={registrar}
          className="rounded-[var(--radius-md)] bg-primario px-4 py-2 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Registrar desenlace"}
        </button>
      </div>
      {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}
    </li>
  );
}

export default function DesenlacesPendientes({
  items,
}: {
  items: DesenlacePendienteVista[];
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
        <p className="text-base text-texto-suave">
          No hay desenlaces pendientes de registrar. Cuando venza el seguimiento
          programado de una disposición sin desenlace, aparecerá aquí.
        </p>
      </section>
    );
  }

  return (
    <ul className="flex flex-col gap-3" role="list">
      {items.map((it) => (
        <Fila key={it.disposicionId} item={it} />
      ))}
    </ul>
  );
}
