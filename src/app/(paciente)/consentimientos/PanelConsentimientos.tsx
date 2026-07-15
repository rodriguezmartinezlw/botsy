"use client";

import { useState, useTransition } from "react";
import type { TipoConsentimiento } from "@/types/db";
import { registrarConsentimiento } from "./acciones";
import { VERSION_TEXTO_CONSENTIMIENTO } from "./constantes";

type EstadoConsentimientos = Record<TipoConsentimiento, boolean>;

const CONSENTIMIENTOS: {
  tipo: TipoConsentimiento;
  titulo: string;
  descripcion: string;
}[] = [
  {
    tipo: "conversacion",
    titulo: "Registro de conversaciones",
    descripcion:
      "Permites que Botsy guarde el texto de tus check-ins para hacer tu seguimiento y compartirlo con tu profesional.",
  },
  {
    tipo: "voz_grabacion",
    titulo: "Grabación de voz",
    descripcion:
      "Permites grabar el audio de tus check-ins por voz. Podrás retirar este permiso cuando quieras.",
  },
  {
    tipo: "voz_biomarcadores",
    titulo: "Análisis de biomarcadores de voz",
    descripcion:
      "Permites, de cara al futuro, analizar rasgos de tu voz como apoyo al seguimiento. No está activo todavía.",
  },
];

/**
 * Panel de consentimientos: 3 permisos con interruptor. Cada cambio registra
 * una nueva fila (histórico append-only) mediante una Server Action.
 */
export default function PanelConsentimientos({
  estadoInicial,
}: {
  estadoInicial: EstadoConsentimientos;
}) {
  const [estado, setEstado] = useState<EstadoConsentimientos>(estadoInicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<TipoConsentimiento | null>(null);
  const [, iniciarTransicion] = useTransition();

  function alternar(tipo: TipoConsentimiento) {
    const nuevoValor = !estado[tipo];
    setError(null);
    setPendiente(tipo);
    // Optimista: reflejamos el cambio y revertimos si falla.
    setEstado((prev) => ({ ...prev, [tipo]: nuevoValor }));

    iniciarTransicion(async () => {
      const resultado = await registrarConsentimiento({
        tipo,
        otorgado: nuevoValor,
      });
      if (!resultado.ok) {
        setEstado((prev) => ({ ...prev, [tipo]: !nuevoValor }));
        setError(resultado.error);
      }
      setPendiente(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-base font-medium text-urgencia">
          {error}
        </p>
      ) : null}

      {CONSENTIMIENTOS.map(({ tipo, titulo, descripcion }) => {
        const otorgado = estado[tipo];
        const guardando = pendiente === tipo;
        return (
          <section
            key={tipo}
            className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
                <p className="text-base text-texto-suave">{descripcion}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={otorgado}
                aria-label={`${otorgado ? "Retirar" : "Otorgar"} permiso: ${titulo}`}
                disabled={guardando}
                onClick={() => alternar(tipo)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  otorgado ? "bg-acento" : "bg-borde"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    otorgado ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-medium text-texto">
                {otorgado ? "Otorgado" : "No otorgado"}
                {guardando ? " · guardando…" : ""}
              </span>
              <span className="text-sm text-texto-tenue">
                [PENDIENTE LEGAL] · {VERSION_TEXTO_CONSENTIMIENTO}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
