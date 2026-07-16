/**
 * Lógica PURA de la bandeja de alertas del panel profesional (WP-06).
 *
 * Sin IO: recibe alertas ya leídas (por el loader de servidor, con la RLS de
 * profesional de WP-01) y las prioriza. Prioridad: urgencia > contactar >
 * vigilancia; a igual nivel, la más reciente primero. Se testea sin base de
 * datos.
 */

import type { EstadoAlerta, NivelEscalado } from "@/types/db";
import { PESO_NIVEL } from "./lista";

/** Alerta reducida a lo que la bandeja necesita para ordenar y mostrar. */
export type AlertaBandeja = {
  id: string;
  pacienteId: string;
  nivel: NivelEscalado;
  estado: EstadoAlerta;
  motivo: string;
  /** Timestamp ISO de creación (para desempatar por fecha). */
  creadoEn: string;
};

/**
 * Orden de la bandeja (WP-06): por nivel (urgencia primero), y dentro del mismo
 * nivel, la más reciente primero. No muta el array de entrada.
 */
export function ordenarBandeja<T extends AlertaBandeja>(alertas: T[]): T[] {
  return [...alertas].sort((a, b) => {
    const porNivel = PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel];
    if (porNivel !== 0) return porNivel;
    // Más reciente primero (timestamps ISO comparables como cadena).
    return b.creadoEn.localeCompare(a.creadoEn);
  });
}

export type FiltrosBandeja = {
  estado?: EstadoAlerta;
  nivel?: NivelEscalado;
  pacienteId?: string;
};

/** Aplica los filtros (estado / nivel / paciente) de la bandeja. Puro. */
export function filtrarBandeja<T extends AlertaBandeja>(
  alertas: T[],
  filtros: FiltrosBandeja,
): T[] {
  return alertas.filter((a) => {
    if (filtros.estado && a.estado !== filtros.estado) return false;
    if (filtros.nivel && a.nivel !== filtros.nivel) return false;
    if (filtros.pacienteId && a.pacienteId !== filtros.pacienteId) return false;
    return true;
  });
}

/** ¿La alerta está "abierta" (pendiente de gestión)? nueva o vista. */
export function esAlertaAbierta(estado: EstadoAlerta): boolean {
  return estado === "nueva" || estado === "vista";
}
