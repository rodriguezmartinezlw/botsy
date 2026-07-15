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
  crearAlerta(alerta: AlertaNueva): Promise<void>;
  actualizarRiesgo(checkinId: string, nivel: NivelRiesgo): Promise<void>;
  registrarAuditoria(evento: EventoEscalado): Promise<void>;
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
  }

  return { alertasCreadas, nivel: evaluacion.nivel, riesgoFinal };
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
