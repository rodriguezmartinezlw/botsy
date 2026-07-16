"use client";

/**
 * Gráfico de líneas múltiples (WP-05): ánimo / ansiedad / estrés (0–10). Recibe
 * las series YA CALCULADAS; no conoce Supabase. Reutilizable por WP-06.
 *
 * Cada línea se define con `dataKey`, `nombre` (leyenda/tooltip en español) y
 * `color`. Sólo se dibujan las líneas que tienen algún dato. Estado vacío amable
 * si ninguna serie tiene datos.
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ALTO_GRAFICO, EJE, PALETA } from "./paleta";
import { etiquetaEjeFecha, etiquetaTooltipFecha } from "./formato";
import TooltipGrafico from "./TooltipGrafico";
import EstadoVacioGrafico from "./EstadoVacioGrafico";

export type LineaConfig = {
  dataKey: string;
  nombre: string;
  color: string;
};

type FilaGenerica = { fecha: string } & Record<string, number | null | string>;

type GraficoLineasProps = {
  datos: FilaGenerica[];
  lineas: LineaConfig[];
  maxY?: number;
  unidad?: string;
  mensajeVacio?: string;
};

export default function GraficoLineas({
  datos,
  lineas,
  maxY = 10,
  unidad = "",
  mensajeVacio = "Aún no hay datos para mostrar aquí.",
}: GraficoLineasProps) {
  // Sólo líneas con al menos un valor numérico.
  const lineasConDatos = lineas.filter((l) =>
    datos.some((fila) => typeof fila[l.dataKey] === "number"),
  );

  if (lineasConDatos.length === 0) {
    return <EstadoVacioGrafico mensaje={mensajeVacio} />;
  }

  return (
    <ResponsiveContainer width="100%" height={ALTO_GRAFICO}>
      <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
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
          domain={[0, maxY]}
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
        <Legend
          wrapperStyle={{ fontSize: 15, color: PALETA.textoSuave, paddingTop: 8 }}
        />
        {lineasConDatos.map((l) => (
          <Line
            key={l.dataKey}
            type="monotone"
            dataKey={l.dataKey}
            name={l.nombre}
            stroke={l.color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: l.color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
