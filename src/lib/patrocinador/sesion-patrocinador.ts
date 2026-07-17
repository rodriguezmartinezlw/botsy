/**
 * Comprobación de sesión para el área del patrocinador (WP-17) — SERVER ONLY.
 *
 * Next 16: el proxy no protege por rol; el guard va DENTRO (CLAUDE.md). Devuelve
 * el cliente de servidor + userId + rol + patrocinador SOLO si el usuario es
 * `patrocinador` o `admin`; en cualquier otro caso `null`. Nunca lanza.
 *
 * IMPORTANTE: aunque este guard cierre la puerta a nivel de app, la garantía
 * REAL de que un patrocinador no ve datos identificables la da la RLS (0009: sin
 * políticas de lectura sobre tablas de pacientes) + las RPC de agregados (0010).
 * Este guard solo decide quién entra al ÁREA.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { BaseDatos, RolPerfil } from "@/types/db";

export type SesionPatrocinador = {
  supabase: SupabaseClient<BaseDatos>;
  userId: string;
  rol: RolPerfil;
  /** Patrocinador (organización) al que pertenece el usuario. `null` para admin. */
  patrocinadorId: string | null;
  nombrePatrocinador: string | null;
};

export async function obtenerSesionPatrocinador(): Promise<SesionPatrocinador | null> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol, patrocinador_id")
      .eq("id", user.id)
      .maybeSingle();

    const rol = perfil?.rol;
    if (rol !== "patrocinador" && rol !== "admin") return null;

    let nombrePatrocinador: string | null = null;
    if (perfil?.patrocinador_id) {
      const { data: patro } = await supabase
        .from("patrocinadores")
        .select("nombre")
        .eq("id", perfil.patrocinador_id)
        .maybeSingle();
      nombrePatrocinador = patro?.nombre ?? null;
    }

    return {
      supabase,
      userId: user.id,
      rol,
      patrocinadorId: perfil?.patrocinador_id ?? null,
      nombrePatrocinador,
    };
  } catch {
    return null;
  }
}
