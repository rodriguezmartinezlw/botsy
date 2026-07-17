/**
 * Constantes/ tipos de consentimientos. Se mantienen fuera del módulo
 * "use server" (que solo puede exportar funciones async).
 */

/** Versión del texto legal vigente (placeholder F1). */
export const VERSION_TEXTO_CONSENTIMIENTO = "v1-generica-2026-07";

export type ResultadoConsentimiento =
  | { ok: true }
  | { ok: false; error: string };
