/**
 * POST /api/voz/sesion
 *
 * Abre una sesión de check-in por VOZ (paciente autenticado). Crea o retoma el
 * check-in de HOY con `canal='voz'`, construye las instrucciones y las tools con
 * el MISMO builder de WP-02 (`toolsParaRealtime`), y pide a OpenAI un TOKEN
 * EFÍMERO con esa configuración (modelo `OPENAI_REALTIME_MODEL`, voz en español,
 * instrucciones server-side). Devuelve `{token, checkinId, consentimientos, ...}`.
 * La API key real de OpenAI NUNCA viaja al cliente (solo el token efímero).
 *
 * Next 16: autorización DENTRO del handler. Requiere consentimiento
 * `conversacion` (bloqueante) como defensa en profundidad además del guard de UI.
 */

import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { TipoConsentimiento } from "@/types/db";
import {
  construirContexto,
  construirInstrucciones,
  fechaHoyEnZona,
  toolsParaRealtime,
} from "@/lib/ia/conversacion";
import { crearSesionRealtime, maxMinutosVoz } from "@/lib/ia/realtime";

export async function POST(): Promise<Response> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return respuestaError("No has iniciado sesión.", 401);

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol, zona_horaria")
      .eq("id", user.id)
      .maybeSingle();
    if (!perfil || perfil.rol !== "paciente") {
      return respuestaError("Solo los pacientes pueden hacer check-in.", 403);
    }

    // Estado vigente de consentimientos (histórico append-only: último por tipo).
    const consentimientos: Record<TipoConsentimiento, boolean> = {
      conversacion: false,
      voz_grabacion: false,
      voz_biomarcadores: false,
    };
    const { data: filasConsent } = await supabase
      .from("consentimientos")
      .select("tipo, otorgado, registrado_en")
      .eq("paciente_id", user.id)
      .order("registrado_en", { ascending: true });
    for (const fila of filasConsent ?? []) consentimientos[fila.tipo] = fila.otorgado;

    // Consentimiento de conversación: bloqueante.
    if (!consentimientos.conversacion) {
      return respuestaError(
        "Necesitas aceptar el registro de conversaciones para usar el modo voz.",
        403,
      );
    }

    const fecha = fechaHoyEnZona(perfil.zona_horaria ?? "Europe/Madrid");

    // Crear o retomar el check-in de hoy (canal voz).
    let { data: checkin } = await supabase
      .from("checkins")
      .select("id, estado")
      .eq("paciente_id", user.id)
      .eq("fecha", fecha)
      .maybeSingle();

    if (!checkin) {
      const { data: creado, error } = await supabase
        .from("checkins")
        .insert({
          paciente_id: user.id,
          fecha,
          canal: "voz",
          estado: "en_curso",
        })
        .select("id, estado")
        .single();
      if (error || !creado) {
        // Posible carrera con otra pestaña: reintentar la lectura.
        const { data: reintento } = await supabase
          .from("checkins")
          .select("id, estado")
          .eq("paciente_id", user.id)
          .eq("fecha", fecha)
          .maybeSingle();
        if (!reintento) return respuestaError("No se pudo iniciar el check-in.", 500);
        checkin = reintento;
      } else {
        checkin = creado;
      }
    }

    if (checkin.estado !== "en_curso") {
      return respuestaError("Tu check-in de hoy ya está cerrado.", 409);
    }

    // Instrucciones + tools con el builder compartido de WP-02.
    const contexto = await construirContexto(user.id);
    const instrucciones = construirInstrucciones(contexto);
    const tools = toolsParaRealtime();

    // Token efímero (server-side). Si falta la API key o el proveedor falla,
    // se traduce a un 503 amable (la UI ofrece el modo texto como alternativa).
    let sesion;
    try {
      sesion = await crearSesionRealtime({ instrucciones, tools });
    } catch {
      return respuestaError(
        "El modo voz no está disponible ahora mismo. Puedes usar el chat de texto.",
        503,
      );
    }

    return respuestaOk({
      token: sesion.token,
      modelo: sesion.modelo,
      checkinId: checkin.id,
      pacienteId: user.id,
      fecha,
      maxMinutos: maxMinutosVoz(),
      consentimientos,
    });
  } catch {
    return respuestaError("No se pudo iniciar la sesión de voz.", 500);
  }
}
