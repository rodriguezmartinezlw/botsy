/**
 * Termómetro de Distrés NCCN — instrumento (WP-16). Módulo PURO y seguro para
 * cliente (solo constantes tipadas + funciones deterministas; sin Supabase ni
 * `next/*`). Es la ÚNICA fuente de verdad del instrumento: su versión, su
 * catálogo de problemas es-ES, la decisión de frecuencia y las agregaciones que
 * consume el panel.
 *
 * IMPORTANTE (reglas de oro 1 y 4 de CLAUDE.md): Botsy ADMINISTRA y REGISTRA el
 * instrumento; NO interpreta el resultado ante el paciente y NO diagnostica. El
 * escalado por puntuación lo decide el motor determinista (regla de programa),
 * no este módulo.
 *
 * TODO lo clínico va marcado [PENDIENTE CLÍNICO] hasta la validación del
 * psicooncólogo (llamada 1): la VERSIÓN del instrumento, la traducción es-ES de
 * los problemas y el UMBRAL de referencia. El umbral efectivo del escalado vive
 * en la config del programa (`escalado.reglas_clave`, condición `instrumento`),
 * no aquí.
 */

import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
} from "date-fns";
import type { Rango, SeriePunto } from "@/lib/agregados";

// --- Identidad y versión del instrumento (CONFIGURABLE, [PENDIENTE CLÍNICO]) --

/** Claves de instrumento soportadas (ampliable; espejo del check del SQL). */
export const INSTRUMENTOS = ["termometro_distres_nccn"] as const;
export type ClaveInstrumento = (typeof INSTRUMENTOS)[number];

/** Orígenes de administración (espejo del check del SQL). */
export const ORIGENES_INSTRUMENTO = ["conversacional", "formulario"] as const;
export type OrigenInstrumento = (typeof ORIGENES_INSTRUMENTO)[number];

/**
 * Versión del instrumento, TRAZADA en cada respuesta (integridad del dato para
 * RWE). CONFIGURABLE por env `TERMOMETRO_DISTRES_VERSION`; el valor por defecto
 * queda marcado [PENDIENTE CLÍNICO] hasta que el psicooncólogo valide la versión
 * es-ES del termómetro y su lista de problemas.
 */
export const VERSION_TERMOMETRO_DISTRES_DEFECTO =
  "nccn-dt-es-v0-PENDIENTE_CLINICO";

/** Versión por defecto por instrumento (extensible cuando haya más de uno). */
const VERSION_POR_INSTRUMENTO: Record<ClaveInstrumento, string> = {
  termometro_distres_nccn: VERSION_TERMOMETRO_DISTRES_DEFECTO,
};

/** Versión trazada de un instrumento (server: respeta el env; cliente: defecto). */
export function versionInstrumento(clave: ClaveInstrumento): string {
  const env =
    typeof process !== "undefined"
      ? process.env?.TERMOMETRO_DISTRES_VERSION
      : undefined;
  if (env && env.trim().length > 0) return env.trim();
  return VERSION_POR_INSTRUMENTO[clave];
}

/** Escala del termómetro: 0 (nada) a 10 (el máximo malestar imaginable). */
export const DISTRES_MIN = 0;
export const DISTRES_MAX = 10;

/**
 * Umbral NCCN estándar de REFERENCIA (≥4 deriva a evaluación). [PENDIENTE
 * CLÍNICO]. El umbral EFECTIVO del escalado es configurable y vive en la regla
 * de programa (`condicion.puntuacion_gte`); esta constante solo documenta el
 * estándar y sirve de referencia al guion (a partir de aquí se recorren los
 * problemas para no alargar el check-in cuando el distrés es bajo).
 */
export const UMBRAL_DISTRES_REFERENCIA = 4;

// --- Catálogo de problemas NCCN (es-ES, [PENDIENTE CLÍNICO]) ------------------

