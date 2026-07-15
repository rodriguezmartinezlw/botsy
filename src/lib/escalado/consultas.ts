/**
 * Consultas de lectura del escalado (WP-04) — helper para WP-06.
 *
 * `obtenerAlertas(filtros)` lee alertas como el usuario autenticado a través del
 * cliente de SERVIDOR (cookies): la RLS de WP-01 hace el trabajo de seguridad
 * (el profesional solo ve alertas de sus pacientes; el paciente, las suyas). No
 * usa service-role. Los filtros se validan con Zod.
 */

import { z } from "zod";
import type { Alerta } from "@/types/db";

export const esquemaFiltrosAlertas = z
  .object({
    estado: z.enum(["nueva", "vista", "resuelta", "descartada"]).optional(),
    nivel: z.enum(["vigilancia", "contactar", "urgencia"]).optional(),
    pacienteId: z.string().uuid().optional(),
    limite: z.number().int().positive().max(200).optional(),
  })
  .strict();

export type FiltrosAlertas = z.infer<typeof esquemaFiltrosAlertas>;

/**
 * Devuelve las alertas visibles para el usuario de la sesión, ordenadas de más
 * reciente a más antigua. Ante sesión ausente o filtros inválidos, devuelve `[]`
 * (nunca lanza). La restricción por profesional/paciente la aplica la RLS.
 */
export async function obtenerAlertas(
  filtros: FiltrosAlertas = {},
): Promise<Alerta[]> {
  const analizado = esquemaFiltrosAlertas.safeParse(filtros);
  if (!analizado.success) return [];
  const f = analizado.data;

  try {
    const { crearClienteServidor } = await import("@/lib/supabase/server");
    const supabase = await crearClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    let q = supabase.from("alertas").select("*");
    if (f.estado) q = q.eq("estado", f.estado);
    if (f.nivel) q = q.eq("nivel", f.nivel);
    if (f.pacienteId) q = q.eq("paciente_id", f.pacienteId);

    const { data } = await q
      .order("creado_en", { ascending: false })
      .limit(f.limite ?? 100);
    return data ?? [];
  } catch {
    return [];
  }
}
