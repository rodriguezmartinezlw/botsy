/**
 * Proxy ligero de Next 16 (WP-10 ítem 6) — SOLO rutas de página.
 * (En Next 16 el antiguo `middleware` se llama `proxy`; NO intercepta `/api`.)
 *
 * Único cometido: si una navegación de servidor directa a una ruta protegida
 * llega sin sesión, redirigir a `/login?next=<ruta>` para CONSERVAR el destino
 * (los route guards de los layouts mandaban a `/login` a secas y se perdía).
 * Los guards de layout siguen como backstop (defensa en profundidad).
 *
 * IMPORTANTE (regla Next 16 de CLAUDE.md): el proxy NO intercepta `/api`; la
 * autorización de cada Route Handler sigue DENTRO del handler. El `matcher`
 * excluye `/api`, `_next`, estáticos y las propias páginas de auth.
 *
 * Sin variables de Supabase (build/CI sin proyecto) el proxy deja pasar: los
 * guards de layout son el backstop y la app compila y arranca igual.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { modoDemo } from "@/lib/demo";

/** Prefijos de página que exigen sesión. */
const PROTEGIDAS = [
  "/inicio",
  "/checkin",
  "/perfil",
  "/consentimientos",
  "/pacientes",
  "/alertas",
  "/configuracion",
  "/patrocinador",
];

function esProtegida(pathname: string): boolean {
  return PROTEGIDAS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (!esProtegida(pathname)) return NextResponse.next();

  // MODO DEMO (WP-17): el área del patrocinador es pública sobre el seed
  // sintético, para poder demostrarla en LOCAL aunque haya claves en .env.local.
  // El guard del layout también se salta en demo; la garantía de privacidad NO
  // depende de esto (solo agregados k>=5, RLS 0009 + RPC 0010).
  if (
    modoDemo() &&
    (pathname === "/patrocinador" || pathname.startsWith("/patrocinador/"))
  ) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Sin backend configurado: no bloqueamos aquí (los guards de layout deciden).
  if (!url || !anon) return NextResponse.next();

  const respuesta = NextResponse.next();
  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      login.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
  } catch {
    // Ante cualquier fallo (red/env), no rompemos la navegación: backstop = guards.
    return respuesta;
  }
  return respuesta;
}

export const config = {
  // Excluye API, estáticos de Next, y assets con extensión.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
