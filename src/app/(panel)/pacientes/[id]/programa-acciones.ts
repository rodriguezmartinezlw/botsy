"use server";

/**
 * Server Actions de la pestaña "Programa" de la ficha (WP-11 v2 §A.5).
 *
 * Asignar / suspender / reactivar un programa y ajustar los overrides de módulo.
 * Al asignar (o reactivar) se ACTIVAN las reglas clave del programa como filas
 * de `reglas_escalado` del paciente, de forma IDEMPOTENTE (una fila por regla
 * del programa, deduplicada por nombre dentro de la asignación); al suspender se
 * DESACTIVAN (activa=false), no se borran. Cada acción: valida con Zod → sesión
 * profesional/admin → escribe con el cliente de SERVIDOR (RLS) → audita →
 * revalida la ficha. Nunca usa service-role.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionPanel, registrarAuditoria } from "@/lib/panel/sesion-panel";
import { sincronizarReglasPrograma } from "@/lib/programas/asignacion";
import type { Json } from "@/types/db";
import type { ResultadoAccion } from "@/lib/panel/tipos";

const FALLO_SESION = "No tienes permiso para esta acción.";
const FALLO_ESCRITURA = "No se pudo guardar el cambio. Inténtalo de nuevo.";

// --- Asignar programa --------------------------------------------------------

const esquemaAsignar = z
  .object({
    pacienteId: z.string().uuid(),
    programaClave: z.string().min(1).max(80),
  })
  .strict();

export async function asignarPrograma(entrada: unknown): Promise<ResultadoAccion> {
  const a = esquemaAsignar.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };
  const p = a.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  // Un solo programa activo por paciente (además del UNIQUE parcial en BD).
  const { data: activo } = await sesion.supabase
    .from("programas_paciente")
    .select("id")
    .eq("paciente_id", p.pacienteId)
    .eq("estado", "activo")
    .maybeSingle();
  if (activo) {
    return {
      ok: false,
      error: "El paciente ya tiene un programa activo. Suspéndelo antes de asignar otro.",
    };
  }

  const { data: programa } = await sesion.supabase
    .from("programas")
    .select("id, config, activo")
    .eq("clave", p.programaClave)
    .maybeSingle();
  if (!programa || programa.activo === false) {
    return { ok: false, error: "Programa no disponible." };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: asignacion, error } = await sesion.supabase
    .from("programas_paciente")
    .insert({
      paciente_id: p.pacienteId,
      programa_id: programa.id,
      estado: "activo",
      fecha_inicio: hoy,
      asignado_por: sesion.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !asignacion) return { ok: false, error: FALLO_ESCRITURA };

  const insertadas = await sincronizarReglasPrograma(
    sesion.supabase,
    p.pacienteId,
    asignacion.id,
    programa.config,
    {},
  );

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "programa_asignado",
    "programas_paciente",
    asignacion.id,
    { paciente_id: p.pacienteId, programa: p.programaClave, reglas_activadas: insertadas },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}

// --- Suspender / reactivar ---------------------------------------------------

const esquemaAsignacion = z
  .object({
    pacienteId: z.string().uuid(),
    asignacionId: z.string().uuid(),
  })
  .strict();

export async function suspenderPrograma(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const a = esquemaAsignacion.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };
  const p = a.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("programas_paciente")
    .update({ estado: "suspendido" })
    .eq("id", p.asignacionId)
    .eq("paciente_id", p.pacienteId);
  if (error) return { ok: false, error: FALLO_ESCRITURA };

  // Desactivar (no borrar) las reglas materializadas de este programa.
  await sesion.supabase
    .from("reglas_escalado")
    .update({ activa: false })
    .eq("programa_paciente_id", p.asignacionId);

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "programa_suspendido",
    "programas_paciente",
    p.asignacionId,
    { paciente_id: p.pacienteId },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}

export async function reactivarPrograma(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const a = esquemaAsignacion.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };
  const p = a.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  // No puede haber otro programa activo (UNIQUE parcial). Comprobación amable.
  const { data: activo } = await sesion.supabase
    .from("programas_paciente")
    .select("id")
    .eq("paciente_id", p.pacienteId)
    .eq("estado", "activo")
    .maybeSingle();
  if (activo && activo.id !== p.asignacionId) {
    return {
      ok: false,
      error: "Ya hay otro programa activo. Suspéndelo antes de reactivar este.",
    };
  }

  const { data: asignacion, error } = await sesion.supabase
    .from("programas_paciente")
    .update({ estado: "activo" })
    .eq("id", p.asignacionId)
    .eq("paciente_id", p.pacienteId)
    .select("id, programa_id, config_override")
    .maybeSingle();
  if (error || !asignacion) return { ok: false, error: FALLO_ESCRITURA };

  // Reactivar las reglas materializadas y re-sincronizar por si el programa
  // cambió (idempotente: no duplica).
  await sesion.supabase
    .from("reglas_escalado")
    .update({ activa: true })
    .eq("programa_paciente_id", p.asignacionId);

  const { data: programa } = await sesion.supabase
    .from("programas")
    .select("config")
    .eq("id", asignacion.programa_id)
    .maybeSingle();
  await sincronizarReglasPrograma(
    sesion.supabase,
    p.pacienteId,
    p.asignacionId,
    programa?.config ?? {},
    asignacion.config_override,
  );

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "programa_reactivado",
    "programas_paciente",
    p.asignacionId,
    { paciente_id: p.pacienteId },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}

// --- Override de módulo (toggle) ---------------------------------------------

const esquemaOverrideModulo = z
  .object({
    pacienteId: z.string().uuid(),
    asignacionId: z.string().uuid(),
    modulo: z.enum(["voz", "texto", "recomendaciones"]),
    activo: z.boolean(),
  })
  .strict();

export async function actualizarOverrideModulo(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const a = esquemaOverrideModulo.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };
  const p = a.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { data: asignacion } = await sesion.supabase
    .from("programas_paciente")
    .select("config_override")
    .eq("id", p.asignacionId)
    .eq("paciente_id", p.pacienteId)
    .maybeSingle();
  if (!asignacion) return { ok: false, error: FALLO_SESION };

  const overrideActual =
    asignacion.config_override &&
    typeof asignacion.config_override === "object" &&
    !Array.isArray(asignacion.config_override)
      ? (asignacion.config_override as Record<string, Json>)
      : {};
  const modulosActual =
    overrideActual.modulos &&
    typeof overrideActual.modulos === "object" &&
    !Array.isArray(overrideActual.modulos)
      ? (overrideActual.modulos as Record<string, Json>)
      : {};

  const nuevoOverride: Json = {
    ...overrideActual,
    modulos: { ...modulosActual, [p.modulo]: p.activo },
  };

  const { error } = await sesion.supabase
    .from("programas_paciente")
    .update({ config_override: nuevoOverride })
    .eq("id", p.asignacionId)
    .eq("paciente_id", p.pacienteId);
  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "programa_override",
    "programas_paciente",
    p.asignacionId,
    { paciente_id: p.pacienteId, modulo: p.modulo, activo: p.activo },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}
