/**
 * Acciones de escalado (WP-04): materializa el resultado de `evaluarCheckin`.
 *
 * Al determinar un nivel > `normal`:
 *  - crea una `alerta` por regla disparada (motivo = nombre de la regla;
 *    evidencia = observaciones implicadas + últimos mensajes relevantes),
 *  - sube `checkins.riesgo` (nunca lo baja, vía `nivelMaximoRiesgo`),
 *  - inserta un `evento_auditoria` (RF-ES-06: qué se detectó y qué se recomendó).
 *
 * IDEMPOTENTE: re-evaluar el mismo check-in NO duplica alertas de la misma regla
 * (se comprueba la existencia por `checkin_id` + `regla_id`) ni añade auditoría
 * si no se creó ninguna alerta nueva.
 *
 * La lógica trabaja contra un PUERTO (`RepositorioAcciones`), de modo que es
 * testeable en memoria; la implementación real usa el cliente de SERVICIO
 * (service-role): por RLS, la creación de alertas es tarea del motor, no de un
 * rol de usuario (WP-01).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos, Json, NivelRiesgo } from "@/types/db";
import { nivelMaximoRiesgo, type NivelSenal } from "./senales";
import type { EvaluacionCheckin } from "./motor";

type ClienteBD = SupabaseClient<BaseDatos>;

export type AlertaNueva = {
  pacienteId: string;
  checkinId: string;
  reglaId: string | null;
  nivel: NivelSenal;
  motivo: string;
  evidencia: Json;
};

export type EventoEscalado = {
  pacienteId: string;
  checkinId: string;
  detalle: Json;
};

/** Puerto de persistencia de las acciones (Supabase o en memoria en tests). */
export interface RepositorioAcciones {
  /** ¿Existe ya una alerta para esta regla en este check-in? (idempotencia) */
  alertaExiste(checkinId: string, reglaId: string): Promise<boolean>;
  /**
   * ¿Existe ya una alerta SIN regla (`regla_id` null) para este check-in?
   * Idempotencia de la materialización de señales genéricas (WP-08, punto b):
   * una única alerta genérica por check-in, aunque se re-evalúe en cada turno.
   */
  alertaSinReglaExiste(checkinId: string): Promise<boolean>;
  crearAlerta(alerta: AlertaNueva): Promise<void>;
  actualizarRiesgo(checkinId: string, nivel: NivelRiesgo): Promise<void>;
  registrarAuditoria(evento: EventoEscalado): Promise<void>;
  /**
   * Aviso inmediato al profesional asignado ante una alerta de URGENCIA nueva
   * (WP-10 ítem 5, RF-ES-03). Best-effort; se llama una sola vez por alerta.
   */
  notificarUrgencia(pacienteId: string, checkinId: string): Promise<void>;
}

export type ResultadoAcciones = {
  alertasCreadas: number;
  nivel: NivelRiesgo;
  /** Riesgo resultante del check-in (subido, nunca bajado). */
  riesgoFinal: NivelRiesgo | null;
};

/** Texto INTERNO (para auditoría, no para el paciente) de la acción recomendada. */
function recomendacionInterna(nivel: NivelRiesgo): string {
  switch (nivel) {
    case "urgencia":
      return "Indicar al paciente que acuda/llame a urgencias (112) o a su médico ahora; avisar al profesional.";
    case "contactar":
      return "Recomendar al paciente contactar hoy con su médico; alerta para el profesional.";
    case "vigilancia":
      return "Sin fricción para el paciente; alerta de seguimiento para el profesional.";
    case "normal":
      return "Sin acción.";
  }
}

/**
 * Aplica el escalado de una evaluación de check-in de forma idempotente.
 * Pura respecto a la infraestructura: todo el IO pasa por `repo`.
 */
