"use client";

import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { Printer } from "lucide-react";

/**
 * Controles del informe (WP-07): selector de período con presets (7/30/90 días)
 * y botón Imprimir. Se oculta en impresión (`data-no-print`, ver globals.css).
 * Cliente: navega cambiando `?desde&hasta` y dispara `window.print()`.
 */
const PRESETS = [
  { dias: 7, etiqueta: "7 días" },
  { dias: 30, etiqueta: "30 días" },
  { dias: 90, etiqueta: "90 días" },
] as const;

export default function BarraInforme({
  pacienteId,
  desde,
  hasta,
}: {
  pacienteId: string;
  desde: string;
  hasta: string;
}) {
  const router = useRouter();

  function aplicarPreset(dias: number) {
    const hoy = new Date();
    const nuevoHasta = format(hoy, "yyyy-MM-dd");
    const nuevoDesde = format(subDays(hoy, dias - 1), "yyyy-MM-dd");
    router.push(
      `/pacientes/${pacienteId}/informe?desde=${nuevoDesde}&hasta=${nuevoHasta}`,
    );
  }

  const diasActuales = Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) /
      86_400_000,
  ) + 1;

  return (
    <div
      data-no-print
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div
        role="group"
        aria-label="Período del informe"
        className="flex flex-wrap gap-2"
      >
        {PRESETS.map((p) => {
          const activo = p.dias === diasActuales;
          return (
            <button
              key={p.dias}
              type="button"
              aria-pressed={activo}
              onClick={() => aplicarPreset(p.dias)}
              className={`rounded-[var(--radius-md)] px-4 py-2 text-base font-semibold transition-colors ${
                activo
                  ? "bg-primario text-white"
                  : "border border-borde bg-superficie text-texto-suave hover:text-texto"
              }`}
            >
              Últimos {p.etiqueta}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primario px-5 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte"
      >
        <Printer className="h-5 w-5" aria-hidden />
        Imprimir
      </button>
    </div>
  );
}
