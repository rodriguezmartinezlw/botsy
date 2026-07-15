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
  const { checkinId, audioPath } = analizado.data;

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return respuestaError("No has iniciado sesión.", 401);

    const resultado = await finalizarCheckin(supabase, user.id, checkinId, {
      audioPath: audioPath ?? null,
    });
    if (!resultado.ok) return respuestaError(resultado.error, resultado.estado);
    return respuestaOk(resultado.datos);
  } catch {
    return respuestaError("No se pudo finalizar el check-in.", 500);
  }
}