export async function aplicarEscalado(
  evaluacion: EvaluacionCheckin,
  repo: RepositorioAcciones,
): Promise<ResultadoAcciones> {
  if (evaluacion.nivel === "normal" || evaluacion.reglasDisparadas.length === 0) {
    return {
      alertasCreadas: 0,
      nivel: "normal",
      riesgoFinal: evaluacion.riesgoActual,
    };
  }

  const mensajes = evaluacion.mensajesRelevantes;
  let alertasCreadas = 0;

  for (const disparada of evaluacion.reglasDisparadas) {
    // Idempotencia por regla: si ya hay alerta de esta regla, no se duplica.
    if (
      disparada.reglaId !== null &&
      (await repo.alertaExiste(evaluacion.checkinId, disparada.reglaId))
    ) {
      continue;
    }

    const evidencia: Json = {
      detalle: disparada.evidencia.detalle,
      observaciones: disparada.evidencia.observaciones.map((o) => ({
        dominio: o.dominio,
        codigo: o.codigo,
        valor_num: o.valorNum,
      })),
      senales: disparada.evidencia.senales,
      mensajes: mensajes.map((m) => ({ rol: m.rol, contenido: m.contenido })),
    };

    await repo.crearAlerta({
      pacienteId: evaluacion.pacienteId,
      checkinId: evaluacion.checkinId,
      reglaId: disparada.reglaId,
      nivel: disparada.nivel,
      motivo: disparada.nombre,
      evidencia,
    });
    alertasCreadas += 1;
  }

  const riesgoFinal = nivelMaximoRiesgo(evaluacion.riesgoActual, evaluacion.nivel);

  // Solo se escribe (riesgo/auditoría) cuando hubo una escalada nueva:
  // así re-evaluar un check-in ya escalado no genera efectos adicionales.
  if (alertasCreadas > 0) {
    if (riesgoFinal !== null && riesgoFinal !== evaluacion.riesgoActual) {
      await repo.actualizarRiesgo(evaluacion.checkinId, riesgoFinal);
    }
    await repo.registrarAuditoria({
      pacienteId: evaluacion.pacienteId,
      checkinId: evaluacion.checkinId,
      detalle: {
        nivel: evaluacion.nivel,
        recomendacion: recomendacionInterna(evaluacion.nivel),
        reglas: evaluacion.reglasDisparadas.map((d) => ({
          regla_id: d.reglaId,
          nombre: d.nombre,
          nivel: d.nivel,
          detalle: d.evidencia.detalle,
        })),
        alertas_creadas: alertasCreadas,
      },
    });
    // WP-10 ítem 5: aviso inmediato al profesional si la escalada es urgencia.
    if (riesgoFinal === "urgencia") {
      await repo.notificarUrgencia(evaluacion.pacienteId, evaluacion.checkinId);
    }
  }

  return { alertasCreadas, nivel: evaluacion.nivel, riesgoFinal };
}

/**
 * Materializa una alerta para el profesional cuando el riesgo del check-in llegó
 * en vivo a `contactar`/`urgencia` por una SEÑAL GENÉRICA que NO casa con ninguna
 * regla configurada (WP-08, punto b). Sin esto, el paciente vería la pantalla de
 * contacto/urgencia pero el profesional NO recibiría ninguna alerta (hueco
 * anotado por la revisión de WP-04).
 *
 * Coherente con la materialización inmediata de `aplicarEscalado`:
 *  - Solo actúa si NINGUNA regla disparó (esas las gestiona `aplicarEscalado`).
 *  - IDEMPOTENTE: una sola alerta genérica por check-in (`alertaSinReglaExiste`),
 *    así que re-evaluar en cada turno / al cierre no la duplica.
 *  - El riesgo del check-in ya lo subió el turno en vivo (`registrarSenal`); aquí
 *    no se re-escribe, solo se crea la alerta y su traza de auditoría.
 *
 * `regla_id` queda null (no hay regla); el motivo lo deja explícito para el panel.
 */
