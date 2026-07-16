import type { ReactNode } from "react";

type EstadoVacioGraficoProps = {
  mensaje: string;
  icono?: ReactNode;
};

/**
 * Estado vacío amable para una tarjeta de gráfico sin datos (WP-05).
 * Tono calmado, no alarmista. Texto legible (>=16px). Reutilizable por WP-06.
 */
export default function EstadoVacioGrafico({
  mensaje,
  icono,
}: EstadoVacioGraficoProps) {
  return (
    <div
      className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-superficie-suave px-4 py-8 text-center"
      role="status"
    >
      {icono ? (
        <span className="text-texto-tenue" aria-hidden>
          {icono}
        </span>
      ) : null}
      <p className="text-base text-texto-suave">{mensaje}</p>
    </div>
  );
}
