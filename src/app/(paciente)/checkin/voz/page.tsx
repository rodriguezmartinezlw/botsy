import type { Metadata } from "next";
import { Mic } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  estadoVigenteConsentimientos,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";
import type { TipoCheckin, VerticalPaciente } from "@/types/db";
import PantallaVoz from "./PantallaVoz";

export const metadata: Metadata = { title: "Check-in por voz" };

/**
 * Página del check-in por VOZ. Server Component: resuelve la vertical (para la
 * "recomendación del día" del cierre), el estado vigente de consentimientos
 * (para gatear la conexión: `conversacion` es bloqueante; `voz_grabacion`
 * decide si se graba) y el TIPO de sesión (WP-24): con `?tipo=consulta` o con
 * el check-in de hoy ya completado, la llamada abre una CONSULTA a demanda en
 * vez de bloquear. Delega la llamada en vivo en el componente cliente.
 */
export default async function CheckinVozPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  let vertical: VerticalPaciente = "general";
  let consentimientos = estadoVigenteConsentimientos([]);
  let checkinHoyCompletado = false;

  const sp = await searchParams;

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

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("zona_horaria")
        .eq("id", user.id)
        .maybeSingle();
      const fecha = fechaHoyEnZona(perfil?.zona_horaria ?? "Europe/Madrid");

      // Solo el check-in ESTRUCTURADO de hoy (WP-24: conviven consultas en la
      // misma fecha; sin el filtro por tipo, maybeSingle() fallaría).
      const { data: checkin } = await supabase
        .from("checkins")
        .select("estado")
        .eq("paciente_id", user.id)
        .eq("fecha", fecha)
        .eq("tipo", "checkin")
        .maybeSingle();
      checkinHoyCompletado = checkin?.estado === "completado";
    }
  } catch {
    // Sin Supabase configurado: degradamos a 'general' y sin consentimientos.
  }

  // Con el día completado NO se bloquea: se ofrece una conversación (consulta).
  const tipo: TipoCheckin =
    sp.tipo === "consulta" || checkinHoyCompletado ? "consulta" : "checkin";
  const esConsulta = tipo === "consulta";

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Habla con Botsy"
        descripcion={
          esConsulta
            ? "Cuéntame lo que necesites, a cualquier hora."
            : "Cuéntame cómo te encuentras. Yo te voy preguntando lo que falte."
        }
        icono={<Mic className="h-6 w-6" aria-hidden />}
      />
      <PantallaVoz
        vertical={vertical}
        tipo={tipo}
        consentimientoConversacion={consentimientos.conversacion}
        consentimientoGrabacion={consentimientos.voz_grabacion}
      />
    </div>
  );
}
