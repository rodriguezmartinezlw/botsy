import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  estadoVigenteConsentimientos,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import type { TipoConsentimiento } from "@/types/db";
import PanelConsentimientos, {
  type FilaHistorial,
} from "./PanelConsentimientos";

export const metadata: Metadata = {
  title: "Consentimientos",
};

/**
 * Consentimientos (WP-07, sobre la versión mínima de WP-01): muestra el texto
 * completo por tipo, el estado vigente, el historial de cambios y permite
 * otorgar/revocar con efecto inmediato. Server Component: lee el histórico
 * append-only (cliente de servidor, RLS `propio`) y delega la interacción.
 */
export default async function ConsentimientosPage() {
  let estado: Record<TipoConsentimiento, boolean> = estadoVigenteConsentimientos([]);
  let historial: FilaHistorial[] = [];

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: filas } = await supabase
        .from("consentimientos")
        .select("tipo, otorgado, version_texto, registrado_en")
        .eq("paciente_id", user.id)
        .order("registrado_en", { ascending: false });
      const lista = filas ?? [];
      estado = estadoVigenteConsentimientos(lista as FilaConsentimiento[]);
      historial = lista.map((f) => ({
        tipo: f.tipo,
        otorgado: f.otorgado,
        version: f.version_texto,
        registradoEn: f.registrado_en,
      }));
    }
  } catch {
    // Sin backend configurado: se muestran todos como no otorgados, sin historial.
  }

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Tus consentimientos"
        descripcion="Aquí controlas qué permites y qué no. Puedes leer el texto completo, ver tus cambios y retirar cada permiso cuando quieras."
        icono={<ShieldCheck className="h-6 w-6" aria-hidden />}
      />

      <PanelConsentimientos estadoInicial={estado} historial={historial} />

      <p className="text-sm text-texto-tenue">
        Estos textos son la versión genérica vigente, redactada conforme al RGPD.
        Si se actualizan, verás siempre la versión en vigor y la fecha de tu firma.
      </p>
    </div>
  );
}
