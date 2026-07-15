import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { BaseDatos } from "@/types/db";
import { claveAnonSupabase, urlSupabase } from "./config";

/**
 * Cliente de Supabase para código de servidor (Server Components, Route
 * Handlers, Server Actions). Lee/escribe la sesión desde las cookies.
 *
 * En Next 16 `cookies()` es asíncrono, por lo que esta función es async.
 * La escritura de cookies se ignora cuando se invoca desde un Server
 * Component (no puede mutar cookies); el refresco de sesión ocurriría, en su
 * caso, en un Route Handler / Server Action.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient<BaseDatos>(urlSupabase(), claveAnonSupabase(), {
    cookies: {
      getAll() {
        return almacenCookies.getAll();
      },
      setAll(cookiesAEstablecer) {
        try {
          for (const { name, value, options } of cookiesAEstablecer) {
            almacenCookies.set(name, value, options);
          }
        } catch {
          // Invocado desde un Server Component: no se pueden escribir cookies.
          // Es esperado y seguro de ignorar.
        }
      },
    },
  });
}
