"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { Printer, Save } from "lucide-react";
import { guardarInforme } from "@/app/(panel)/pacientes/[id]/informe/acciones";

/**
 * Controles del informe (WP-07 + WP-10 ítem 3): selector de período con presets
 * (7/30/90 días), botón Imprimir y botón "Guardar informe" (persistencia
 * EXPLÍCITA: el informe se renderiza siempre, pero solo se guarda en `informes`
 * al pulsar, evitando una fila por cada recarga). Se oculta en impresión.
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
  resumen,
  modelo,
}: {
  pacienteId: string;
  desde: string;
  hasta: string;
  resumen: string | null;
  modelo: string | null;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  async function alGuardar() {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const r = await guardarInforme({ pacienteId, desde, hasta, resumen, modelo });
      if (r.ok) setGuardado(true);
      else setErrorGuardar(r.error ?? "No se pudo guardar.");
    } catch {
      setErrorGuardar("No se pudo guardar el informe.");
    } finally {
      setGuardando(false);
    }
  }

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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={alGuardar}
          disabled={guardando || guardado}
          aria-live="polite"
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 py-2.5 text-base font-semibold text-texto hover:text-primario disabled:opacity-60"
        >
          <Save className="h-5 w-5" aria-hidden />
          {guardado ? "Guardado" : guardando ? "Guardando…" : "Guardar informe"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primario px-5 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte"
        >
          <Printer className="h-5 w-5" aria-hidden />
          Imprimir
        </button>
      </div>
      {errorGuardar ? (
        <p role="alert" className="text-sm text-red-600">
          {errorGuardar}
        </p>
      ) : null}
    </div>
  );
}
