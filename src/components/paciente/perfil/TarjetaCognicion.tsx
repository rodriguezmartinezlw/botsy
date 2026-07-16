"use client";

import { useMemo, useState } from "react";
import { Brain, ChevronLeft, ChevronRight } from "lucide-react";
import GraficoAreaTemporal from "@/components/graficos/GraficoAreaTemporal";
import { etiquetaEjeFecha } from "@/components/graficos/formato";
import { PALETA } from "@/components/graficos/paleta";
import TarjetaPerfil from "./TarjetaPerfil";
import type { SeriePunto } from "@/lib/agregados";

/**
 * Tarjeta de Cognición (WP-05): área con selector de fecha (concepto del deck).
 * Recibe la serie diaria YA CALCULADA. Si no hay ninguna observación de
 * cognición, muestra "Aún estamos conociéndote" (los datos llegan de las
 * preguntas ligeras del check-in). Cliente por el selector de ventana.
 */
const TAM_VENTANA = 14; // días visibles por ventana
const PASO = 7;

export default function TarjetaCognicion({
  cognicion,
}: {
  cognicion: SeriePunto[];
}) {
  const hayDatos = cognicion.some((p) => p.valor !== null);
  // Índice del último día de la ventana (por defecto, el más reciente).
  const [fin, setFin] = useState(Math.max(0, cognicion.length - 1));

  const ventana = useMemo(() => {
    const finClamp = Math.min(Math.max(fin, TAM_VENTANA - 1), cognicion.length - 1);
    const inicio = Math.max(0, finClamp - (TAM_VENTANA - 1));
    return cognicion.slice(inicio, finClamp + 1);
  }, [cognicion, fin]);

  if (!hayDatos) {
    return (
      <TarjetaPerfil
        titulo="Cognición"
        icono={<Brain className="h-5 w-5" aria-hidden />}
      >
        <div
          className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-superficie-suave px-4 py-8 text-center"
          role="status"
        >
          <Brain className="h-8 w-8 text-texto-tenue" aria-hidden />
          <p className="text-lg font-semibold text-texto">
            Aún estamos conociéndote
          </p>
          <p className="text-base text-texto-suave">
            Con las preguntas ligeras de tus check-ins iremos dibujando aquí tu
            evolución. No hay nada que te preocupe.
          </p>
        </div>
      </TarjetaPerfil>
    );
  }

  const puedeRetroceder = fin > TAM_VENTANA - 1;
  const puedeAvanzar = fin < cognicion.length - 1;
  const rango =
    ventana.length > 0
      ? `${etiquetaEjeFecha(ventana[0].fecha)} – ${etiquetaEjeFecha(
          ventana[ventana.length - 1].fecha,
        )}`
      : "";

  return (
    <TarjetaPerfil
      titulo="Cognición"
      icono={<Brain className="h-5 w-5" aria-hidden />}
      extra={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFin((f) => Math.max(TAM_VENTANA - 1, f - PASO))}
            disabled={!puedeRetroceder}
            aria-label="Período anterior"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-borde text-texto-suave disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="min-w-[7rem] text-center text-sm text-texto-tenue">
            {rango}
          </span>
          <button
            type="button"
            onClick={() =>
              setFin((f) => Math.min(cognicion.length - 1, f + PASO))
            }
            disabled={!puedeAvanzar}
            aria-label="Período siguiente"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-borde text-texto-suave disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      }
    >
      <GraficoAreaTemporal
        datos={ventana}
        color={PALETA.cognicion}
        etiquetaSerie="Cognición"
        mensajeVacio="No hay datos de cognición en este período."
      />
    </TarjetaPerfil>
  );
}
