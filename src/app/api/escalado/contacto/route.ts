/**
 * POST /api/escalado/contacto  { checkinId, tipo: "medico" | "emergencias" }
 *
 * Registra en la auditoría que el paciente pulsó llamar a su médico o a
 * emergencias tras un escalado (RF-ES-06: "qué hizo el paciente"). No inicia la
 * llamada (eso lo hace el enlace `tel:` del dispositivo); solo deja la traza.
 *
 * Next 16: autorización dentro del handler; se verifica que el check-in
 * pertenece al paciente de la sesión antes de escribir.
 */

import { z } from "zod";
import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";

const esquemaCuerpo = z
  .object({
    checkinId: z.string().uuid(),
    tipo: z.enum(["medico", "emergencias"]),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return respuestaError("Cuerpo de la petición no válido.", 400);
  }

  const analizado = esquemaCuerpo.safeParse(cuerpo);
  if (!analizado.success) return respuestaError("Datos no válidos.", 400);
  const { checkinId, tipo } = analizado.data;

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return respuestaError("No has iniciado sesión.", 401);

    const { data: checkin } = await supabase
      .from("checkins")
      .select("id, riesgo")
      .eq("id", checkinId)
      .eq("paciente_id", user.id)
      .maybeSingle();
    if (!checkin) return respuestaError("Check-in no encontrado.", 404);

    await supabase.from("eventos_auditoria").insert({
      actor_id: user.id,
      accion: "paciente_contacto_escalado",
      entidad: "checkins",
      entidad_id: checkinId,
      detalle: { tipo, riesgo: checkin.riesgo },
    });

    return respuestaOk({ ok: true });
  } catch {
    return respuestaError("No se pudo registrar la acción.", 500);
  }
}