export const CATEGORIAS_PROBLEMA = [
  "practicos",
  "familiares",
  "emocionales",
  "fisicos",
  "espirituales",
] as const;
export type CategoriaProblema = (typeof CATEGORIAS_PROBLEMA)[number];

export type ProblemaNCCN = {
  readonly codigo: string;
  readonly etiqueta: string;
  readonly categoria: CategoriaProblema;
};

/**
 * Subconjunto es-ES de la lista de problemas del Termómetro de Distrés NCCN,
 * agrupado por categoría. NO es la lista oficial cerrada: es un armazón revisable
 * ([PENDIENTE CLÍNICO]) que el psicooncólogo depurará. Los `codigo` son estables
 * (snake_case ascii) para trazar y agregar; las `etiqueta` son legibles.
 */
export const PROBLEMAS_NCCN = [
  // Prácticos
  { codigo: "cuidado_dependientes", etiqueta: "Cuidado de hijos/dependientes", categoria: "practicos" },
  { codigo: "vivienda", etiqueta: "Vivienda", categoria: "practicos" },
  { codigo: "economia_seguro", etiqueta: "Economía / seguro", categoria: "practicos" },
  { codigo: "trabajo_estudios", etiqueta: "Trabajo / estudios", categoria: "practicos" },
  { codigo: "transporte", etiqueta: "Transporte", categoria: "practicos" },
  // Familiares
  { codigo: "relacion_pareja", etiqueta: "Relación con la pareja", categoria: "familiares" },
  { codigo: "relacion_hijos", etiqueta: "Relación con los hijos", categoria: "familiares" },
  { codigo: "salud_familiar", etiqueta: "Salud de un familiar", categoria: "familiares" },
  // Emocionales
  { codigo: "preocupacion", etiqueta: "Preocupación", categoria: "emocionales" },
  { codigo: "miedo", etiqueta: "Miedo", categoria: "emocionales" },
  { codigo: "tristeza", etiqueta: "Tristeza", categoria: "emocionales" },
  { codigo: "nerviosismo", etiqueta: "Nerviosismo", categoria: "emocionales" },
  { codigo: "perdida_interes", etiqueta: "Pérdida de interés", categoria: "emocionales" },
  // Físicos
  { codigo: "dolor_prob", etiqueta: "Dolor", categoria: "fisicos" },
  { codigo: "fatiga_prob", etiqueta: "Fatiga / cansancio", categoria: "fisicos" },
  { codigo: "sueno_prob", etiqueta: "Sueño", categoria: "fisicos" },
  { codigo: "nauseas_prob", etiqueta: "Náuseas", categoria: "fisicos" },
  { codigo: "apetito_prob", etiqueta: "Alimentación / apetito", categoria: "fisicos" },
  // Espirituales
  { codigo: "sentido_vida", etiqueta: "Sentido de la vida", categoria: "espirituales" },
  { codigo: "fe_espiritualidad", etiqueta: "Fe / espiritualidad", categoria: "espirituales" },
] as const satisfies readonly ProblemaNCCN[];

export type CodigoProblema = (typeof PROBLEMAS_NCCN)[number]["codigo"];

/**
 * Tupla de códigos válidos para `z.enum` (misma forma que los vocabularios de
 * `schemas.ts`). Derivada del catálogo: única fuente de verdad.
 */
export const CODIGOS_PROBLEMAS_NCCN = PROBLEMAS_NCCN.map(
  (p) => p.codigo,
) as unknown as readonly [CodigoProblema, ...CodigoProblema[]];

const ETIQUETA_PROBLEMA = new Map<string, ProblemaNCCN>(
  PROBLEMAS_NCCN.map((p) => [p.codigo, p]),
);

/** Etiqueta legible de un código de problema (o el propio código si no consta). */
export function etiquetaProblema(codigo: string): string {
  return ETIQUETA_PROBLEMA.get(codigo)?.etiqueta ?? codigo.replace(/_/g, " ");
}

