/**
 * Disposición estructurada obligatoria (WP-11 v2 §B, regla de oro 3) — módulo
 * PURO (solo `zod` + `date-fns`). Aquí viven:
 *   - los vocabularios (decisiones / desenlaces) y sus etiquetas es-ES,
 *   - el esquema Zod ESTRICTO que exige una disposición completa: sin
 *     `decision` + `motivo` codificado + `dias_seguimiento`, la mutación se
 *     RECHAZA (resolver/descartar una alerta sin disposición es imposible),
 *   - la lógica de "desenlaces pendientes": qué disposiciones tienen el
 *     seguimiento vencido y siguen sin desenlace registrado.
 *
 * Las Server Actions (`resolverAlerta`/`descartarAlerta`) consumen el esquema;
 * la vista del panel consume `filtrarDesenlacesPendientes`.
 */

import { z } from "zod";
import { addDays, isAfter, parseISO } from "date-fns";
import type {
  DecisionDisposicion,
  DesenlaceDisposicion,
} from "@/types/db";

// --- Vocabularios (espejo de los checks del SQL 0007) ------------------------

export const DECISIONES_DISPOSICION = [
  "contactado_paciente",
  "ajuste_pauta",
  "derivado_consulta",
  "derivado_urgencias",
  "observacion",
  "sin_accion_justificada",
] as const;

export const ETIQUETA_DECISION: Record<DecisionDisposicion, string> = {
  contactado_paciente: "Contactado el paciente",
  ajuste_pauta: "Ajuste de pauta / soporte",
  derivado_consulta: "Derivado a consulta",
  derivado_urgencias: "Derivado a urgencias",
  observacion: "En observación",
  sin_accion_justificada: "Sin acción (justificada)",
};

export const DESENLACES_DISPOSICION = [
  "pendiente",
  "resuelto_sin_evento",
  "visita_no_programada",
  "urgencias",
  "hospitalizacion",
  "discontinuacion",
  "otro",
] as const;

export const ETIQUETA_DESENLACE: Record<DesenlaceDisposicion, string> = {
  pendiente: "Pendiente",
  resuelto_sin_evento: "Resuelto sin evento",
  visita_no_programada: "Visita no programada",
  urgencias: "Urgencias",
  hospitalizacion: "Hospitalización",
  discontinuacion: "Discontinuación",
  otro: "Otro",
};

/** Desenlaces que un profesional puede REGISTRAR (todos menos 'pendiente'). */
export const DESENLACES_REGISTRABLES = DESENLACES_DISPOSICION.filter(
  (d): d is Exclude<DesenlaceDisposicion, "pendiente"> => d !== "pendiente",
);

// --- Esquema estricto de la disposición --------------------------------------

/**
 * Entrada mínima OBLIGATORIA para cerrar una alerta. `motivo_codigo` es el id de
 * una fila de `catalogo_motivos` (validado además contra el catálogo por la
 * Server Action). Sin decisión, motivo o días de seguimiento, no valida.
 */
export const esquemaDisposicion = z
  .object({
    alertaId: z.string().uuid(),
    decision: z.enum(DECISIONES_DISPOSICION),
    motivoCodigo: z.string().uuid(),
    motivoTexto: z.string().trim().min(1).max(500).optional(),
    diasSeguimiento: z.number().int().min(0).max(365),
  })
  .strict();

export type EntradaDisposicion = z.infer<typeof esquemaDisposicion>;

export type ResultadoValidacion =
  | { ok: true; datos: EntradaDisposicion }
  | { ok: false; error: string };

/**
 * Valida una disposición completa. Devuelve un error legible si falta CUALQUIER
 * parte (la ausencia de disposición → rechazo). Nunca lanza.
 */
export function validarDisposicion(entrada: unknown): ResultadoValidacion {
  const r = esquemaDisposicion.safeParse(entrada);
  if (!r.success) {
    return {
      ok: false,
      error:
        "Para cerrar la alerta debes registrar una disposición completa: decisión, motivo del catálogo y días de seguimiento.",
    };
  }
  return { ok: true, datos: r.data };
}

// --- Registro de desenlace ---------------------------------------------------

export const esquemaRegistrarDesenlace = z
  .object({
    disposicionId: z.string().uuid(),
    desenlace: z.enum(DESENLACES_REGISTRABLES),
    nota: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type EntradaRegistrarDesenlace = z.infer<
  typeof esquemaRegistrarDesenlace
>;

// --- Desenlaces pendientes (seguimiento vencido) -----------------------------

export type DisposicionSeguimiento = {
  id: string;
  diasSeguimiento: number;
  desenlace: DesenlaceDisposicion;
  /** ISO del momento de creación de la disposición. */
  creadoEn: string;
};

/** Fecha (Date) en que vence el seguimiento de una disposición. */
export function fechaVencimiento(d: DisposicionSeguimiento): Date {
  return addDays(parseISO(d.creadoEn), d.diasSeguimiento);
}

/**
 * ¿El seguimiento de esta disposición está VENCIDO y aún sin desenlace? Vencido
 * = fecha de vencimiento en o antes de `hoy` y `desenlace = 'pendiente'`.
 */
export function desenlacePendienteVencido(
  d: DisposicionSeguimiento,
  hoyISO: string,
): boolean {
  if (d.desenlace !== "pendiente") return false;
  const hoy = parseISO(hoyISO);
  const vence = fechaVencimiento(d);
  // Vencido si NO es posterior a hoy (vence <= hoy).
  return !isAfter(vence, hoy);
}

/**
 * Filtra las disposiciones con seguimiento vencido y desenlace pendiente,
 * ordenadas por vencimiento ASCENDENTE (lo más atrasado primero). Puro.
 */
export function filtrarDesenlacesPendientes<T extends DisposicionSeguimiento>(
  lista: readonly T[],
  hoyISO: string,
): T[] {
  return lista
    .filter((d) => desenlacePendienteVencido(d, hoyISO))
    .sort(
      (a, b) => fechaVencimiento(a).getTime() - fechaVencimiento(b).getTime(),
    );
}
