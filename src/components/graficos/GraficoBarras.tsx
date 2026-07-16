"use client";

/**
 * Gráfico de barras (WP-05): sueño y evolución mensual de adherencia. Recibe
 * `{ etiqueta, valor }[]` YA CALCULADO; no conoce Supabase. Reutilizable WP-06.
 *
 * Eje X con la etiqueta ya formateada por el llamador (fecha o mes). Fuente de
 * ejes 14px, paleta del tema. Estado vacío amable si no hay barras.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoBarra } from "@/lib/agregados";
import { ALTO_GRAFICO, EJE, PALETA } from "./paleta";
import TooltipGrafico from "./TooltipGrafico";
import EstadoVacioGrafico from "./EstadoVacioGrafico";

type GraficoBarrasProps = {
  datos: PuntoBarra[];
  color?: string;
  maxY?: number;
  unidad?: string;
  /** Muestra el valor encima de cada barra. */
  mostrarValores?: boolean;
  nombreSerie?: string;
  mensajeVacio?: string;
};

export default function GraficoBarras({
  datos,
  color = PALETA.acento,
  maxY,
  unidad = "",
  mostrarValores = false,
  nombreSerie = "Valor",
  mensajeVacio = "Aún no hay datos para mostrar aquí.",
}: GraficoBarrasProps) {
  if (datos.length === 0) {
    return <EstadoVacioGrafico mensaje={mensajeVacio} />;
  }

  return (
    <ResponsiveContainer width="100%" height={ALTO_GRAFICO}>
      <BarChart data={datos} margin={{ top: 16, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={PALETA.cuadricula} vertical={false} />
        <XAxis
          dataKey="etiqueta"
          tick={{ fontSize: EJE.tickFontSize, fill: EJE.color }}
          tickMargin={8}
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
          cursor={{ fill: PALETA.primarioSuave, opacity: 0.4 }}
          content={<TooltipGrafico unidad={unidad} />}
        />
        <Bar
          dataKey="valor"
          name={nombreSerie}
          fill={color}
          radius={[6, 6, 0, 0]}
          maxBarSize={56}
          isAnimationActive={false}
        >
          {datos.map((d, i) => (
            <Cell key={`${d.etiqueta}-${i}`} fill={color} />
          ))}
          {mostrarValores ? (
            <LabelList
              dataKey="valor"
              position="top"
              style={{ fontSize: 13, fill: PALETA.textoSuave }}
              formatter={(v) => `${v ?? ""}${unidad}`}
            />
          ) : null}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
