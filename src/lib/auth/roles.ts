import type { RolPerfil } from "@/types/db";

/**
 * Ruta de inicio según el rol tras autenticarse.
 * Puro y sin dependencias de servidor: seguro de importar desde el cliente.
 */
export function rutaPorRol(rol: RolPerfil | string | null | undefined): string {
  return rol === "profesional" || rol === "admin" ? "/pacientes" : "/inicio";
}
