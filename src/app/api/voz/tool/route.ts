/**
 * POST /api/voz/tool  { checkinId, callId, nombre, argumentosJson }
 *
 * El cliente reenvía aquí cada tool-call que el modelo Realtime emite por el
 * data channel. El servidor la VALIDA (Zod, mismos schemas de WP-02), la EJECUTA
 * (persistencia idéntica al modo texto, reutilizando el repositorio de Supabase)
 * y devuelve el resultado que el cliente reintroduce en la conversación del
 * modelo. Si el turno eleva el riesgo, materializa la alerta de inmediato (igual
 * que `/api/checkin/mensaje`).
 *
 * Next 16: autorización DENTRO del handler; se verifica SIEMPRE que el check-in
 * pertenece al paciente de la sesión (dentro de `manejarToolVoz` vía el puerto).
 */

import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaCuerpoToolVoz } from "@/lib/ia/schemas";
import { crearRepositorioSupabase } from "@/lib/ia/repositorio-supabase";
import { manejarToolVoz, type PuertoToolVoz } from "@/lib/ia/voz-tool";
import { parsearDominiosCubiertos } from "@/lib/ia/conversacion";
import { cargarReglasSenal, evaluarCheckin } from "@/lib/escalado/motor";
import {
  aplicarEscalado,
  crearRepositorioAccionesServicio,
} from "@/lib/escalado/acciones";

export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return respuestaError("Cuerpo de la petición no válido.", 400);
  }

  const analizado = esquemaCuerpoToolVoz.safeParse(cuerpo);
  if (!analizado.success) return respuestaError("Datos no válidos.", 400);
  const { checkinId, callId, nombre, argumentosJson } = analizado.data;

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return respuestaError("No has iniciado sesión.", 401);

    const puerto: PuertoToolVoz = {
      async cargarCheckinPropio(id, userId) {
        const { data: checkin } = await supabase
          .from("checkins")
          .select("id, estado, riesgo, dominios_cubiertos, fecha")
          .eq("id", id)
          .eq("paciente_id", userId) // pertenencia
          .maybeSingle();
        if (!checkin) return null;

        const { data: paciente } = await supabase
          .from("pacientes")
          .select("vertical")
          .eq("id", userId)
          .maybeSingle();

        return {
          id: checkin.id,
          pacienteId: userId,
          estado: checkin.estado,
          riesgo: checkin.riesgo,
          fecha: checkin.fecha,
          dominiosCubiertos: parsearDominiosCubiertos(checkin.dominios_cubiertos),
          vertical: paciente?.vertical ?? null,
        };
      },

      async cargarReglasSenal(pacienteId, vertical) {
        return cargarReglasSenal(pacienteId, vertical);
      },

      crearRepositorio(checkin) {
        return crearRepositorioSupabase({
          supabase,
          checkinId: checkin.id,
          pacienteId: checkin.pacienteId,
          fecha: checkin.fecha,
          riesgoInicial: checkin.riesgo,
          dominiosIniciales: checkin.dominiosCubiertos,
        });
      },

      async materializarEscalado(id) {
        // Best-effort: nunca tumba la respuesta al modelo (igual que /mensaje).
        try {
          const evaluacion = await evaluarCheckin(id);
          if (
            evaluacion.nivel !== "normal" &&
            evaluacion.reglasDisparadas.length > 0
          ) {
            const repoAcciones = await crearRepositorioAccionesServicio();
            await aplicarEscalado(evaluacion, repoAcciones);
          }
        } catch {
          // El escalado no debe impedir devolver el resultado de la tool.
        }
      },
    };

    const resultado = await manejarToolVoz(
      { userId: user.id, checkinId, llamada: { id: callId, nombre, argumentosJson } },
      puerto,
    );
    if (!resultado.ok) return respuestaError(resultado.error, resultado.estado);

    return respuestaOk({
      output: resultado.output,
      riesgo: resultado.riesgo,
      dominiosCubiertos: resultado.dominiosCubiertos,
      finalizar: resultado.finalizar,
    });
  } catch {
    return respuestaError("No se pudo ejecutar la herramienta.", 500);
  }
}
