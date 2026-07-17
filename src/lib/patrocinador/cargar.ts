/**
 * Carga de datos del área del patrocinador (WP-17/WP-15) — SERVER ONLY.
 * Elige el camino según `DEMO_MODE`: demo sintético (sin claves) o RPC de
 * agregados sobre la sesión del patrocinador. Devuelve `null` si el camino de
 * producción no tiene sesión válida (el page responde 404 / redirect).
 */

import "server-only";
import { format } from "date-fns";
import { modoDemo } from "@/lib/demo";
import { obtenerSesionPatrocinador } from "./sesion-patrocinador";
import {
  agregadosDemo,
  agregadosSupabase,
  type DatosDashboard,
} from "./proveedor";

/** Fecha de hoy (yyyy-MM-dd) en la zona del servidor. */
export function fechaHoy(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export async function cargarDatosPatrocinador(): Promise<DatosDashboard | null> {
  if (modoDemo()) return agregadosDemo(fechaHoy());
  const sesion = await obtenerSesionPatrocinador();
  if (!sesion) return null;
  return agregadosSupabase(sesion.supabase, sesion.nombrePatrocinador ?? "Patrocinador");
}
