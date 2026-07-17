/**
 * POST /api/checkin/iniciar
 *
 * Crea (o retoma) el check-in de HOY del paciente autenticado, canal texto, y
 * devuelve su id + el historial de mensajes (con la apertura si es nuevo).
 *
 * Next 16: la autorización se comprueba DENTRO del handler (el middleware no
 * intercepta /api). Sesión obligatoria con rol paciente.
 */

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
import { moduloActivoPaciente } from "@/lib/programas/servidor";

export async function POST(): Promise<Response> {
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

    // Consentimiento `conversacion`: bloqueante para iniciar cualquier check-in
    // (defensa en profundidad además del interstitial de UI). Sin él, no se
    // puede conversar.
    const { data: filasConsent } = await supabase
      .from("consentimientos")
      .select("tipo, otorgado, registrado_en")
      .eq("paciente_id", user.id);
    const estadoConsent = estadoVigenteConsentimientos(
      (filasConsent ?? []) as FilaConsentimiento[],
    );
    if (!puedeConversar(estadoConsent)) {
      return respuestaError(
        "Necesitas aceptar el registro de conversaciones para hacer tu check-in.",
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

    // Buscar el check-in de hoy o crearlo.
    let { data: checkin } = await supabase
      .from("checkins")
      .select("id, estado, canal, riesgo, dominios_cubiertos")
      .eq("paciente_id", user.id)
      .eq("fecha", fecha)
      .maybeSingle();

    if (!checkin) {
      const { data: creado, error } = await supabase
        .from("checkins")
        .insert({
          paciente_id: user.id,
          fecha,
          canal: "texto",
          estado: "en_curso",
        })
        .select("id, estado, canal, riesgo, dominios_cubiertos")
        .single();

      if (error || !creado) {
        // Posible carrera con otra pestaña: reintentar la lectura.
        const { data: reintento } = await supabase
          .from("checkins")
          .select("id, estado, canal, riesgo, dominios_cubiertos")
          .eq("paciente_id", user.id)
          .eq("fecha", fecha)
          .maybeSingle();
        if (!reintento) {
          return respuestaError("No se pudo iniciar el check-in.", 500);
        }
        checkin = reintento;
      } else {
        checkin = creado;
      }
    }

    const { data: mensajes } = await supabase
      .from("mensajes")
      .select("rol, contenido, orden")
      .eq("checkin_id", checkin.id)
      .order("orden", { ascending: true });

    let lista = mensajes ?? [];

    // Si es nuevo (sin mensajes) y sigue en curso, generar la apertura cálida.
    if (lista.length === 0 && checkin.estado === "en_curso") {
      const contexto = await construirContexto(user.id);
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
      estado: checkin.estado,
      canal: checkin.canal,
      dominiosCubiertos: parsearDominiosCubiertos(checkin.dominios_cubiertos),
      riesgo: checkin.riesgo,
      mensajes: lista.map((m) => ({ rol: m.rol, contenido: m.contenido })),
    });
  } catch {
    return respuestaError("No se pudo iniciar el check-in.", 500);
  }
}
