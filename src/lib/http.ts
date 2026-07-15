import { NextResponse } from "next/server";

/**
 * Respuesta JSON de error uniforme para los Route Handlers.
 * Nunca se filtran mensajes internos ni stack traces al cliente (CLAUDE.md):
 * el llamante pasa un mensaje seguro y genérico.
 */
export function respuestaError(mensaje: string, estado: number): NextResponse {
  return NextResponse.json({ error: mensaje }, { status: estado });
}

/** Respuesta JSON de éxito. */
export function respuestaOk<T>(datos: T, estado = 200): NextResponse {
  return NextResponse.json(datos, { status: estado });
}
