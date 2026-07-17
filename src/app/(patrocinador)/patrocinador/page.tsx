import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import CohorteBloque from "@/components/patrocinador/CohorteBloque";
import BarraExport from "@/components/patrocinador/BarraExport";
import { cargarDatosPatrocinador } from "@/lib/patrocinador/cargar";

export const metadata: Metadata = {
  title: "Dashboard del patrocinador",
};

/**
 * Dashboard del patrocinador (WP-17). SOLO agregados pseudonimizados con
 * k-anonimato >= 5. Cero datos identificables (garantía real: RLS 0009 + RPC
 * 0010). Persistencia, meses en tratamiento, adherencia, motivos de
 * discontinuación, tasa de check-in, alertas por nivel y tiempo hasta
 * disposición — por cohorte financiada. Imprimible a PDF.
 */
export default async function DashboardPatrocinadorPage() {
  const datos = await cargarDatosPatrocinador();
  if (!datos) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-texto">
          Dashboard del patrocinador
        </h1>
        <p className="text-base text-texto-suave">
          {datos.patrocinador}. Agregados pseudonimizados de las cohortes que
          financia. No se muestran datos identificables de pacientes; todo corte
          con menos de 5 pacientes se omite (k-anonimato ≥ 5).
        </p>
      </header>

      <BarraExport titulo="Vista agregada · exportable a PDF para la reunión" />

      <CohorteBloque cohorte={datos.combinado} />

      <section className="flex flex-col gap-6 border-t border-borde pt-6">
        <h2 className="text-xl font-bold text-texto">Por programa financiado</h2>
        {datos.programas.map((c) => (
          <CohorteBloque key={c.clave} cohorte={c} />
        ))}
      </section>

      <Link
        href="/patrocinador/roi"
        data-no-print
        className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 py-2.5 text-base font-semibold text-primario hover:bg-superficie-suave"
      >
        Ver informe ROI del pagador
        <ArrowRight className="h-5 w-5" aria-hidden />
      </Link>

      <footer className="flex flex-col gap-1 border-t border-borde pt-4 text-sm text-texto-tenue">
        <p className="font-medium">
          Documento agregado de seguimiento generado por Botsy. No constituye
          diagnóstico, predicción ni triaje autónomo.
        </p>
        <p>
          [PENDIENTE LEGAL] Datos pseudonimizados con k-anonimato ≥ 5. El
          patrocinador no accede en ningún caso a datos identificables de
          pacientes; el escalado lo realiza el equipo clínico mediante reglas que
          configura.
        </p>
      </footer>
    </div>
  );
}
