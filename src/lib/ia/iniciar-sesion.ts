/**
 * Decisión de inicio de una sesión conversacional (WP-24) — lógica PURA
 * compartida por `POST /api/checkin/iniciar` (texto) y `POST /api/voz/sesion`
 * (voz), testeable sin Supabase ni red.
 *
 * Reglas:
 *  - tipo 'consulta': SIEMPRE se crea una fila nueva (`tipo='consulta'`,
 *    `estado='en_curso'`), aunque el check-in de hoy esté completado o haya
 *    otras consultas. El índice único parcial de 0020 no la limita.
 *  - tipo 'checkin': máximo uno al día. Sin fila hoy → crear; en curso →
 *    retomar; completado → rechazo claro (la UI enruta sola a la consulta,
 *    pero el mensaje de la API no debe ser críptico).
 */

import type { EstadoCheckin, TipoCheckin } from "@/types/db";

/** Mensaje de la API cuando se pide un 2º check-in con el día ya completado. */
export const MENSAJE_CHECKIN_COMPLETADO =
  "Ya completaste tu check-in de hoy. Puedes abrir una conversación cuando quieras.";

/** Check-in ESTRUCTURADO de hoy ya existente (o null si aún no hay). */
export type CheckinHoy = { id: string; estado: EstadoCheckin };

export type DecisionInicio =
  | { accion: "crear"; tipo: TipoCheckin }
  | { accion: "retomar"; checkinId: string }
  | { accion: "rechazar"; estado: 409; error: string };

export function decidirInicioSesion(
  tipo: TipoCheckin,
  checkinHoy: CheckinHoy | null,
): DecisionInicio {
  if (tipo === "consulta") {
    return { accion: "crear", tipo: "consulta" };
  }
  if (!checkinHoy) return { accion: "crear", tipo: "checkin" };
  if (checkinHoy.estado === "completado") {
    return { accion: "rechazar", estado: 409, error: MENSAJE_CHECKIN_COMPLETADO };
  }
  // 'en_curso' (y el caso límite 'abandonado') se retoman como hasta ahora.
  return { accion: "retomar", checkinId: checkinHoy.id };
}
