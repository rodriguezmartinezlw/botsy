import type { RolPerfil } from "@/types/db";

/**
 * Ruta de inicio según el rol tras autenticarse.
 * Puro y sin dependencias de servidor: seguro de importar desde el cliente.
 *   profesional/admin -> panel; patrocinador -> su dashboard; paciente -> app.
 */
export function rutaPorRol(rol: RolPerfil | string | null | undefined): string {
  if (rol === "profesional" || rol === "admin") return "/pacientes";
  if (rol === "patrocinador") return "/patrocinador";
  return "/inicio";
}

/**
 * Saneado del destino tras login (WP-10 ítem 6): solo rutas RELATIVAS internas.
 * Evita open-redirect (`//host`, `https://…`, `/\host`). Devuelve `null` si el
 * valor no es una ruta interna segura. Puro y cliente-seguro.
 */
export function destinoSeguro(next: unknown): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  if (!next.startsWith("/")) return null; // debe ser relativa
  if (next.startsWith("//") || next.startsWith("/\\")) return null; // protocolo-relativa
  if (next.includes("://")) return null;
  return next;
}
