import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BarraExport from "@/components/patrocinador/BarraExport";
import RoiVista from "@/components/patrocinador/RoiVista";
import { cargarDatosPatrocinador, fechaHoy } from "@/lib/patrocinador/cargar";

export const metadata: Metadata = {
  title: "Informe ROI del pagador",
};

/**
 * Informe ROI pagador (WP-15). Vive en el área del patrocinador y respeta el
 * k-anonimato (cohorte < 5 => sin cifras). Métricas de datos ya capturados
 * (sin ML, sin proyecciones) con las definiciones metodológicas al pie.
 * Imprimible a PDF con el patrón de los informes del panel.
 */
export default async function RoiPage() {
  const datos = await cargarDatosPatrocinador();
  if (!datos) notFound();

  return (
    <div className="flex flex-col gap-5">
      <BarraExport titulo="Informe ROI · exportable a PDF para el pagador" />
      <RoiVista patrocinador={datos.patrocinador} roi={datos.roi} hoy={fechaHoy()} />
    </div>
  );
}
