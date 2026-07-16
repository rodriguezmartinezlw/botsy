/**
 * Estado vigente de consentimientos (WP-07) — módulo PURO (sin Supabase).
 *
 * La tabla `consentimientos` (WP-01) es un histórico APPEND-ONLY: cada cambio
 * añade una fila; el estado vigente de un tipo es el de la ÚLTIMA fila por
 * `registrado_en`. Esta lógica estaba duplicada en varios sitios (página de
 * consentimientos, ruta de voz, página de voz); aquí se centraliza y se testea.
 *
 * Se usa para:
 *  - gatear la conversación (check-in) por el consentimiento `conversacion`,
 *  - decidir si la sesión de voz graba audio (`voz_grabacion`) — integración
 *    con WP-03: revocar `voz_grabacion` hace que la siguiente sesión NO grabe.
 */

import type { TipoConsentimiento } from "@/types/db";

export const TIPOS_CONSENTIMIENTO: readonly TipoConsentimiento[] = [
  "conversacion",
  "voz_grabacion",
  "voz_biomarcadores",
] as const;

/** Estado vigente (otorgado/no) por tipo. */
export type EstadoConsentimientos = Record<TipoConsentimiento, boolean>;

/** Una fila del histórico (lo mínimo que necesita el cálculo del vigente). */
export type FilaConsentimiento = {
  tipo: TipoConsentimiento;
  otorgado: boolean;
  registrado_en: string;
};

/** Estado con todos los tipos a `false` (paciente sin ningún consentimiento). */
export function estadoVacio(): EstadoConsentimientos {
  return {
    conversacion: false,
    voz_grabacion: false,
    voz_biomarcadores: false,
  };
}

/**
 * Calcula el estado vigente a partir del histórico. Ordena por `registrado_en`
 * ascendente (defensivo: no asume que la consulta venga ordenada) y aplica cada
 * fila; la última de cada tipo gana. Filas de tipos desconocidos se ignoran.
 */
export function estadoVigenteConsentimientos(
  filas: readonly FilaConsentimiento[],
): EstadoConsentimientos {
  const estado = estadoVacio();
  const ordenadas = [...filas].sort((a, b) =>
    a.registrado_en.localeCompare(b.registrado_en),
  );
  for (const fila of ordenadas) {
    if (fila.tipo in estado) {
      estado[fila.tipo] = fila.otorgado;
    }
  }
  return estado;
}

/**
 * ¿Puede el paciente conversar (iniciar un check-in por texto o voz)? Requiere
 * el consentimiento `conversacion` vigente. Sin él, la app NO permite conversar.
 */
export function puedeConversar(estado: EstadoConsentimientos): boolean {
  return estado.conversacion === true;
}

/**
 * ¿Debe grabarse el audio en la sesión de voz? Sólo si el consentimiento
 * `voz_grabacion` está vigente (integración con WP-03). Revocarlo hace que la
 * siguiente sesión de voz NO instancie la grabadora.
 */
export function debeGrabarVoz(estado: EstadoConsentimientos): boolean {
  return estado.voz_grabacion === true;
}

/**
 * Historial de un tipo concreto en orden cronológico DESCENDENTE (lo más
 * reciente primero), para mostrar los cambios en la UI del paciente.
 */
export function historialDeTipo(
  filas: readonly FilaConsentimiento[],
  tipo: TipoConsentimiento,
): FilaConsentimiento[] {
  return filas
    .filter((f) => f.tipo === tipo)
    .sort((a, b) => b.registrado_en.localeCompare(a.registrado_en));
}
