"use client";

/**
 * Gráfico de área temporal (WP-05): dolor y cognición. Recibe una serie diaria
 * `{ fecha, valor }[]` YA CALCULADA; no conoce Supabase. Reutilizable por WP-06.
 *
 * Ejes y tooltip en español (date-fns locale es). Fuente de ejes 14px (>=12px),
 * paleta del tema. Estado vacío amable si la serie no tiene ningún dato.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriePunto } from "@/lib/agregados";
import { ALTO_GRAFICO, EJE, PALETA } from "./paleta";
import { etiquetaEjeFecha, etiquetaTooltipFecha } from "./formato";
import TooltipGrafico from "./TooltipGrafico";
import EstadoVacioGrafico from "./EstadoVacioGrafico";

type GraficoAreaTemporalProps = {
  datos: SeriePunto[];
  color?: string;
  /** Máximo del eje Y (ej. 10 para escalas 0–10). `undefined` = automático. */
  maxY?: number;
  unidad?: string;
  /** Marca el punto de valor máximo (pico). */
  marcarPico?: boolean;
  mensajeVacio?: string;
  etiquetaSerie?: string;
};

export default function GraficoAreaTemporal({
  datos,
  color = PALETA.primario,
  maxY,
  unidad = "",
  marcarPico = false,
  mensajeVacio = "Aún no hay datos para mostrar aquí.",
  etiquetaSerie = "Valor",
}: GraficoAreaTemporalProps) {
  const conDato = datos.filter((p) => p.valor !== null);
  if (conDato.length === 0) {
    return <EstadoVacioGrafico mensaje={mensajeVacio} />;
  }

  // Punto de pico (máximo) para el marcador.
  let pico: SeriePunto | null = null;
  if (marcarPico) {
    for (const p of conDato) {
      if (pico === null || (p.valor ?? 0) > (pico.valor ?? 0)) pico = p;
    }
  }

  const idGradiente = `area-${color.replace("#", "")}`;

  return (
    <ResponsiveContainer width="100%" height={ALTO_GRAFICO}>
      <AreaChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <defs>
          <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={PALETA.cuadricula} vertical={false} />
        <XAxis
          dataKey="fecha"
          tickFormatter={etiquetaEjeFecha}
          tick={{ fontSize: EJE.tickFontSize, fill: EJE.color }}
          tickMargin={8}
          minTickGap={24}
          stroke={PALETA.borde}
        />
        <YAxis
          domain={maxY ? [0, maxY] : ["auto", "auto"]}
          tick={{ fontSize: EJE.tickFontSize, fill: EJE.color }}
          width={32}
          allowDecimals={false}
          stroke={PALETA.borde}
        />
        <Tooltip
          content={
            <TooltipGrafico
              formateaEtiqueta={etiquetaTooltipFecha}
              unidad={unidad}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="valor"
          name={etiquetaSerie}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${idGradiente})`}
          connectNulls
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        {pico ? (
          <ReferenceDot
            x={pico.fecha}
            y={pico.valor ?? 0}
            r={6}
            fill={PALETA.urgencia}
            stroke="#ffffff"
            strokeWidth={2}
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}
