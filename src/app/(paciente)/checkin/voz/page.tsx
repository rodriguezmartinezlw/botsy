import type { Metadata } from "next";
import { Mic } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  estadoVigenteConsentimientos,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import type { VerticalPaciente } from "@/types/db";
import PantallaVoz from "./PantallaVoz";

export const metadata: Metadata = { title: "Check-in por voz" };

/**
 * Página del check-in por VOZ. Server Component: resuelve la vertical (para la
 * "recomendación del día" del cierre) y el estado vigente de consentimientos
 * (para gatear la conexión: `conversacion` es bloqueante; `voz_grabacion`
 * decide si se graba). Delega la llamada en vivo en el componente cliente, que
 * depende solo de la interfaz `VoiceSession`.
 */
export default async function CheckinVozPage() {
  let vertical: VerticalPaciente = "general";
  let consentimientos = estadoVigenteConsentimientos([]);

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: paciente } = await supabase
        .from("pacientes")
        .select("vertical")
        .eq("id", user.id)
        .maybeSingle();
      if (paciente?.vertical) vertical = paciente.vertical;

      const { data: filas } = await supabase
        .from("consentimientos")
        .select("tipo, otorgado, registrado_en")
        .eq("paciente_id", user.id);
      consentimientos = estadoVigenteConsentimientos(
        (filas ?? []) as FilaConsentimiento[],
      );
    }
  } catch {
    // Sin Supabase configurado: degradamos a 'general' y sin consentimientos.
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Habla con Botsy"
        descripcion="Cuéntame cómo te encuentras. Yo te voy preguntando lo que falte."
        icono={<Mic className="h-6 w-6" aria-hidden />}
      />
      <PantallaVoz
        vertical={vertical}
        consentimientoConversacion={consentimientos.conversacion}
        consentimientoGrabacion={consentimientos.voz_grabacion}
      />
    </div>
  );
}
