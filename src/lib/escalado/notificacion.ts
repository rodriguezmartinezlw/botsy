/**
 * Notificación INMEDIATA al profesional ante una alerta de URGENCIA (WP-10 ítem
 * 5, cierre de RF-ES-03). Se dispara SOLO cuando se materializa una alerta nueva
 * de nivel `urgencia`; por eso es idempotente (una vez por alerta). Best-effort:
 * un fallo de email NUNCA rompe el escalado.
 *
 * El email es SOBRIO y sin datos clínicos: ni el asunto ni el cuerpo revelan
 * diagnóstico, síntoma ni nombre del paciente; solo dirigen a la bandeja.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos } from "@/types/db";

type ClienteBD = SupabaseClient<BaseDatos>;

export function baseUrlApp(): string {
  const raw = process.env.APP_URL;
  return raw && raw.trim().length > 0
    ? raw.replace(/\/$/, "")
    : "https://botsy.app";
}

/** Plantilla del email de aviso al profesional (sin contenido clínico). */
export function plantillaUrgenciaProfesional(baseUrl: string): {
  asunto: string;
  html: string;
  texto: string;
} {
  const url = `${baseUrl}/alertas`;
  const asunto = "Botsy · Tienes una alerta que requiere tu atención";
  const cuerpo =
    "Se ha registrado una alerta de nivel urgente para uno de tus pacientes. " +
    "Revísala cuanto antes en tu bandeja de alertas.";
  return {
    asunto,
    texto: `${cuerpo}\n\n${url}`,
    html: `<p>${cuerpo}</p><p><a href="${url}">Abrir mi bandeja de alertas</a></p>`,
  };
}

/**
 * Envía el aviso al profesional asignado al paciente. Best-effort: cualquier
 * fallo (sin profesional, sin email, Resend caído) se traga silenciosamente
 * (queda la alerta en la bandeja igualmente). Registra la emisión en auditoría.
 */
export async function notificarUrgenciaProfesional(
  supabase: ClienteBD,
  pacienteId: string,
  checkinId: string,
): Promise<void> {
  try {
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("profesional_id")
      .eq("id", pacienteId)
      .maybeSingle();
    const profesionalId = paciente?.profesional_id;
    if (!profesionalId) return; // sin profesional asignado: nada que enviar

    const { data: usuario } = await supabase.auth.admin.getUserById(profesionalId);
    const email = usuario?.user?.email;
    if (!email) return;

    const { enviarEmailResend } = await import("@/lib/recordatorios/email");
    const plantilla = plantillaUrgenciaProfesional(baseUrlApp());
    await enviarEmailResend({ para: email, ...plantilla });

    await supabase.from("eventos_auditoria").insert({
      actor_id: null, // sistema (motor de escalado, service-role)
      accion: "notificacion_urgencia_enviada",
      entidad: "checkins",
      entidad_id: checkinId,
      detalle: { profesional_id: profesionalId },
    });
  } catch {
    // best-effort: el aviso por email no puede tumbar el escalado.
  }
}
