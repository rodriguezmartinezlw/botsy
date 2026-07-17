"use server";

/**
 * Server Action de pacientes sin institución (WP-23 §5) — SOLO admin.
 *
 * Cierra el riesgo operativo de WP-22: un paciente con `institucion_id` NULL no es
 * visible para ningún profesional. El admin le asigna una institución. Valida con
 * Zod → sesión ADMIN → UPDATE con el cliente de SERVIDOR (RLS `pacientes_admin_todo`
 * de 0002; sin service-role) → audita → revalida.
 */

import { revalidatePath } from "next/cache";
import { obtenerSesionAdmin } from "@/lib/admin/sesion-admin";
import { registrarAuditoria } from "@/lib/panel/sesion-panel";
import { esquemaAsignarInstitucionPaciente } from "@/lib/admin/esquemas";
import type { AccionAdmin } from "@/lib/admin/tipos";

const FALLO_SESION = "No tienes permiso para esta acción.";

export async function asignarInstitucionPaciente(
  entrada: unknown,
): Promise<AccionAdmin> {
  const a = esquemaAsignarInstitucionPaciente.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };

  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  // La institución debe existir y estar activa (adscribir a una activa).
  const { data: institucion } = await sesion.supabase
    .from("instituciones")
    .select("activa")
    .eq("id", a.data.institucionId)
    .maybeSingle();
  if (!institucion) return { ok: false, error: "La institución no existe." };
  if (!institucion.activa) {
    return { ok: false, error: "La institución está desactivada; elige otra." };
  }

  const { error } = await sesion.supabase
    .from("pacientes")
    .update({ institucion_id: a.data.institucionId })
    .eq("id", a.data.pacienteId);
  if (error) {
    return { ok: false, error: "No se pudo asignar la institución. Inténtalo de nuevo." };
  }

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "paciente_institucion_asignada",
    "pacientes",
    a.data.pacienteId,
    { institucion_id: a.data.institucionId },
  );

  revalidatePath("/admin");
  revalidatePath("/admin/pacientes");
  return { ok: true, mensaje: "Institución asignada. El paciente ya es visible para su equipo." };
}
