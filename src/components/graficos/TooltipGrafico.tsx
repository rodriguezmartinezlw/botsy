"use client";

/**
 * Tooltip reutilizable para los gráficos (WP-05), en español y con la estética
 * del tema. Se pasa a Recharts como elemento (`content={<TooltipGrafico … />}`);
 * Recharts inyecta en runtime `active`, `payload` y `label` vía `cloneElement`.
 * Por eso esas props se declaran opcionales. Sin dependencia de Supabase.
 */

type ItemPayload = {
  value?: number | string | null;
  name?: string | number;
  color?: string;
  dataKey?: string | number;
};

type TooltipGraficoProps = {
  // Inyectadas por Recharts en runtime:
  active?: boolean;
  payload?: ItemPayload[];
  label?: string | number;
  // Propias:
  formateaEtiqueta?: (label: string) => string;
  unidad?: string;
};

export default function TooltipGrafico({
  active,
  payload,
  label,
  formateaEtiqueta,
  unidad = "",
}: TooltipGraficoProps) {
  if (!active || !payload || payload.length === 0) return null;

  const items = payload.filter(
    (p) => p.value !== null && p.value !== undefined,
  );
  if (items.length === 0) return null;

  const etiqueta =
    typeof label === "string" && formateaEtiqueta
      ? formateaEtiqueta(label)
      : String(label ?? "");

  return (
    <div className="rounded-[var(--radius-sm)] border border-borde bg-superficie px-3 py-2 text-base shadow-sm">
      {etiqueta ? (
        <p className="mb-1 font-semibold text-texto">{etiqueta}</p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {items.map((p, i) => (
          <li key={`${p.dataKey ?? p.name ?? i}`} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: p.color ?? "currentColor" }}
            />
            <span className="text-texto-suave">
              {p.name ? `${p.name}: ` : ""}
              <span className="font-semibold text-texto">
                {p.value}
                {unidad}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
