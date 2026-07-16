"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bell,
  ChevronDown,
  MessageSquare,
  Mic,
  Pill,
  ShieldCheck,
} from "lucide-react";
import type {
  ItemAlerta,
  ItemCheckin,
  ItemConsentimiento,
  ItemMedicacion,
  ItemTimeline,
} from "@/lib/panel/tipos";
import BadgeNivel from "../BadgeNivel";
import EvidenciaAlerta from "../EvidenciaAlerta";

const POR_PAGINA = 12;

function fechaHora(ts: string): string {
  try {
    return format(parseISO(ts), "d MMM yyyy · HH:mm", { locale: es });
  } catch {
    return ts;
  }
}

function Fila({
  icono,
  color,
  titulo,
  subtitulo,
  ts,
  expandible,
  children,
}: {
  icono: React.ReactNode;
  color: string;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  ts: string;
  expandible?: boolean;
  children?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <li className="relative flex gap-3 pl-2">
      <span
        aria-hidden
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        {icono}
      </span>
      <div className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-borde bg-superficie p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-semibold text-texto">{titulo}</div>
            {subtitulo ? (
              <div className="text-sm text-texto-suave">{subtitulo}</div>
            ) : null}
          </div>
          <time className="shrink-0 text-sm text-texto-tenue">{fechaHora(ts)}</time>
        </div>
        {expandible && children ? (
          <>
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              aria-expanded={abierto}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primario hover:underline"
            >
              {abierto ? "Ocultar detalle" : "Ver detalle"}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {abierto ? <div className="mt-3">{children}</div> : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

function DetalleCheckin({ item }: { item: ItemCheckin }) {
  if (item.mensajes.length === 0) {
    return (
      <p className="text-sm text-texto-suave">
        Este check-in no tiene transcripción guardada.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {item.mensajes.map((m, i) => (
        <div
          key={i}
          className={`max-w-[85%] rounded-[var(--radius-md)] px-3 py-2 text-sm ${
            m.rol === "paciente"
              ? "self-end bg-primario-suave text-texto"
              : "self-start bg-superficie-suave text-texto-suave"
          }`}
        >
          <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-texto-tenue">
            {m.rol === "paciente" ? "Paciente" : "Botsy"}
          </span>
          {m.contenido}
        </div>
      ))}
    </div>
  );
}

const CANAL_ETIQUETA = { texto: "Check-in por texto", voz: "Check-in por voz" } as const;

const TIPO_CONSENTIMIENTO = {
  conversacion: "conversación",
  voz_grabacion: "grabación de voz",
  voz_biomarcadores: "biomarcadores de voz",
} as const;

function FilaItem({ item }: { item: ItemTimeline }) {
  switch (item.tipo) {
    case "checkin": {
      const c = item as ItemCheckin;
      return (
        <Fila
          icono={c.canal === "voz" ? <Mic className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          color="#2563eb"
          titulo={c.canal ? CANAL_ETIQUETA[c.canal] : "Check-in"}
          subtitulo={c.resumen ?? undefined}
          ts={c.ts}
          expandible
        >
          <DetalleCheckin item={c} />
        </Fila>
      );
    }
    case "alerta": {
      const a = item as ItemAlerta;
      return (
        <Fila
          icono={<Bell className="h-4 w-4" />}
          color="#dc2626"
          titulo={
            <span className="inline-flex items-center gap-2">
              {a.motivo}
              <BadgeNivel nivel={a.nivel} />
            </span>
          }
          subtitulo={`Estado: ${a.estado}`}
          ts={a.ts}
          expandible
        >
          <EvidenciaAlerta evidencia={a.evidencia} />
        </Fila>
      );
    }
    case "medicacion": {
      const m = item as ItemMedicacion;
      const esBaja = m.evento === "baja";
      return (
        <Fila
          icono={<Pill className="h-4 w-4" />}
          color={esBaja ? "#6B7280" : "#059669"}
          titulo={`${esBaja ? "Pauta desactivada" : "Pauta"}: ${m.farmaco}${m.dosis ? ` · ${m.dosis}` : ""}`}
          subtitulo={
            esBaja
              ? "Se dio de baja esta pauta"
              : `${m.critica ? "Medicación importante · " : ""}${m.activa ? "activa" : "desactivada"}`
          }
          ts={m.ts}
        />
      );
    }
    case "consentimiento": {
      const c = item as ItemConsentimiento;
      return (
        <Fila
          icono={<ShieldCheck className="h-4 w-4" />}
          color="#7c3aed"
          titulo={`Consentimiento de ${TIPO_CONSENTIMIENTO[c.tipoConsentimiento]}`}
          subtitulo={c.otorgado ? "Otorgado" : "Revocado"}
          ts={c.ts}
        />
      );
    }
  }
}

export default function LineaTemporal({ items }: { items: ItemTimeline[] }) {
  const [visibles, setVisibles] = useState(POR_PAGINA);

  if (items.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-6 text-base text-texto-suave">
        Aún no hay actividad registrada para este paciente.
      </p>
    );
  }

  const mostrados = items.slice(0, visibles);

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3" role="list">
        {mostrados.map((item) => (
          <FilaItem key={`${item.tipo}-${item.id}`} item={item} />
        ))}
      </ol>
      {visibles < items.length ? (
        <button
          type="button"
          onClick={() => setVisibles((v) => v + POR_PAGINA)}
          className="mx-auto rounded-[var(--radius-md)] border border-borde bg-superficie px-4 py-2.5 text-base font-semibold text-primario hover:bg-superficie-suave"
        >
          Ver más ({items.length - visibles} restantes)
        </button>
      ) : null}
    </div>
  );
}
