"use server";

/**
 * Guardado EXPLÍCITO del informe (WP-10 ítem 3).
 *
 * Antes, el informe se persistía en cada render → una fila por recarga. Ahora el
 * informe se RENDERIZA siempre, pero solo se PERSISTE (traza en `informes`) al
 * pulsar "Guardar informe". Valida sesión de panel + Zod y audita.
 */

import { z } from "zod";
import { obtenerSesionPanel, registrarAuditoria } from "@/lib/panel/sesion-panel";
import type { ResultadoAccion } from "@/lib/panel/tipos";

const esquemaGuardar = z
  .object({
    pacienteId: z.string().uuid(),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    resumen: z.string().max(4000).nullable(),
    modelo: z.string().max(120).nullable(),
  })
  .strict();

export async function guardarInforme(entrada: unknown): Promise<ResultadoAccion> {
  const analizado = esquemaGuardar.safeParse(entrada);
  if (!analizado.success) return { ok: false, error: "Datos no válidos." };
  const p = analizado.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: "No tienes permiso para esta acción." };

  // La RLS de `informes` (WP-07) restringe el INSERT al profesional del paciente.
  const { data, error } = await sesion.supabase
    .from("informes")
    .insert({
      paciente_id: p.pacienteId,
      generado_por: sesion.userId,
      periodo_desde: p.desde,
      periodo_hasta: p.hasta,
      resumen: p.resumen,
      modelo: p.modelo,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "No se pudo guardar el informe." };
  }

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "informe_guardado",
    "informes",
    data.id,
    { paciente_id: p.pacienteId, desde: p.desde, hasta: p.hasta },
  );

  return { ok: true };
}
