/**
 * POST /api/checkin/finalizar  { checkinId }
 *
 * Cierra el check-in: estado 'completado', resumen, duración, actualiza las
 * rachas del paciente (días consecutivos) y lanza la reconciliación.
 *
 * Next 16: autorización dentro del handler; pertenencia verificada.
 */

import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  calcularRacha,
  construirResumen,
  parsearDominiosCubiertos,
} from "@/lib/ia/conversacion";
import { reconciliar } from "@/lib/ia/extraccion";
import { esquemaCuerpoFinalizar } from "@/lib/ia/schemas";

export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return respuestaError("Cuerpo de la petición no válido.", 400);
  }

  const analizado = esquemaCuerpoFinalizar.safeParse(cuerpo);
  if (!analizado.success) return respuestaError("Datos no válidos.", 400);
  const { checkinId } = analizado.data;

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return respuestaError("No has iniciado sesión.", 401);

    const { data: checkin } = await supabase
      .from("checkins")
      .select("id, estado, fecha, riesgo, resumen, dominios_cubiertos, creado_en")
      .eq("id", checkinId)
      .eq("paciente_id", user.id)
      .maybeSingle();
    if (!checkin) return respuestaError("Check-in no encontrado.", 404);

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("racha_actual, racha_maxima, ultimo_checkin")
      .eq("id", user.id)
      .maybeSingle();

    // Idempotencia: si ya está completado, devolver el estado actual sin tocar.
    if (checkin.estado === "completado") {
      return respuestaOk({
        estado: "completado",
        resumen: checkin.resumen ?? "",
        riesgo: checkin.riesgo,
        racha_actual: paciente?.racha_actual ?? 0,
        racha_maxima: paciente?.racha_maxima ?? 0,
        reconciliadas: 0,
      });
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
        supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
      ]);

    const nuevaRacha = calcularRacha(
      {
        racha_actual: paciente?.racha_actual ?? 0,
        racha_maxima: paciente?.racha_maxima ?? 0,
        ultimo_checkin: paciente?.ultimo_checkin ?? null,
      },
      checkin.fecha,
    );

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
        riesgo: checkin.riesgo,
      });

    const duracionSeg = Math.max(
      0,
      Math.round((Date.now() - new Date(checkin.creado_en).getTime()) / 1000),
    );

    const { error: errCheckin } = await supabase
      .from("checkins")
      .update({
        estado: "completado",
        resumen,
        duracion_seg: duracionSeg,
        finalizado_en: new Date().toISOString(),
      })
      .eq("id", checkinId)
      .eq("paciente_id", user.id);
    if (errCheckin) return respuestaError("No se pudo cerrar el check-in.", 500);

    await supabase
      .from("pacientes")
      .update({
        racha_actual: nuevaRacha.racha_actual,
        racha_maxima: nuevaRacha.racha_maxima,
        ultimo_checkin: nuevaRacha.ultimo_checkin,
      })
      .eq("id", user.id);

    // Segunda pasada estructurada (best-effort; no tumba el cierre).
    const recon = await reconciliar(checkinId);

    return respuestaOk({
      estado: "completado",
      resumen,
      riesgo: checkin.riesgo,
      racha_actual: nuevaRacha.racha_actual,
      racha_maxima: nuevaRacha.racha_maxima,
      reconciliadas: recon.insertadas,
    });
  } catch {
    return respuestaError("No se pudo finalizar el check-in.", 500);
  }
}
