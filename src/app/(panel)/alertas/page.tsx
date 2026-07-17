import type { Metadata } from "next";
import { Bell } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import BandejaAlertas from "@/components/panel/BandejaAlertas";
import { cargarAlertasBandeja, cargarMotivos } from "@/lib/panel/datos";

export const metadata: Metadata = {
  title: "Alertas",
};

/**
 * Bandeja de alertas del profesional (WP-06).
 *
 * Server Component: lee con el cliente de servidor (RLS de WP-01: sólo alertas
 * de sus pacientes). El componente cliente prioriza (urgencia > contactar >
 * vigilancia, luego por fecha), filtra y gestiona (vista/resuelta/descartada).
 */
export default async function AlertasPage() {
  const [alertas, motivos] = await Promise.all([
    cargarAlertasBandeja(),
    cargarMotivos(),
  ]);
  const nuevas = alertas.filter((a) => a.estado === "nueva").length;

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo={nuevas > 0 ? `Alertas (${nuevas} nuevas)` : "Alertas"}
        descripcion="Señales detectadas en los check-ins, priorizadas por nivel de escalado."
        icono={<Bell className="h-6 w-6" aria-hidden />}
      />
      <BandejaAlertas alertas={alertas} motivos={motivos} />
    </div>
  );
}
