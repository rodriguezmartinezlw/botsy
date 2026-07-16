"use server";

/**
 * Server Actions de la bandeja de alertas (WP-06).
 *
 * Marcar vista / resolver (nota opcional) / descartar (motivo OBLIGATORIO). Cada
 * acción: valida con Zod → sesión de profesional/admin → UPDATE con el cliente de
 * SERVIDOR (RLS `alertas_update_profesional` de WP-01 confirma que es de su
 * paciente) → registra en `eventos_auditoria` → revalida. Nunca usa service-role.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionPanel, registrarAuditoria } from "@/lib/panel/sesion-panel";
import type { EstadoAlerta, Json } from "@/types/db";
import type { ResultadoAccion } from "@/lib/panel/tipos";

const FALLO_SESION = "No tienes permiso para esta acción.";
const FALLO_ESCRITURA = "No se pudo actualizar la alerta. Inténtalo de nuevo.";

/**
 * Aplica un cambio de estado a una alerta y lo audita. Comparte la comprobación
 * de sesión y la escritura para las tres acciones.
 */
async function gestionarAlerta(
  alertaId: string,
  nuevoEstado: EstadoAlerta,
  extra: { motivoDescarte?: string; nota?: string },
): Promise<ResultadoAccion> {
  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("alertas")
    .update({
      estado: nuevoEstado,
      motivo_descarte: extra.motivoDescarte ?? null,
      gestionada_por: sesion.userId,
      gestionada_en: new Date().toISOString(),
    })
    .eq("id", alertaId);

  if (error) return { ok: false, error: FALLO_ESCRITURA };

  const detalle: Json = {
    estado: nuevoEstado,
    ...(extra.nota ? { nota: extra.nota } : {}),
    ...(extra.motivoDescarte ? { motivo_descarte: extra.motivoDescarte } : {}),
  };
  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    `alerta_${nuevoEstado}`,
    "alertas",
    alertaId,
    detalle,
  );

  revalidatePath("/alertas");
  return { ok: true };
}

const esquemaMarcar = z.object({ alertaId: z.string().uuid() }).strict();

export async function marcarVista(entrada: unknown): Promise<ResultadoAccion> {
  const a = esquemaMarcar.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };
  return gestionarAlerta(a.data.alertaId, "vista", {});
}

const esquemaResolver = z
  .object({
    alertaId: z.string().uuid(),
    nota: z.string().trim().max(500).optional(),
  })
  .strict();

export async function resolverAlerta(entrada: unknown): Promise<ResultadoAccion> {
  const a = esquemaResolver.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };
  return gestionarAlerta(a.data.alertaId, "resuelta", {
    nota: a.data.nota && a.data.nota.length > 0 ? a.data.nota : undefined,
  });
}

const esquemaDescartar = z
  .object({
    alertaId: z.string().uuid(),
    // El motivo es OBLIGATORIO (WP-06): alimenta el ciclo de mejora futuro.
    motivo: z.string().trim().min(3).max(500),
  })
  .strict();

export async function descartarAlerta(entrada: unknown): Promise<ResultadoAccion> {
  const a = esquemaDescartar.safeParse(entrada);
  if (!a.success) {
    return { ok: false, error: "El motivo del descarte es obligatorio (mín. 3 caracteres)." };
  }
  return gestionarAlerta(a.data.alertaId, "descartada", {
    motivoDescarte: a.data.motivo,
  });
}
