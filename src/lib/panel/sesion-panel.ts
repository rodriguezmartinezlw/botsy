/**
 * Comprobación de sesión para las mutaciones del panel (WP-06) — SERVER ONLY.
 *
 * Next 16: el proxy/middleware NO protege las Server Actions ni las API; la
 * autorización se comprueba DENTRO de cada acción (CLAUDE.md). Este helper
 * devuelve el cliente de servidor + el usuario + su rol SÓLO si es profesional o
 * admin; en cualquier otro caso, `null`. Nunca lanza.
 *
 * La comprobación fina (que el profesional gestione a ESE paciente) la hace
 * además la RLS de WP-01 en cada escritura; aquí sólo cerramos la puerta al
 * paciente y al no autenticado.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { BaseDatos, Json, RolPerfil } from "@/types/db";

export type SesionPanel = {
  supabase: SupabaseClient<BaseDatos>;
  userId: string;
  rol: RolPerfil;
};

export async function obtenerSesionPanel(): Promise<SesionPanel | null> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();
    const rol = perfil?.rol;
    if (rol !== "profesional" && rol !== "admin") return null;
    return { supabase, userId: user.id, rol };
  } catch {
    return null;
  }
}

/**
 * Inserta un evento en `eventos_auditoria` como el actor autenticado. La RLS
 * permite el INSERT a cualquier autenticado (append-only). No lanza: si falla,
 * lo registra en consola de servidor y sigue (la mutación principal ya ocurrió).
 */
export async function registrarAuditoria(
  supabase: SupabaseClient<BaseDatos>,
  actorId: string,
  accion: string,
  entidad: string,
  entidadId: string,
  detalle: Json,
): Promise<void> {
  const { error } = await supabase.from("eventos_auditoria").insert({
    actor_id: actorId,
    accion,
    entidad,
    entidad_id: entidadId,
    detalle,
  });
  if (error) {
    console.error("No se pudo registrar el evento de auditoría:", accion);
  }
}
