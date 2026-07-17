/**
 * POST /api/checkin/iniciar  { tipo?: 'checkin' | 'consulta' }
 *
 * Crea (o retoma) la sesión de conversación por TEXTO del paciente autenticado
 * y devuelve su id + el historial de mensajes (con la apertura si es nueva).
 *
 * WP-24: `tipo` (Zod, default 'checkin') decide la sesión:
 *  - 'checkin'  : el check-in estructurado de HOY (máx. 1/día). Si ya está
 *    completado, 409 con mensaje claro (la UI enruta sola a la consulta).
 *  - 'consulta' : conversación a demanda — SIEMPRE crea una fila nueva, aunque
 *    el check-in de hoy esté completado o haya otras consultas.
 *
 * Next 16: la autorización se comprueba DENTRO del handler (el middleware no
 * intercepta /api). Sesión obligatoria con rol paciente.
 */

import type {
  CanalCheckin,
  EstadoCheckin,
  Json,
  NivelRiesgo,
  TipoCheckin,
} from "@/types/db";
import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  estadoVigenteConsentimientos,
  puedeConversar,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import {
  construirApertura,
  construirContexto,
  fechaHoyEnZona,
  parsearDominiosCubiertos,
} from "@/lib/ia/conversacion";
import { decidirInicioSesion } from "@/lib/ia/iniciar-sesion";
import { esquemaCuerpoIniciar } from "@/lib/ia/schemas";
import { moduloActivoPaciente } from "@/lib/programas/servidor";

/** Columnas de la sesión que devuelve este endpoint. */
type FilaSesion = {
  id: string;
  tipo: TipoCheckin;
  estado: EstadoCheckin;
  canal: CanalCheckin | null;
  riesgo: NivelRiesgo | null;
  dominios_cubiertos: Json;
};

const COLUMNAS_SESION = "id, tipo, estado, canal, riesgo, dominios_cubiertos";

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

    // Consentimiento `conversacion`: bloqueante para iniciar cualquier sesión
    // (defensa en profundidad además del interstitial de UI). Sin él no se
    // puede conversar, tampoco en modo consulta.
    const { data: filasConsent } = await supabase
      .from("consentimientos")
      .select("tipo, otorgado, registrado_en")
      .eq("paciente_id", user.id);
    const estadoConsent = estadoVigenteConsentimientos(
      (filasConsent ?? []) as FilaConsentimiento[],
    );
    if (!puedeConversar(estadoConsent)) {
      return respuestaError(
        "Necesitas aceptar el registro de conversaciones para hablar conmigo.",
        403,
      );
    }

    // Gating server-side (WP-11 v2 §A.3): módulo de texto del programa.
    if (!(await moduloActivoPaciente(supabase, user.id, "texto"))) {
      return respuestaError(
        "El check-in por texto no está disponible en tu programa.",
        403,
      );
    }

    const fecha = fechaHoyEnZona(perfil.zona_horaria ?? "Europe/Madrid");

    // El check-in ESTRUCTURADO de hoy (si existe). Desde WP-24 pueden convivir
    // varias filas por fecha (check-in + consultas): el filtro por tipo es
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

    let checkin: FilaSesion;

    if (decision.accion === "crear") {
      const { data: creado, error } = await supabase
        .from("checkins")
        .insert({
          paciente_id: user.id,
          fecha,
          tipo: decision.tipo,
          canal: "texto",
          estado: "en_curso",
        })
        .select(COLUMNAS_SESION)
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
          .select(COLUMNAS_SESION)
          .eq("paciente_id", user.id)
          .eq("fecha", fecha)
          .eq("tipo", "checkin")
          .maybeSingle();
        if (!reintento) {
          return respuestaError("No se pudo iniciar el check-in.", 500);
        }
        checkin = reintento;
      } else {
        checkin = creado;
      }
    } else {
      // Retomar el check-in del día (en curso).
      const { data: existente } = await supabase
        .from("checkins")
        .select(COLUMNAS_SESION)
        .eq("id", decision.checkinId)
        .eq("paciente_id", user.id)
        .maybeSingle();
      if (!existente) {
        return respuestaError("No se pudo iniciar el check-in.", 500);
      }
      checkin = existente;
    }

    const { data: mensajes } = await supabase
      .from("mensajes")
      .select("rol, contenido, orden")
      .eq("checkin_id", checkin.id)
      .order("orden", { ascending: true });

    let lista = mensajes ?? [];

    // Si es nueva (sin mensajes) y sigue en curso, generar la apertura cálida
    // (la de consulta invita a contar lo que la persona necesite).
    if (lista.length === 0 && checkin.estado === "en_curso") {
      const contexto = await construirContexto(user.id, checkin.tipo);
      const apertura = construirApertura(contexto);
      const { error: errIns } = await supabase.from("mensajes").insert({
        checkin_id: checkin.id,
        rol: "asistente",
        contenido: apertura,
        orden: 0,
      });
      if (!errIns) lista = [{ rol: "asistente", contenido: apertura, orden: 0 }];
    }

    return respuestaOk({
      checkinId: checkin.id,
      tipo: checkin.tipo,
      estado: checkin.estado,
      canal: checkin.canal,
      dominiosCubiertos: parsearDominiosCubiertos(checkin.dominios_cubiertos),
      riesgo: checkin.riesgo,
      mensajes: lista.map((m) => ({ rol: m.rol, contenido: m.contenido })),
    });
  } catch {
    return respuestaError("No se pudo iniciar la conversación.", 500);
  }
}
