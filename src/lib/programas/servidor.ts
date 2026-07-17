/**
 * Runtime de programas de monitorización (WP-11 v2 §A.3-4) — SERVER ONLY.
 *
 * Resuelve el programa ACTIVO de un paciente y su config EFECTIVA (plantilla del
 * catálogo + override), y expone el gating server-side de módulos. Un paciente
 * SIN programa asignado usa `CONFIG_POR_DEFECTO` → comportamiento F1 intacto.
 *
 * Todas las consultas van con el cliente que se pasa (el de servidor, RLS):
 *  - como paciente: ve su asignación (`programas_paciente` propio) y el programa
 *    asignado (`programas` con política `programas_select_asignado`);
 *  - como profesional/admin: ve las asignaciones de sus pacientes y el catálogo.
 * Nunca usa service-role.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos, EstadoProgramaPaciente } from "@/types/db";
import { guiaVocabularioOnco } from "@/lib/ia/vocabulario-onco";
import type { DominioCheckin } from "@/lib/ia/dominios";
import { esDominioCheckin } from "@/lib/ia/dominios";
import type { ProgramaContexto } from "@/lib/ia/conversacion";
import {
  CONFIG_POR_DEFECTO,
  configEfectiva,
  type ConfigPrograma,
  type OrigenConfig,
} from "./config";

type ClienteBD = SupabaseClient<BaseDatos>;

export type ProgramaActivo = {
  asignacionId: string;
  programaId: string;
  clave: string;
  nombre: string;
  estado: EstadoProgramaPaciente;
  config: ConfigPrograma;
  origenConfig: OrigenConfig;
};

/**
 * Devuelve el programa ACTIVO del paciente con su config efectiva ya resuelta, o
 * `null` si no tiene ninguno activo (→ el llamador usa el comportamiento por
 * defecto). No lanza: ante cualquier error devuelve `null` (F1 seguro).
 */
export async function obtenerProgramaActivo(
  supabase: ClienteBD,
  pacienteId: string,
): Promise<ProgramaActivo | null> {
  try {
    const { data: asignacion } = await supabase
      .from("programas_paciente")
      .select("id, programa_id, config_override, estado")
      .eq("paciente_id", pacienteId)
      .eq("estado", "activo")
      .maybeSingle();
    if (!asignacion) return null;

    const { data: programa } = await supabase
      .from("programas")
      .select("clave, nombre, config, activo")
      .eq("id", asignacion.programa_id)
      .maybeSingle();
    if (!programa || programa.activo === false) return null;

    const { config, origen } = configEfectiva(
      programa.config,
      asignacion.config_override,
    );

    return {
      asignacionId: asignacion.id,
      programaId: asignacion.programa_id,
      clave: programa.clave,
      nombre: programa.nombre,
      estado: asignacion.estado,
      config,
      origenConfig: origen,
    };
  } catch {
    return null;
  }
}

/**
 * Config EFECTIVA del paciente (la del programa activo o `CONFIG_POR_DEFECTO`).
 * Es la fuente única para el gating de módulos y el perfil de gráficos.
 */
export async function obtenerConfigEfectiva(
  supabase: ClienteBD,
  pacienteId: string,
): Promise<ConfigPrograma> {
  const activo = await obtenerProgramaActivo(supabase, pacienteId);
  return activo?.config ?? CONFIG_POR_DEFECTO;
}

// --- Contexto para el check-in dirigido por programa -------------------------

/**
 * Traduce el programa activo al `ProgramaContexto` que consumen
 * `construirContexto`/`construirInstrucciones` (sección `# PROGRAMA`). `null` si
 * no hay programa activo (el check-in se comporta como en F1).
 */
export async function obtenerContextoPrograma(
  supabase: ClienteBD,
  pacienteId: string,
): Promise<ProgramaContexto | null> {
  const activo = await obtenerProgramaActivo(supabase, pacienteId);
  if (!activo) return null;

  const dominios: DominioCheckin[] = activo.config.checkin.dominios.filter(
    (d): d is DominioCheckin => esDominioCheckin(d),
  );

  return {
    clave: activo.clave,
    nombre: activo.nombre,
    dominios,
    preguntasExtra: activo.config.checkin.preguntas_extra.map((p) => ({
      clave: p.clave,
      texto: p.texto,
      dominio: p.dominio,
    })),
    estilo: activo.config.checkin.estilo,
    // Los programas de mama guían al modelo a usar el vocabulario CTCAE.
    guiaVocabulario: activo.clave.startsWith("mama_")
      ? guiaVocabularioOnco()
      : undefined,
  };
}

// --- Gating server-side de módulos -------------------------------------------

export type ModuloPrograma = "voz" | "texto" | "recomendaciones";

/** ¿Está activo el módulo `modulo` en la config efectiva del paciente? */
export async function moduloActivoPaciente(
  supabase: ClienteBD,
  pacienteId: string,
  modulo: ModuloPrograma,
): Promise<boolean> {
  const config = await obtenerConfigEfectiva(supabase, pacienteId);
  return config.modulos[modulo] === true;
}
