/**
 * Escalado — STUB de F1 (WP-02).
 *
 * El motor de reglas completo (niveles normal/vigilancia/contactar/urgencia
 * evaluados contra `reglas_escalado`, generación de `alertas` con evidencia,
 * auditoría) es responsabilidad de WP-04. Aquí solo dejamos el PUNTO DE
 * INTEGRACIÓN que usa el tool `senal_alarma` durante la conversación:
 * `evaluarSenal` recibe una señal detectada por el modelo y devuelve el nivel
 * de riesgo y el mensaje calmado que el asistente debe transmitir.
 *
 * Comportamiento F1 (deliberadamente conservador y simple, no clínico):
 * toda señal de alarma detectada se trata como `contactar` COMO MÍNIMO. La
 * clasificación fina (p. ej. urgencia por combinación dolor torácico + disnea
 * en vertical cardiovascular) la hará WP-04 leyendo `reglas_escalado`; ese
 * motor podrá ELEVAR el nivel, nunca rebajarlo por debajo de lo que aquí se
 * fija. No implementamos esa lógica aquí para no invadir el alcance de WP-04.
 */

import type { NivelRiesgo } from "@/types/db";

/** Niveles que puede emitir el escalado (excluye `normal`). */
export type NivelSenal = Exclude<NivelRiesgo, "normal">;

export type EntradaSenal = {
  tipo: string;
  descripcion: string;
  evidenciaTextual: string;
  /** Vertical del paciente; el motor de WP-04 lo usará para reglas por vertical. */
  vertical?: string | null;
};

export type ResultadoSenal = {
  nivel: NivelSenal;
  motivo: string;
  /** Instrucción para el modelo: tono calmado + sugerir contacto con el médico. */
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

/**
 * STUB de evaluación de una señal de alarma detectada en la conversación.
 *
 * TODO WP-04: reemplazar por el motor de reglas configurables
 * (`reglas_escalado`), que además creará la `alerta` para el profesional con
 * la evidencia y podrá elevar el nivel a `urgencia` según vertical/combinación.
 */
export function evaluarSenal(entrada: EntradaSenal): ResultadoSenal {
  const tipo = entrada.tipo.trim().slice(0, 120) || "señal_no_especificada";

  return {
    nivel: "contactar",
    motivo: `Señal de aviso detectada durante el check-in: ${tipo}`,
    mensajeParaModelo:
      "Se ha registrado una posible señal de aviso. Mantén un tono calmado, " +
      "cercano y sin dramatizar. No diagnostiques ni interpretes la causa: " +
      "reconoce lo que la persona te ha contado y sugiérele con amabilidad que " +
      "contacte HOY con su médico o centro de salud. Si lo que describe parece " +
      "una emergencia (por ejemplo dificultad grave para respirar o dolor " +
      "intenso en el pecho), dile con serenidad que llame a los servicios de " +
      "urgencias. Después, sigue el check-in solo si la persona está tranquila.",
  };
}
