/**
 * POST /api/voz/sesion  { tipo?: 'checkin' | 'consulta' }
 *
 * Abre una sesión de conversación por VOZ (paciente autenticado). Crea o retoma
 * la sesión con `canal='voz'`, construye las instrucciones y las tools con
 * el MISMO builder de WP-02 (`toolsParaRealtime`), y pide a OpenAI un TOKEN
 * EFÍMERO con esa configuración (modelo `OPENAI_REALTIME_MODEL`, voz en español,
 * instrucciones server-side). Devuelve `{token, checkinId, consentimientos, ...}`.
 * La API key real de OpenAI NUNCA viaja al cliente (solo el token efímero).
 *
 * WP-24: `tipo` (Zod, default 'checkin'). Con 'consulta' SIEMPRE se crea una
 * fila nueva (guion de consulta: a demanda, sin checklist); con 'checkin' y el
 * día ya completado, 409 con mensaje claro.
 *
 * Next 16: autorización DENTRO del handler. Requiere consentimiento
 * `conversacion` (bloqueante) como defensa en profundidad además del guard de UI.
 */

import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  estadoVigenteConsentimientos,
  puedeConversar,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import {
  construirContexto,
  construirInstrucciones,
  construirToolsCheckin,
  fechaHoyEnZona,
  toolsParaRealtime,
} from "@/lib/ia/conversacion";
import { decidirInicioSesion } from "@/lib/ia/iniciar-sesion";
import { esquemaCuerpoIniciar } from "@/lib/ia/schemas";
import { moduloActivoPaciente } from "@/lib/programas/servidor";
import { crearSesionRealtime, maxMinutosVoz } from "@/lib/ia/realtime";

export async function POST(request: Request): Promise<Response> {
  // Cuerpo OPCIONAL (compatibilidad: sin cuerpo = check-in, como antes de WP-24).
  let cuerpo: unknown = {};
  try {
    const texto = await request.text();
    cuerpo = texto.trim().length > 0 ? (JSON.parse(texto) as unknown) : {};
  } catch {
    return respuestaError("Cuerpo de la petición no válido.", 400);
  }
  const analizado = esquemaCuerpoIniciar.safeParse(cuerpo);
  if (!analizado.success) return respuestaError("Datos no válidos.", 400);
  const { tipo } = analizado.data;

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
    const { data: filasConsent } = await supabase
      .from("consentimientos")
      .select("tipo, otorgado, registrado_en")
      .eq("paciente_id", user.id);
    const consentimientos = estadoVigenteConsentimientos(
      (filasConsent ?? []) as FilaConsentimiento[],
    );

    // Consentimiento de conversación: bloqueante.
    if (!puedeConversar(consentimientos)) {
      return respuestaError(
        "Necesitas aceptar el registro de conversaciones para usar el modo voz.",
        403,
      );
    }

    // Gating server-side (WP-11 v2 §A.3): si el programa del paciente desactiva
    // el módulo de voz, la ruta lo bloquea aunque se llame directamente.
    if (!(await moduloActivoPaciente(supabase, user.id, "voz"))) {
      return respuestaError(
        "El check-in por voz no está disponible en tu programa.",
        403,
      );
    }

    const fecha = fechaHoyEnZona(perfil.zona_horaria ?? "Europe/Madrid");

    // El check-in ESTRUCTURADO de hoy (si existe). Desde WP-24 conviven varias
    // filas por fecha (check-in + consultas): el filtro por tipo es
    // imprescindible para que maybeSingle() no falle.
    const { data: checkinHoy } = await supabase
      .from("checkins")
      .select("id, estado")
      .eq("paciente_id", user.id)
      .eq("fecha", fecha)
      .eq("tipo", "checkin")
      .maybeSingle();

    const decision = decidirInicioSesion(tipo, checkinHoy ?? null);
    if (decision.accion === "rechazar") {
      return respuestaError(decision.error, decision.estado);
    }

    let checkin: { id: string; estado: string };
    if (decision.accion === "crear") {
      const { data: creado, error } = await supabase
        .from("checkins")
        .insert({
          paciente_id: user.id,
          fecha,
          tipo: decision.tipo,
          canal: "voz",
          estado: "en_curso",
        })
        .select("id, estado")
        .single();
      if (error || !creado) {
        if (decision.tipo === "consulta") {
          // Las consultas no tienen unicidad: un fallo aquí es un fallo real.
          return respuestaError("No se pudo iniciar la conversación.", 500);
        }
        // Posible carrera con otra pestaña (índice único parcial del check-in
        // diario): reintentar la lectura.
        const { data: reintento } = await supabase
          .from("checkins")
          .select("id, estado")
          .eq("paciente_id", user.id)
          .eq("fecha", fecha)
          .eq("tipo", "checkin")
          .maybeSingle();
        if (!reintento) return respuestaError("No se pudo iniciar el check-in.", 500);
        checkin = reintento;
      } else {
        checkin = creado;
      }
    } else {
      checkin = { id: decision.checkinId, estado: checkinHoy?.estado ?? "en_curso" };
    }

    if (checkin.estado !== "en_curso") {
      return respuestaError(
        "Ya completaste tu check-in de hoy. Puedes abrir una conversación cuando quieras.",
        409,
      );
    }

    // Instrucciones + tools con el builder compartido de WP-02. En modo
    // consulta (WP-24) el guion es el de a demanda (sin checklist) y el
    // termómetro NO se administra (es parte del check-in estructurado).
    const contexto = await construirContexto(user.id, tipo);
    const instrucciones = construirInstrucciones(contexto);
    const tools = toolsParaRealtime(
      construirToolsCheckin({
        instrumento:
          tipo === "checkin" && contexto.instrumento?.administrar === true,
      }),
    );

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
      tipo,
      pacienteId: user.id,
      fecha,
      maxMinutos: maxMinutosVoz(),
      consentimientos,
    });
  } catch {
    return respuestaError("No se pudo iniciar la sesión de voz.", 500);
  }
}
