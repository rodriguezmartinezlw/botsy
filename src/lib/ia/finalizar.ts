/**
 * Cierre de un check-in — lógica COMPARTIDA por texto y voz (WP-02 + WP-03).
 *
 * Se extrae de `POST /api/checkin/finalizar` para no duplicarla en
 * `POST /api/voz/finalizar`: ambos transportes cierran igual (estado
 * 'completado', escalado determinista de WP-04, resumen, duración, rachas y
 * reconciliación). La ÚNICA diferencia del canal de voz es que puede aportar la
 * ruta del audio grabado (`audioPath`), que se persiste en `checkins.audio_path`
 * en el mismo UPDATE.
 *
 * La autenticación y la pertenencia siguen comprobándose en cada Route Handler
 * (Next 16): aquí se recibe ya el `userId` autenticado y el cliente de servidor,
 * y todas las escrituras filtran por `paciente_id = userId` (defensa en
 * profundidad).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos, NivelRiesgo } from "@/types/db";
import {
  calcularRacha,
  construirResumen,
  parsearDominiosCubiertos,
} from "./conversacion";
import { reconciliar } from "./extraccion";
import { evaluarCheckin } from "@/lib/escalado/motor";
import {
  aplicarEscalado,
  crearRepositorioAccionesServicio,
} from "@/lib/escalado/acciones";

export type DatosCierre = {
  estado: "completado";
  resumen: string;
  riesgo: NivelRiesgo | null;
  telefono_medico: string | null;
  racha_actual: number;
  racha_maxima: number;
  reconciliadas: number;
};

export type ResultadoCierre =
  | { ok: true; datos: DatosCierre }
  | { ok: false; estado: number; error: string };

export type OpcionesCierre = {
  /** Ruta del audio en Storage (`audios-checkin/{pacienteId}/{fecha}.webm`). */
  audioPath?: string | null;
};

/**
 * Cierra el check-in `checkinId` del paciente `userId`. No lanza por fallos de
 * escalado o reconciliación (best-effort); solo devuelve error si no encuentra
 * el check-in o no puede persistir el cierre.
 */
export async function finalizarCheckin(
  supabase: SupabaseClient<BaseDatos>,
  userId: string,
  checkinId: string,
  opciones: OpcionesCierre = {},
): Promise<ResultadoCierre> {
  const { data: checkin } = await supabase
    .from("checkins")
    .select("id, estado, fecha, riesgo, resumen, dominios_cubiertos, creado_en")
    .eq("id", checkinId)
    .eq("paciente_id", userId)
    .maybeSingle();
  if (!checkin) return { ok: false, estado: 404, error: "Check-in no encontrado." };

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("racha_actual, racha_maxima, ultimo_checkin, telefono_medico")
    .eq("id", userId)
    .maybeSingle();

  // Idempotencia: si ya está completado, devolver el estado actual sin tocar.
  if (checkin.estado === "completado") {
    return {
      ok: true,
      datos: {
        estado: "completado",
        resumen: checkin.resumen ?? "",
        riesgo: checkin.riesgo,
        telefono_medico: paciente?.telefono_medico ?? null,
        racha_actual: paciente?.racha_actual ?? 0,
        racha_maxima: paciente?.racha_maxima ?? 0,
        reconciliadas: 0,
      },
    };
  }

  const [{ data: observaciones }, { data: tomas }, { data: perfil }] =
    await Promise.all([
      supabase
        .from("observaciones")
        .select("dominio, codigo, valor_num, valor_texto")
        .eq("checkin_id", checkinId),
      supabase
        .from("tomas_medicacion")
        .select("estado")
        .eq("checkin_id", checkinId),
      supabase.from("perfiles").select("nombre").eq("id", userId).maybeSingle(),
    ]);

  const nuevaRacha = calcularRacha(
    {
      racha_actual: paciente?.racha_actual ?? 0,
      racha_maxima: paciente?.racha_maxima ?? 0,
      ultimo_checkin: paciente?.ultimo_checkin ?? null,
    },
    checkin.fecha,
  );

  // Escalado determinista (WP-04): evalúa TODAS las reglas del check-in, crea
  // alertas idempotentes + auditoría y sube el riesgo (nunca lo baja).
  // Best-effort: nunca impide cerrar el check-in.
  let riesgoFinal: NivelRiesgo | null = checkin.riesgo;
  try {
    const evaluacion = await evaluarCheckin(checkinId);
    if (evaluacion.nivel !== "normal" && evaluacion.reglasDisparadas.length > 0) {
      const repoAcciones = await crearRepositorioAccionesServicio();
      const res = await aplicarEscalado(evaluacion, repoAcciones);
      riesgoFinal = res.riesgoFinal ?? riesgoFinal;
    }
  } catch {
    // El escalado no debe tumbar el cierre del check-in.
  }

  const resumen =
    checkin.resumen ??
    construirResumen({
      nombre: perfil?.nombre ?? "",
      dominiosCubiertos: parsearDominiosCubiertos(checkin.dominios_cubiertos),
      observaciones: (observaciones ?? []).map((o) => ({
        dominio: o.dominio,
        codigo: o.codigo,
        valorNum: o.valor_num,
        valorTexto: o.valor_texto,
      })),
      tomas: (tomas ?? []).map((t) => ({ estado: t.estado })),
      rachaActual: nuevaRacha.racha_actual,
      riesgo: riesgoFinal,
    });

  const duracionSeg = Math.max(
    0,
    Math.round((Date.now() - new Date(checkin.creado_en).getTime()) / 1000),
  );

  // El audio_path solo se acepta si apunta a la carpeta del propio paciente
  // (defensa en profundidad; la subida ya está acotada por RLS de Storage).
  const audioPath =
    opciones.audioPath && opciones.audioPath.startsWith(`${userId}/`)
      ? opciones.audioPath
      : null;

  const { error: errCheckin } = await supabase
    .from("checkins")
    .update({
      estado: "completado",
      resumen,
      duracion_seg: duracionSeg,
      finalizado_en: new Date().toISOString(),
      ...(audioPath ? { audio_path: audioPath } : {}),
    })
    .eq("id", checkinId)
    .eq("paciente_id", userId);
  if (errCheckin) return { ok: false, estado: 500, error: "No se pudo cerrar el check-in." };

  await supabase
    .from("pacientes")
    .update({
      racha_actual: nuevaRacha.racha_actual,
      racha_maxima: nuevaRacha.racha_maxima,
      ultimo_checkin: nuevaRacha.ultimo_checkin,
    })
    .eq("id", userId);

  // Segunda pasada estructurada (best-effort; no tumba el cierre).
  const recon = await reconciliar(checkinId);

  return {
    ok: true,
    datos: {
      estado: "completado",
      resumen,
      riesgo: riesgoFinal,
      telefono_medico: paciente?.telefono_medico ?? null,
      racha_actual: nuevaRacha.racha_actual,
      racha_maxima: nuevaRacha.racha_maxima,
      reconciliadas: recon.insertadas,
    },
  };
}