export async function aplicarEscaladoSenalGenerica(
  evaluacion: EvaluacionCheckin,
  repo: RepositorioAcciones,
): Promise<ResultadoAcciones> {
  const nivel = evaluacion.riesgoActual;

  // Solo señales genéricas que elevaron el riesgo a contactar/urgencia y que
  // ninguna regla cubre. En cualquier otro caso, no hay nada que materializar.
  if (
    evaluacion.reglasDisparadas.length > 0 ||
    (nivel !== "contactar" && nivel !== "urgencia")
  ) {
    return { alertasCreadas: 0, nivel: nivel ?? "normal", riesgoFinal: nivel };
  }

  // Idempotencia: una única alerta genérica por check-in.
  if (await repo.alertaSinReglaExiste(evaluacion.checkinId)) {
    return { alertasCreadas: 0, nivel, riesgoFinal: nivel };
  }

  const evidencia: Json = {
    detalle: [
      "Señal de alarma detectada durante el check-in que no coincide con ninguna regla configurada.",
    ],
    // Forma uniforme con `aplicarEscalado` (una señal genérica no lleva
    // observaciones; el panel es defensivo, pero mantenemos la clave presente).
    observaciones: [],
    senales: evaluacion.senalesDetectadas,
    mensajes: evaluacion.mensajesRelevantes.map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    })),
  };

  await repo.crearAlerta({
    pacienteId: evaluacion.pacienteId,
    checkinId: evaluacion.checkinId,
    reglaId: null,
    nivel,
    motivo: "Señal de alarma sin regla configurada",
    evidencia,
  });

  await repo.registrarAuditoria({
    pacienteId: evaluacion.pacienteId,
    checkinId: evaluacion.checkinId,
    detalle: {
      nivel,
      recomendacion: recomendacionInterna(nivel),
      tipo: "senal_generica",
      senales: evaluacion.senalesDetectadas,
      alertas_creadas: 1,
    },
  });

  // WP-10 ítem 5: aviso inmediato al profesional si la señal genérica es urgencia.
  if (nivel === "urgencia") {
    await repo.notificarUrgencia(evaluacion.pacienteId, evaluacion.checkinId);
  }

  return { alertasCreadas: 1, nivel, riesgoFinal: nivel };
}

// --- Implementación Supabase (service-role) ---------------------------------

/** Crea el repositorio de acciones respaldado por un cliente Supabase de servicio. */
export function crearRepositorioAcciones(supabase: ClienteBD): RepositorioAcciones {
  return {
    async alertaExiste(checkinId, reglaId) {
      const { data } = await supabase
        .from("alertas")
        .select("id")
        .eq("checkin_id", checkinId)
        .eq("regla_id", reglaId)
        .limit(1)
        .maybeSingle();
      return data !== null;
    },

    async alertaSinReglaExiste(checkinId) {
      const { data } = await supabase
        .from("alertas")
        .select("id")
        .eq("checkin_id", checkinId)
        .is("regla_id", null)
        .limit(1)
        .maybeSingle();
      return data !== null;
    },

    async crearAlerta(alerta) {
      const { error } = await supabase.from("alertas").insert({
        paciente_id: alerta.pacienteId,
        checkin_id: alerta.checkinId,
        regla_id: alerta.reglaId,
        nivel: alerta.nivel,
        motivo: alerta.motivo,
        evidencia: alerta.evidencia,
        estado: "nueva",
      });
      if (error) throw new Error("No se pudo crear la alerta de escalado.");
    },

    async actualizarRiesgo(checkinId, nivel) {
      const { error } = await supabase
        .from("checkins")
        .update({ riesgo: nivel })
        .eq("id", checkinId);
      if (error) throw new Error("No se pudo actualizar el riesgo del check-in.");
    },

    async registrarAuditoria(evento) {
      // actor_id null = acción del sistema (motor de escalado). Sin FK (WP-01).
      await supabase.from("eventos_auditoria").insert({
        actor_id: null,
        accion: "escalado",
        entidad: "checkins",
        entidad_id: evento.checkinId,
        detalle: evento.detalle,
      });
    },

    async notificarUrgencia(pacienteId, checkinId) {
      // Best-effort (el módulo se traga sus errores): el email no rompe el escalado.
      const { notificarUrgenciaProfesional } = await import("./notificacion");
      await notificarUrgenciaProfesional(supabase, pacienteId, checkinId);
    },
  };
}

/**
 * Repositorio de acciones con el cliente de SERVICIO por defecto (service-role),
 * cargado de forma diferida para no arrastrar `admin` a bundles de cliente.
 * Inyectable en tests.
 */
export async function crearRepositorioAccionesServicio(opciones?: {
  supabase?: ClienteBD;
}): Promise<RepositorioAcciones> {
  const supabase =
    opciones?.supabase ??
    (await import("@/lib/supabase/admin")).crearClienteAdmin();
  return crearRepositorioAcciones(supabase);
}
