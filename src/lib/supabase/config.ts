/**
 * Lectura centralizada de las variables de entorno de Supabase.
 * Las funciones se evalúan en tiempo de petición (no en el módulo), de modo
 * que la app COMPILA aunque falten las variables; si faltan en tiempo de
 * ejecución, se lanza un error claro en lugar de un fallo opaco.
 *
 * Nota: aquí solo viven las claves PÚBLICAS (url + anon). La service-role se
 * lee exclusivamente en `admin.ts` (marcado con "server-only").
 */

function requerir(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim().length === 0) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Configúrala en .env.local (ver .env.example).`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return requerir(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function claveAnonSupabase(): string {
  return requerir(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
