"use server";

/**
 * Server Action de la configuración del profesional (WP-06, F1 mínimo):
 * nombre y teléfono de contacto que ven sus pacientes.
 *
 * Valida con Zod → sesión de profesional/admin → UPDATE de su propio `perfiles`
 * (RLS `perfiles_update_propio`) → audita → revalida. Nunca usa service-role.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionPanel, registrarAuditoria } from "@/lib/panel/sesion-panel";
import type { ResultadoAccion } from "@/lib/panel/tipos";

const esquema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    // Teléfono opcional; formato laxo (E.164 o nacional) para F1.
    telefono: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+()0-9\s-]*$/, "El teléfono contiene caracteres no válidos.")
      .optional(),
  })
  .strict();

export async function guardarConfiguracion(entrada: unknown): Promise<ResultadoAccion> {
  const analizado = esquema.safeParse(entrada);
  if (!analizado.success) {
    return { ok: false, error: "Revisa el nombre y el teléfono." };
  }
  const { nombre, telefono } = analizado.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: "No tienes permiso para esta acción." };

  const { error } = await sesion.supabase
    .from("perfiles")
    .update({
      nombre,
      telefono: telefono && telefono.length > 0 ? telefono : null,
    })
    .eq("id", sesion.userId);

  if (error) return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "perfil_actualizado",
    "perfiles",
    sesion.userId,
    { nombre, telefono: telefono ?? null },
  );

  revalidatePath("/configuracion");
  return { ok: true };
}
