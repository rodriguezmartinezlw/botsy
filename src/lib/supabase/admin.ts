import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { BaseDatos } from "@/types/db";
import { urlSupabase } from "./config";

/**
 * Cliente de Supabase con clave service-role. SALTA RLS: úsalo solo en tareas
 * de servidor de confianza (motor de escalado, seed programático, jobs).
 *
 * El `import "server-only"` garantiza en compilación que este módulo nunca
 * acabe en un bundle de cliente. La clave se lee de env en tiempo de petición;
 * si falta, se lanza un error claro.
 */
export function crearClienteAdmin() {
  const claveServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!claveServiceRole || claveServiceRole.trim().length === 0) {
    throw new Error(
      "Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY. Configúrala en .env.local (ver .env.example).",
    );
  }

  return createClient<BaseDatos>(urlSupabase(), claveServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
