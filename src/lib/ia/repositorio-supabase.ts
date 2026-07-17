/**
 * Implementación de `RepositorioCheckin` respaldada por Supabase.
 *
 * Escribe como el PACIENTE autenticado (cliente de servidor con cookies): la
 * RLS `propio` permite insertar sus observaciones/tomas y actualizar su
 * check-in, así que NO se usa service-role. Todas las escrituras filtran
 * además por `paciente_id`/`checkin_id` como defensa en profundidad.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos, Json, NivelRiesgo } from "@/types/db";
import { nivelMaximoRiesgo } from "@/lib/escalado/senales";
import type { DominioCheckin } from "./conversacion";
import type {
  InstrumentoEntrada,
  ObservacionEntrada,
  RepositorioCheckin,
  SenalEntrada,
  TomaEntrada,
} from "./loop";

export type DepsRepositorio = {
  supabase: SupabaseClient<BaseDatos>;
  checkinId: string;
  pacienteId: string;
  fecha: string;
  riesgoInicial: NivelRiesgo | null;
  dominiosIniciales: DominioCheckin[];
};

function objetoDominios(dominios: Set<DominioCheckin>): Json {
  const objeto: Record<string, boolean> = {};
  for (const d of dominios) objeto[d] = true;
  return objeto;
}

export function crearRepositorioSupabase(deps: DepsRepositorio): {
  repositorio: RepositorioCheckin;
  obtenerRiesgo: () => NivelRiesgo | null;
  obtenerDominios: () => DominioCheckin[];
} {
  const { supabase, checkinId, pacienteId, fecha } = deps;
  const dominios = new Set<DominioCheckin>(deps.dominiosIniciales);
  let riesgo: NivelRiesgo | null = deps.riesgoInicial;

  const repositorio: RepositorioCheckin = {
    async registrarObservacion(obs: ObservacionEntrada): Promise<void> {
      const { error } = await supabase.from("observaciones").insert({
        checkin_id: checkinId,
        paciente_id: pacienteId,
        dominio: obs.dominio,
        codigo: obs.codigo,
        valor_num: obs.valorNum,
        valor_texto: obs.valorTexto,
        confianza: obs.confianza,
        origen: "conversacion",
      });
      if (error) throw new Error("No se pudo registrar la observación.");
    },

    async registrarToma(toma: TomaEntrada): Promise<void> {
      const { error } = await supabase.from("tomas_medicacion").upsert(
        {
          pauta_id: toma.pautaId,
          paciente_id: pacienteId,
          checkin_id: checkinId,
          fecha,
          momento: toma.momento,
          estado: toma.estado,
        },
        { onConflict: "pauta_id,fecha,momento" },
      );
      if (error) throw new Error("No se pudo registrar la toma de medicación.");
    },

    async marcarDominioCubierto(dominio: DominioCheckin): Promise<void> {
      dominios.add(dominio);
      const { error } = await supabase
        .from("checkins")
        .update({ dominios_cubiertos: objetoDominios(dominios) })
        .eq("id", checkinId)
        .eq("paciente_id", pacienteId);
      if (error) throw new Error("No se pudo actualizar el progreso del check-in.");
    },

    async registrarSenal(senal: SenalEntrada): Promise<void> {
      riesgo = nivelMaximoRiesgo(riesgo, senal.nivel);
      const { error } = await supabase
        .from("checkins")
        .update({ riesgo })
        .eq("id", checkinId)
        .eq("paciente_id", pacienteId);
      if (error) throw new Error("No se pudo registrar la señal en el check-in.");

      // Traza de auditoría (RF-ES-06). Best-effort: no bloquea el turno.
      await supabase.from("eventos_auditoria").insert({
        actor_id: pacienteId,
        accion: "senal_alarma",
        entidad: "checkins",
        entidad_id: checkinId,
        detalle: {
          nivel: senal.nivel,
          motivo: senal.motivo,
          evidencia: senal.evidencia as Json,
        },
      });
    },

    async registrarInstrumento(inst: InstrumentoEntrada): Promise<void> {
      // Escribe como el PACIENTE (RLS `propio`). La versión y el origen los
      // estampa el servidor (integridad del dato para RWE).
      const { error } = await supabase.from("instrumentos_respuestas").insert({
        paciente_id: pacienteId,
        checkin_id: checkinId,
        instrumento: inst.instrumento,
        version_instrumento: inst.version,
        puntuacion: inst.puntuacion,
        items: inst.problemas as unknown as Json,
        origen: inst.origen,
      });
      if (error) throw new Error("No se pudo registrar el instrumento.");
    },
  };

  return {
    repositorio,
    obtenerRiesgo: () => riesgo,
    obtenerDominios: () => [...dominios],
  };
}
