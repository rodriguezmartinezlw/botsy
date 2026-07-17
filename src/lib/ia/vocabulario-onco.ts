/**
 * Vocabulario oncológico CTCAE simplificado es-ES (WP-11 v2, §C.2) — módulo PURO
 * y seguro para cliente (solo constantes tipadas).
 *
 * Es el subconjunto inicial (~20 códigos) de síntomas que el modelo debe usar
 * como `observaciones.codigo` en los programas de mama. NO es una clasificación
 * clínica cerrada: el psicooncólogo lo revisa en la llamada 1 (`[PENDIENTE
 * CLÍNICO]`). Sirve para dos cosas:
 *   - que el LLM registre síntomas con un código estable y comparable (guía en
 *     el prompt, `GUIA_VOCABULARIO_ONCO`),
 *   - que las reglas de escalado oncológicas casen por `codigo` de forma fiable.
 *
 * IMPORTANTE (regla de oro 1 y 4): estos códigos ESTRUCTURAN lo que la persona
 * cuenta; NO son un diagnóstico ni un grado CTCAE clínico. El grado lo pone el
 * equipo clínico; aquí solo se captura la señal descrita.
 */

import type { DominioObservacion } from "@/types/db";

/** Escala del valor numérico asociado a un código de síntoma. */
export type EscalaObservacion = "0_10" | "celsius" | "ninguna";

export type CodigoOnco = {
  /** Código estable en snake_case ascii para `observaciones.codigo`. */
  readonly codigo: string;
  /** Etiqueta legible es-ES (para el panel y la guía del prompt). */
  readonly etiqueta: string;
  /** Dominio de `observaciones` donde encaja (columna `observaciones.dominio`). */
  readonly dominio: DominioObservacion;
  /** Cómo se interpreta `valor_num`: intensidad 0–10, grados °C, o sin número. */
  readonly escala: EscalaObservacion;
};

/**
 * Catálogo CTCAE simplificado (subconjunto inicial revisable). La fiebre se mide
 * en °C (convive con las escalas 0–10 del resto; ver `esCodigoCelsius`).
 */
export const CATALOGO_CTCAE_SIMPLIFICADO = [
  { codigo: "fiebre", etiqueta: "Fiebre (temperatura corporal)", dominio: "sintoma_fisico", escala: "celsius" },
  { codigo: "nauseas", etiqueta: "Náuseas", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "vomitos", etiqueta: "Vómitos", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "diarrea", etiqueta: "Diarrea", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "estrenimiento", etiqueta: "Estreñimiento", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "mucositis", etiqueta: "Mucositis / llagas en la boca", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "fatiga", etiqueta: "Fatiga / cansancio", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "dolor", etiqueta: "Dolor", dominio: "dolor", escala: "0_10" },
  { codigo: "neuropatia", etiqueta: "Hormigueo / neuropatía", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "alopecia", etiqueta: "Caída del cabello", dominio: "sintoma_fisico", escala: "ninguna" },
  { codigo: "reaccion_cutanea", etiqueta: "Reacción en la piel", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "disnea", etiqueta: "Falta de aire / disnea", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "sofocos", etiqueta: "Sofocos", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "artralgia", etiqueta: "Dolor articular", dominio: "dolor", escala: "0_10" },
  { codigo: "perdida_apetito", etiqueta: "Pérdida de apetito", dominio: "habitos", escala: "0_10" },
  { codigo: "insomnio", etiqueta: "Insomnio", dominio: "sueno", escala: "0_10" },
  { codigo: "ansiedad_onco", etiqueta: "Ansiedad", dominio: "ansiedad", escala: "0_10" },
  { codigo: "animo_bajo", etiqueta: "Ánimo bajo", dominio: "animo", escala: "0_10" },
  { codigo: "edema", etiqueta: "Hinchazón / edema", dominio: "sintoma_fisico", escala: "0_10" },
  { codigo: "sangrado", etiqueta: "Sangrado inusual", dominio: "sintoma_fisico", escala: "ninguna" },
] as const satisfies readonly CodigoOnco[];

export type CodigoOncoConocido =
  (typeof CATALOGO_CTCAE_SIMPLIFICADO)[number]["codigo"];

/** Códigos cuyo `valor_num` se mide en grados Celsius (no en la escala 0–10). */
export const CODIGOS_CELSIUS = ["fiebre", "temperatura"] as const;

/** Rango físico admisible de temperatura corporal en °C (WP-11 v2 §C.2 / WP-13 §3). */
export const RANGO_FIEBRE_CELSIUS = { min: 34, max: 43 } as const;

/** ¿El `valor_num` de este código se interpreta en °C? (fiebre / temperatura) */
export function esCodigoCelsius(codigo: string): boolean {
  return (CODIGOS_CELSIUS as readonly string[]).includes(codigo);
}

/**
 * Rango numérico válido para el `valor_num` de una observación según su código:
 * los códigos en °C usan 34–43; el resto la escala clínica 0–10 (F1).
 */
export function rangoValorNum(codigo: string): { min: number; max: number } {
  if (esCodigoCelsius(codigo)) {
    return { min: RANGO_FIEBRE_CELSIUS.min, max: RANGO_FIEBRE_CELSIUS.max };
  }
  return { min: 0, max: 10 };
}

/**
 * Guía en lenguaje natural para inyectar en el system prompt de los programas
 * oncológicos: qué códigos usar y con qué escala. Determinista (sin números
 * clínicos de umbral: esos viven en las reglas de escalado).
 */
export function guiaVocabularioOnco(): string {
  const lineas = CATALOGO_CTCAE_SIMPLIFICADO.map((c) => {
    const escala =
      c.escala === "celsius"
        ? "en grados (°C)"
        : c.escala === "0_10"
          ? "intensidad 0–10"
          : "sin número";
    return `  - ${c.codigo} (${c.etiqueta}) — ${escala}`;
  }).join("\n");
  return `Cuando registres un síntoma oncológico, usa EXACTAMENTE estos códigos en 'codigo' (no inventes otros):
${lineas}
La fiebre se registra en grados Celsius (p. ej. 38.4), no en la escala 0–10. El resto de síntomas, con intensidad de 0 a 10 si la persona la da.`;
}