// --- Frecuencia: ¿toca administrar hoy? --------------------------------------

/** Frecuencia del instrumento (espejo de `FRECUENCIAS_INSTRUMENTO` de config). */
export type FrecuenciaInstrumento = "semanal" | "quincenal" | "ninguna";

/** Días entre administraciones según la frecuencia. `null` = nunca. */
export function periodoDias(frecuencia: FrecuenciaInstrumento): number | null {
  switch (frecuencia) {
    case "semanal":
      return 7;
    case "quincenal":
      return 14;
    case "ninguna":
      return null;
  }
}

/**
 * ¿Toca administrar el termómetro HOY? Decisión PURA a partir de la frecuencia
 * del programa y la fecha del último registro:
 *  - `ninguna` → nunca.
 *  - sin registro previo → sí (primera administración).
 *  - con registro → sí cuando han pasado ≥ periodo días de calendario.
 * Fechas en "yyyy-MM-dd".
 */
export function tocaInstrumento(
  frecuencia: FrecuenciaInstrumento,
  ultimoRegistro: string | null,
  hoy: string,
): boolean {
  const periodo = periodoDias(frecuencia);
  if (periodo === null) return false;
  if (ultimoRegistro === null) return true;
  const dias = differenceInCalendarDays(parseISO(hoy), parseISO(ultimoRegistro));
  return dias >= periodo;
}

// --- Agregaciones para el panel (serie temporal + problemas frecuentes) -------

/** Una respuesta ya fechada (para las agregaciones del panel). */
export type RespuestaDistres = {
  fecha: string;
  puntuacion: number;
  problemas: string[];
};

/**
 * Serie temporal diaria del termómetro (0–10) dentro de un rango. Un punto por
 * CADA día del rango (serie densa; `valor` es `null` los días sin registro). Si
 * un día hubiera más de un registro, promedia. Misma forma que las demás series
 * del panel (`SeriePunto`), para reutilizar `GraficoAreaTemporal`.
 */
export function serieDistres(
  respuestas: RespuestaDistres[],
  rango: Rango,
): SeriePunto[] {
  const acum = new Map<string, { suma: number; n: number }>();
  for (const r of respuestas) {
    if (r.fecha < rango.desde || r.fecha > rango.hasta) continue;
    const prev = acum.get(r.fecha) ?? { suma: 0, n: 0 };
    prev.suma += r.puntuacion;
    prev.n += 1;
    acum.set(r.fecha, prev);
  }
  const dias = eachDayOfInterval({
    start: parseISO(rango.desde),
    end: parseISO(rango.hasta),
  });
  return dias.map((d) => {
    const fecha = format(d, "yyyy-MM-dd");
    const reg = acum.get(fecha);
    return {
      fecha,
      valor: reg ? Math.round((reg.suma / reg.n) * 100) / 100 : null,
    };
  });
}

export type ProblemaFrecuente = {
  codigo: string;
  etiqueta: string;
  categoria: CategoriaProblema | null;
  recuento: number;
};

/**
 * Problemas marcados más frecuentes en un conjunto de respuestas, de más a menos
 * frecuente (desempate por código). Cada problema cuenta una vez por respuesta.
 */
export function problemasFrecuentes(
  respuestas: RespuestaDistres[],
  limite = 6,
): ProblemaFrecuente[] {
  const cuenta = new Map<string, number>();
  for (const r of respuestas) {
    for (const codigo of new Set(r.problemas)) {
      cuenta.set(codigo, (cuenta.get(codigo) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .map(([codigo, recuento]) => ({
      codigo,
      etiqueta: etiquetaProblema(codigo),
      categoria: ETIQUETA_PROBLEMA.get(codigo)?.categoria ?? null,
      recuento,
    }))
    .sort((a, b) => b.recuento - a.recuento || a.codigo.localeCompare(b.codigo))
    .slice(0, limite);
}
