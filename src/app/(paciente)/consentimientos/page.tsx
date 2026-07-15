import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { TipoConsentimiento } from "@/types/db";
import PanelConsentimientos from "./PanelConsentimientos";

export const metadata: Metadata = {
  title: "Consentimientos",
};

/**
 * Consentimientos (WP-01): lee el estado vigente por tipo (último registro
 * por ser un histórico append-only) y delega la interacción en el panel.
 */
export default async function ConsentimientosPage() {
  const estado: Record<TipoConsentimiento, boolean> = {
    conversacion: false,
    voz_grabacion: false,
    voz_biomarcadores: false,
  };

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: filas } = await supabase
        .from("consentimientos")
        .select("tipo, otorgado, registrado_en")
        .eq("paciente_id", user.id)
        .order("registrado_en", { ascending: true });
      // Append-only: al recorrer en orden ascendente, el último gana.
      for (const fila of filas ?? []) {
        estado[fila.tipo] = fila.otorgado;
      }
    }
  } catch {
    // Sin backend configurado: se muestran todos como no otorgados.
  }

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Tus consentimientos"
        descripcion="Aquí controlas qué permites y qué no. Puedes otorgar o retirar cada permiso cuando quieras."
        icono={<ShieldCheck className="h-6 w-6" aria-hidden />}
      />

      <PanelConsentimientos estadoInicial={estado} />

      <p className="text-sm text-texto-tenue">
        Los textos legales definitivos están pendientes de revisión. La versión
        actual es un borrador de trabajo.
      </p>
    </div>
  );
}
