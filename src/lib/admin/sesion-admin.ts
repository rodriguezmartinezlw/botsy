/**
 * Comprobación de sesión para la consola de administración (WP-23) — SERVER ONLY.
 *
 * Next 16: el proxy/middleware NO protege las Server Actions ni los layouts por
 * rol; la autorización va DENTRO (CLAUDE.md). A diferencia de `obtenerSesionPanel`
 * (que admite profesional O admin), este guard exige SÓLO `admin`: la consola de
 * administración maneja el catálogo institucional y no debe abrirse a un
 * profesional. En cualquier otro caso (paciente, profesional, patrocinador, sin
 * sesión) devuelve `null`. Nunca lanza.
 *
 * La garantía REAL de que un profesional no escriba catálogo/membresías la da la
 * RLS de 0016 (`es_admin()` en instituciones/paises/profesionales_instituciones);
 * este guard sólo decide quién ENTRA al área y a cada acción.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { BaseDatos } from "@/types/db";

export type SesionAdmin = {
  supabase: SupabaseClient<BaseDatos>;
  userId: string;
};

export async function obtenerSesionAdmin(): Promise<SesionAdmin | null> {
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
    if (perfil?.rol !== "admin") return null;
    return { supabase, userId: user.id };
  } catch {
    return null;
  }
}
