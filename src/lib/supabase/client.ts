import { createBrowserClient } from "@supabase/ssr";
import type { BaseDatos } from "@/types/db";
import { claveAnonSupabase, urlSupabase } from "./config";

/**
 * Cliente de Supabase para el navegador (Client Components).
 * Usa la clave anónima pública; la seguridad la impone RLS.
 */
export function crearClienteNavegador() {
  return createBrowserClient<BaseDatos>(urlSupabase(), claveAnonSupabase());
}
