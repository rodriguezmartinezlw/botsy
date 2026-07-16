import type { SeriePunto } from "@/lib/agregados";

/**
 * Sparkline SVG autocontenido para el informe (WP-07). No usa Recharts a
 * propósito: un SVG estático con coordenadas fijas se imprime de forma fiable
 * (los gráficos con ResizeObserver pueden romperse en `@media print`). Dibuja
 * los puntos no nulos de una serie densa, con eje 0–`maxY`.
 */
export default function MiniSparkline({
  serie,
  maxY = 10,
  color = "#2563eb",
  ancho = 640,
  alto = 120,
}: {
  serie: SeriePunto[];
  maxY?: number;
  color?: string;
  ancho?: number;
  alto?: number;
}) {
  const puntos = serie
    .map((p, i) => ({ i, valor: p.valor }))
    .filter((p): p is { i: number; valor: number } => p.valor !== null);

  if (puntos.length === 0) {
    return (
      <p className="text-sm text-texto-tenue">
        Sin datos suficientes para dibujar la tendencia.
      </p>
    );
  }

  const n = serie.length;
  const padY = 8;
  const x = (i: number) =>
    n <= 1 ? ancho / 2 : (i / (n - 1)) * (ancho - 2) + 1;
  const y = (v: number) =>
    alto - padY - (Math.min(v, maxY) / maxY) * (alto - 2 * padY);

  const d = puntos
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.valor).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="h-28 w-full"
      role="img"
      aria-label="Tendencia del dolor en el período"
      preserveAspectRatio="none"
    >
      {/* Rejilla horizontal (líneas guía en 0, mitad y máximo). */}
      {[0, maxY / 2, maxY].map((v) => (
        <line
          key={v}
          x1={0}
          x2={ancho}
          y1={y(v)}
          y2={y(v)}
          stroke="#e7e2d9"
          strokeWidth={1}
        />
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {puntos.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.valor)} r={2.5} fill={color} />
      ))}
    </svg>
  );
}
