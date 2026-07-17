"use client";

import { Printer } from "lucide-react";

/**
 * Barra de acciones del área del patrocinador (WP-17): botón Imprimir / Exportar
 * a PDF (usa el diálogo de impresión del navegador → "Guardar como PDF", mismo
 * patrón que los informes del panel). Se oculta en la impresión (`data-no-print`).
 */
export default function BarraExport({ titulo }: { titulo: string }) {
  return (
    <div
      data-no-print
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-4"
    >
      <span className="text-sm text-texto-suave">{titulo}</span>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primario px-5 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte"
      >
        <Printer className="h-5 w-5" aria-hidden />
        Imprimir / PDF
      </button>
    </div>
  );
}
