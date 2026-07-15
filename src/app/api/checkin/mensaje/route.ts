/**
 * POST /api/checkin/mensaje  { checkinId, texto }
 *
 * Añade el mensaje del paciente, ejecuta el loop de tool-calls contra el LLM
 * (persistiendo observaciones/tomas/dominios/señales) y devuelve la respuesta
 * del asistente. Transporte: respuesta JSON completa (no streaming SSE) — ver
 * la justificación en la entrega WP-02.
 *
 * Next 16: autorización dentro del handler; se verifica SIEMPRE que el
 * check-in pertenece al paciente de la sesión antes de escribir.
 */

import { respuestaError, respuestaOk } from "@/lib/http";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteOpenAI, modeloTexto, type MensajeLLM } from "@/lib/ia/openai";
import {
  construirContexto,
  construirInstrucciones,
  parsearDominiosCubiertos,
} from "@/lib/ia/conversacion";
import { ejecutarTurno } from "@/lib/ia/loop";
import { crearRepositorioSupabase } from "@/lib/ia/repositorio-supabase";
import { esquemaCuerpoMensaje } from "@/lib/ia/schemas";

export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return respuestaError("Cuerpo de la petición no válido.", 400);
  }

  const analizado = esquemaCuerpoMensaje.safeParse(cuerpo);
  if (!analizado.success) {
    return respuestaError("Datos no válidos.", 400);
  }
  const { checkinId, texto } = analizado.data;

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return respuestaError("No has iniciado sesión.", 401);

    // Verificación de pertenencia: el check-in debe ser del paciente de la sesión.
    const { data: checkin } = await supabase
      .from("checkins")
      .select("id, estado, riesgo, dominios_cubiertos, fecha")
      .eq("id", checkinId)
      .eq("paciente_id", user.id)
      .maybeSingle();
    if (!checkin) return respuestaError("Check-in no encontrado.", 404);
    if (checkin.estado !== "en_curso") {
      return respuestaError("Este check-in ya está cerrado.", 409);
    }

    // Siguiente número de orden.
    const { data: ultimo } = await supabase
      .from("mensajes")
      .select("orden")
      .eq("checkin_id", checkinId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ordenUsuario = (ultimo?.orden ?? -1) + 1;

    // Historial persistido (sin el mensaje nuevo, que se añade en memoria).
    const { data: historialRows } = await supabase
      .from("mensajes")
      .select("rol, contenido, orden")
      .eq("checkin_id", checkinId)
      .order("orden", { ascending: true });

    const historial: MensajeLLM[] = [
      ...(historialRows ?? []).map((m): MensajeLLM =>
        m.rol === "paciente"
          ? { rol: "user", contenido: m.contenido }
          : { rol: "assistant", contenido: m.contenido },
      ),
      { rol: "user", contenido: texto },
    ];

    const contexto = await construirContexto(user.id);
    const instrucciones = construirInstrucciones(contexto);
    const dominiosPrevios = parsearDominiosCubiertos(checkin.dominios_cubiertos);

    const { repositorio, obtenerRiesgo, obtenerDominios } =
      crearRepositorioSupabase({
        supabase,
        checkinId: checkin.id,
        pacienteId: user.id,
        fecha: checkin.fecha,
        riesgoInicial: checkin.riesgo,
        dominiosIniciales: dominiosPrevios,
      });

    let resultado;
    try {
      resultado = await ejecutarTurno({
        cliente: crearClienteOpenAI(),
        modelo: modeloTexto(),
        instrucciones,
        historial,
        repositorio,
        contexto: {
          vertical: contexto.vertical,
          dominiosYaCubiertos: dominiosPrevios,
        },
      });
    } catch {
      // Falta OPENAI_API_KEY, red caída o error del proveedor.
      return respuestaError(
        "El asistente no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.",
        503,
      );
    }

    const textoAsistente =
      resultado.texto.trim().length > 0
        ? resultado.texto.trim()
        : "Estoy aquí contigo. ¿Quieres contarme algo más?";

    // Persistir ambos turnos solo tras un turno correcto (consistencia).
    const { error: errMensajes } = await supabase.from("mensajes").insert([
      { checkin_id: checkinId, rol: "paciente", contenido: texto, orden: ordenUsuario },
      {
        checkin_id: checkinId,
        rol: "asistente",
        contenido: textoAsistente,
        orden: ordenUsuario + 1,
      },
    ]);
    if (errMensajes) {
      return respuestaError("No se pudo guardar la conversación.", 500);
    }

    return respuestaOk({
      respuesta: textoAsistente,
      dominiosCubiertos: obtenerDominios(),
      riesgo: obtenerRiesgo(),
      finalizarSugerido: resultado.finalizarSugerido,
    });
  } catch {
    return respuestaError("No se pudo procesar tu mensaje.", 500);
  }
}
