/**
 * Tarjeta de KPI para el dashboard del patrocinador y el ROI (WP-17/WP-15).
 * Solo presentación. `valor` ya viene formateado ("—" si no hay dato).
 */
export default function TarjetaKpi({
  etiqueta,
  valor,
  sufijo,
  nota,
}: {
  etiqueta: string;
  valor: string;
  sufijo?: string;
  nota?: string;
}) {
  return (
    <div className="informe-seccion flex min-w-40 flex-1 flex-col gap-1 rounded-[var(--radius-md)] border border-borde bg-superficie p-4">
      <span className="text-sm text-texto-tenue">{etiqueta}</span>
      <span className="text-2xl font-bold text-texto">
        {valor}
        {sufijo ? <span className="text-base font-semibold text-texto-suave">{sufijo}</span> : null}
      </span>
      {nota ? <span className="text-xs text-texto-tenue">{nota}</span> : null}
    </div>
  );
}
