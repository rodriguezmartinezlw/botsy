/**
 * POST /api/voz/finalizar  { checkinId, audioPath? }
 *
 * Cierra el check-in por voz reutilizando la MISMA lógica que el modo texto
 * (`finalizarCheckin`: escalado, resumen, rachas, reconciliación) y, si el
 * cliente subió el audio, persiste su ruta en `checkins.audio_path`. La subida
 * del audio la hace el cliente contra Storage (RLS lo acota a su carpeta); si
 * falla, no bloquea el cierre (audioPath simplemente no llega).
 *
 * Next 16: autorización dentro del handler; pertenencia verificada en el core.
 */

import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";
import { finalizarCheckin } from "@/lib/ia/finalizar";
import { esquemaCuerpoFinalizarVoz } from "@/lib/ia/schemas";

export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return respuestaError("Cuerpo de la petición no válido.", 400);
  }

  const analizado = esquemaCuerpoFinalizarVoz.safeParse(cuerpo);
  if (!analizado.success) return respuestaError("Datos no válidos.", 400);
  const { checkinId, audioPath, transcripcion } = analizado.data;

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return respuestaError("No has iniciado sesión.", 401);

    // Persistir el TRANSCRIPT de la conversación de voz en `mensajes` (WP-25):
    // antes se perdía y las conversaciones de voz salían vacías en el historial y
    // en la ficha del profesional. La voz NO guarda mensajes durante la
    // conversación (solo al finalizar), así que es aquí donde entran.
    //
    // Pertenencia y RLS: se comprueba que el check-in es del paciente; la RLS
    // `mensajes` es la barrera real. Idempotencia por ESTADO: si ya está
    // 'completado', finalize ya corrió una vez → no se re-inserta (evita
    // duplicar en un reintento de cierre). Los turnos se AÑADEN tras los
    // mensajes existentes (p. ej. el saludo de un intento previo por texto sobre
    // el mismo check-in diario), calculando el `orden` desde el máximo actual,
    // para no pisar nada ni perder el transcript de voz.
    if (transcripcion && transcripcion.length > 0) {
      const { data: propio } = await supabase
        .from("checkins")
        .select("id, estado")
        .eq("id", checkinId)
        .eq("paciente_id", user.id)
        .maybeSingle();
      if (propio && propio.estado !== "completado") {
        const { data: ultimo } = await supabase
          .from("mensajes")
          .select("orden")
          .eq("checkin_id", checkinId)
          .order("orden", { ascending: false })
          .limit(1)
          .maybeSingle();
        const base = (ultimo?.orden ?? -1) + 1;
        await supabase.from("mensajes").insert(
          transcripcion.map((t, i) => ({
            checkin_id: checkinId,
            rol: t.rol,
            contenido: t.texto,
            orden: base + i,
          })),
        );
      }
    }

    const resultado = await finalizarCheckin(supabase, user.id, checkinId, {
      audioPath: audioPath ?? null,
    });
    if (!resultado.ok) return respuestaError(resultado.error, resultado.estado);
    return respuestaOk(resultado.datos);
  } catch {
    return respuestaError("No se pudo finalizar el check-in.", 500);
  }
}
