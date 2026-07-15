import { crearClienteServidor } from "@/lib/supabase/server";
import type { RolPerfil } from "@/types/db";

/**
 * Devuelve el rol del usuario autenticado leyendo la sesión de servidor,
 * o `null` si no hay sesión válida (o si Supabase no está configurado).
 *
 * Se usa en los route guards de los layouts. Nunca lanza: ante cualquier
 * fallo (sin sesión, env ausente, red) devuelve `null` para que el guard
 * redirija de forma controlada a /login.
 */
export async function obtenerRolSesion(): Promise<RolPerfil | null> {
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

    return perfil?.rol ?? null;
  } catch {
    return null;
  }
}
