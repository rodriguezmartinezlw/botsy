import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import DesenlacesPendientes from "@/components/panel/DesenlacesPendientes";
import { cargarDesenlacesPendientes } from "@/lib/panel/datos";

export const metadata: Metadata = {
  title: "Desenlaces pendientes",
};

/**
 * Desenlaces pendientes (WP-11 v2 §B.3): disposiciones cuyo seguimiento venció
 * y siguen sin desenlace registrado. Cerrar el bucle de la disposición es lo que
 * convierte cada alerta en un dato de resultado (activo de datos).
 *
 * Server Component: lee con el cliente de servidor (RLS: sólo disposiciones de
 * alertas de sus pacientes).
 */
export default async function DesenlacesPage() {
  const items = await cargarDesenlacesPendientes();

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo={
          items.length > 0
            ? `Desenlaces pendientes (${items.length})`
            : "Desenlaces pendientes"
        }
        descripcion="Seguimientos vencidos cuya disposición aún no tiene desenlace. Registrarlo cierra el seguimiento."
        icono={<ClipboardCheck className="h-6 w-6" aria-hidden />}
      />
      <DesenlacesPendientes items={items} />
    </div>
  );
}
