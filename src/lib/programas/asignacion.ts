/**
 * Asignación de programa a un paciente y materialización de sus reglas clave
 * (WP-11 v2 §A.5) — lógica de servidor REUTILIZABLE.
 *
 * Se extrae aquí para que la comparta tanto la pestaña "Programa" de la ficha
 * (`programa-acciones.ts`) como el ENROLAMIENTO de un paciente nuevo (WP-20 §A):
 * al dar de alta, el programa elegido se asigna reutilizando exactamente esta
 * misma materialización idempotente de reglas.
 *
 * Recibe SIEMPRE un `SupabaseClient` ya construido por el llamante (servidor con
 * cookies para la ficha; service-role sólo para el bootstrap del enrolamiento,
 * donde el profesional aún no puede escribir por RLS). Este módulo no crea
 * clientes ni lee secretos: es lógica pura de orquestación sobre el cliente dado.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { configEfectiva } from "@/lib/programas/config";
import type { BaseDatos, Json } from "@/types/db";

type ClienteBD = SupabaseClient<BaseDatos>;

/**
 * Materializa las reglas clave del programa como reglas del paciente, de forma
 * idempotente: no reinserta una regla cuyo nombre ya exista para esta asignación
 * (WP-11 §A.5). Devuelve cuántas insertó.
 */
export async function sincronizarReglasPrograma(
  supabase: ClienteBD,
  pacienteId: string,
  asignacionId: string,
  configPrograma: unknown,
  override: unknown,
): Promise<number> {
  const { config } = configEfectiva(configPrograma, override);
  const reglas = config.escalado.reglas_clave;
  if (reglas.length === 0) return 0;

  const { data: existentes } = await supabase
    .from("reglas_escalado")
    .select("nombre")
    .eq("programa_paciente_id", asignacionId);
  const nombresExistentes = new Set((existentes ?? []).map((r) => r.nombre));

  const aInsertar = reglas.filter((r) => !nombresExistentes.has(r.nombre));
  if (aInsertar.length === 0) return 0;

  const { error } = await supabase.from("reglas_escalado").insert(
    aInsertar.map((r) => ({
      paciente_id: pacienteId,
      vertical: null,
      nombre: r.nombre,
      descripcion: r.descripcion ?? null,
      condicion: r.condicion as unknown as Json,
      nivel: r.nivel,
      activa: true,
      programa_paciente_id: asignacionId,
    })),
  );
  if (error) return 0;
  return aInsertar.length;
}

export type ResultadoAsignacion =
  | { ok: true; asignacionId: string; reglasActivadas: number }
  | { ok: false; error: string };

/**
 * Asigna un programa (por clave) a un paciente y materializa sus reglas clave.
 * Reutilizable desde el enrolamiento (WP-20) y desde cualquier flujo de servidor
 * que ya tenga la autorización resuelta. No comprueba sesión: la comprobación de
 * permiso es responsabilidad del llamante (Server Action).
 *
 *  - Si el paciente ya tiene un programa ACTIVO, no asigna otro (un solo activo
 *    por paciente; además del UNIQUE parcial en BD): devuelve error amable.
 *  - Inserta la asignación (`programas_paciente`) y activa las reglas clave.
 */
export async function asignarProgramaAPaciente(
  supabase: ClienteBD,
  pacienteId: string,
  programaClave: string,
  asignadoPor: string,
): Promise<ResultadoAsignacion> {
  const { data: activo } = await supabase
    .from("programas_paciente")
    .select("id")
    .eq("paciente_id", pacienteId)
    .eq("estado", "activo")
    .maybeSingle();
  if (activo) {
    return {
      ok: false,
      error: "El paciente ya tiene un programa activo.",
    };
  }

  const { data: programa } = await supabase
    .from("programas")
    .select("id, config, activo")
    .eq("clave", programaClave)
    .maybeSingle();
  if (!programa || programa.activo === false) {
    return { ok: false, error: "Programa no disponible." };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: asignacion, error } = await supabase
    .from("programas_paciente")
    .insert({
      paciente_id: pacienteId,
      programa_id: programa.id,
      estado: "activo",
      fecha_inicio: hoy,
      asignado_por: asignadoPor,
    })
    .select("id")
    .maybeSingle();
  if (error || !asignacion) {
    return { ok: false, error: "No se pudo asignar el programa." };
  }

  const reglasActivadas = await sincronizarReglasPrograma(
    supabase,
    pacienteId,
    asignacion.id,
    programa.config,
    {},
  );

  return { ok: true, asignacionId: asignacion.id, reglasActivadas };
}
