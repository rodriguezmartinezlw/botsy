/**
 * Escalado en vivo — evaluación de SEÑALES durante la conversación (WP-04).
 *
 * `evaluarSenal` se invoca desde `src/lib/ia/loop.ts` cuando el modelo emite el
 * tool `senal_alarma`. Clasifica la señal SIN esperar al cierre del check-in y
 * devuelve el nivel de riesgo, el motivo y una instrucción de TONO para el
 * modelo. Es PURA y SÍNCRONA (sin IO): la firma que ya consume `loop.ts` se
 * mantiene intacta; la evaluación fina contra `reglas_escalado` de tipo `senal`
 * se hace pasando esas reglas (ya cargadas por quien tiene acceso) en
 * `EntradaSenal.reglas` — campo OPCIONAL, de modo que llamadas sin reglas siguen
 * comportándose de forma conservadora.
 *
 * Comportamiento:
 *  - Si alguna regla `senal` activa casa con el código de la señal (`tipo`),
 *    se usa su nivel (puede ser `urgencia`) y su nombre como motivo.
 *  - Si no hay regla que case, toda señal se trata como `contactar` COMO MÍNIMO
 *    (conservador y no clínico): mejor derivar de más que de menos.
 *
 * La creación de la `alerta` auditable para el profesional NO ocurre aquí (el
 * loop es puro y escribe como el paciente, que por RLS no puede insertar
 * alertas): se materializa al cierre en `evaluarCheckin` + `acciones`, que sí
 * evalúa las reglas `senal` (leídas del audit) de forma idempotente.
 */

import type { NivelRiesgo } from "@/types/db";
import { TONO_MODELO_POR_NIVEL } from "./textos";

/** Niveles que puede emitir el escalado (excluye `normal`). */
export type NivelSenal = Exclude<NivelRiesgo, "normal">;

/** Regla de tipo `senal` reducida a lo que necesita la clasificación en vivo. */
export type ReglaSenal = {
  codigo: string;
  nivel: NivelSenal;
  nombre: string;
};

export type EntradaSenal = {
  tipo: string;
  descripcion: string;
  evidenciaTextual: string;
  /** Vertical del paciente (para trazas; el filtrado por vertical se hace al cargar). */
  vertical?: string | null;
  /**
   * Reglas `senal` aplicables ya cargadas (opcional). Si no se pasan, la señal
   * se clasifica de forma conservadora como `contactar`.
   */
  reglas?: readonly ReglaSenal[];
};

export type ResultadoSenal = {
  nivel: NivelSenal;
  motivo: string;
  /** Código normalizado de la señal (snake_case), útil para trazas/reglas. */
  codigo: string;
  /** Instrucción de tono para el modelo, adecuada al nivel resultante. */
  mensajeParaModelo: string;
};

const ORDEN_RIESGO: Record<NivelRiesgo, number> = {
  normal: 0,
  vigilancia: 1,
  contactar: 2,
  urgencia: 3,
};

/**
 * Devuelve el mayor de dos niveles de riesgo (o `null` si ambos lo son).
 * Se usa para que el riesgo de un check-in solo pueda subir, nunca bajar.
 */
export function nivelMaximoRiesgo(
  a: NivelRiesgo | null,
  b: NivelRiesgo | null,
): NivelRiesgo | null {
  if (a === null) return b;
  if (b === null) return a;
  return ORDEN_RIESGO[a] >= ORDEN_RIESGO[b] ? a : b;
}

/** Normaliza el `tipo`/código de una señal a snake_case ascii acotado. */
export function normalizarCodigoSenal(valor: string): string {
  const limpio = valor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return limpio.length > 0 ? limpio : "senal_no_especificada";
}

/**
 * Evalúa una señal de alarma detectada en la conversación.
 *
 * Pura y síncrona: no toca la base de datos. Si se le pasan `reglas` de tipo
 * `senal`, clasifica según ellas (pudiendo elevar a `urgencia`); si no, aplica
 * el mínimo conservador `contactar`.
 */
export function evaluarSenal(entrada: EntradaSenal): ResultadoSenal {
  const codigo = normalizarCodigoSenal(entrada.tipo);

  const reglaCoincidente = (entrada.reglas ?? []).find(
    (r) => normalizarCodigoSenal(r.codigo) === codigo,
  );

  const nivel: NivelSenal = reglaCoincidente?.nivel ?? "contactar";
  const motivo = reglaCoincidente
    ? reglaCoincidente.nombre
    : `Señal de aviso detectada durante el check-in: ${codigo}`;

  return {
    nivel,
    motivo,
    codigo,
    mensajeParaModelo: TONO_MODELO_POR_NIVEL[nivel],
  };
}
