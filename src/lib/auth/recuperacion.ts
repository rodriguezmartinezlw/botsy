/**
 * Recuperación de contraseña (WP-20 §B) — helpers PUROS y cliente-seguros.
 *
 * La UI (formularios cliente) llama a Supabase Auth (`resetPasswordForEmail`,
 * `updateUser`) directamente; aquí vive solo la lógica que conviene testear y
 * mantener consistente:
 *   - el mensaje NEUTRO que NO revela si el email existe,
 *   - la validación de la contraseña nueva,
 *   - la construcción de la URL de redirección del enlace.
 */

/**
 * Mensaje que se muestra SIEMPRE tras pedir el enlace, exista o no el correo.
 * No revela la existencia de la cuenta (evita enumeración de usuarios).
 */
export const MENSAJE_NEUTRO_RECUPERACION =
  "Si tu correo está registrado, te enviaremos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (y la carpeta de spam).";

/** Longitud mínima de contraseña (coherente con el registro, `minLength={8}`). */
export const MIN_LONGITUD_PASSWORD = 8;

export type ResultadoValidacionPassword =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Valida la contraseña nueva y su confirmación. Mensajes amables en español.
 * Pura: no toca red ni estado.
 */
export function validarPasswordNueva(
  password: string,
  confirmacion: string,
): ResultadoValidacionPassword {
  if (password.length < MIN_LONGITUD_PASSWORD) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${MIN_LONGITUD_PASSWORD} caracteres.`,
    };
  }
  if (password !== confirmacion) {
    return { ok: false, error: "Las dos contraseñas no coinciden." };
  }
  return { ok: true };
}

/**
 * URL absoluta a la que Supabase enviará al usuario tras pulsar el enlace del
 * correo (página `(auth)/restablecer`). Toma el `origin` del navegador para que
 * funcione igual en local, previsualización y producción. Sanea barras finales.
 */
export function urlRedireccionRestablecer(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/restablecer`;
}
