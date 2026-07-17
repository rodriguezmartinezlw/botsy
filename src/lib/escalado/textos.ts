/**
 * Textos del protocolo de escalado — CENTRALIZADOS para revisión clínica futura
 * (RF-ES-02/03). Módulo PURO y seguro para cliente: solo cadenas, sin imports
 * de servidor.
 *
 * Reglas clínicas INNEGOCIABLES de CLAUDE.md aplicadas aquí:
 *  - NUNCA se diagnostica ("puede ser un infarto" está PROHIBIDO): se habla de
 *    "una señal que he detectado", nunca de una causa o enfermedad.
 *  - Tono empático y NO alarmista; las urgencias dan instrucciones claras sin
 *    dramatizar.
 *  - Siempre se distingue "señal detectada" de "diagnóstico".
 *  - Los avisos legales usan la redacción genérica v1 (2026-07); la revisión
 *    por asesoría jurídica antes de pacientes reales es recomendable, no
 *    bloqueante (decisión del fundador, 2026-07-17).
 *
 * Ubicación: al ser textos revisables por clínica/legal, viven juntos y no se
 * incrustan en los componentes.
 */

import type { NivelRiesgo } from "@/types/db";


// --- Textos dirigidos al PACIENTE --------------------------------------------

export const TEXTOS_CONTACTAR = {
  titulo: "Una señal para comentar con tu médico",
  /** Texto literal del WP-04 (tono empático, sin alarmismo, sin diagnóstico). */
  cuerpo:
    "He notado algo que me gustaría que comentes con tu médico hoy. No tiene por qué ser nada grave, pero mejor salir de dudas.",
  aclaracionSenal: "Esto es una señal que he detectado, no un diagnóstico.",
  botonLlamarMedico: "Llamar a mi médico",
  sinTelefonoMedico:
    "No tengo guardado el teléfono de tu médico. Contacta hoy con tu centro de salud para comentárselo.",
} as const;

export const TEXTOS_URGENCIA = {
  titulo: "Es importante que te vea un médico ahora",
  /** Calmado pero inequívoco. Indica actuar; NO nombra causas ni enfermedades. */
  cuerpo:
    "Por lo que me cuentas, es importante que te vea un médico ahora. Mantén la calma: vamos paso a paso y no estás solo.",
  aclaracionSenal:
    "Te aviso de una señal para que actúes con seguridad. No es un diagnóstico.",
  botonEmergencias: "Llamar a Emergencias (112)",
  botonMedico: "Llamar a mi médico",
  instruccion:
    "Si estás con alguien, pídele que se quede contigo mientras llamas.",
  /** Aviso legal (redacción genérica v1). */
  avisoLegal:
    "Botsy no es un servicio de emergencias ni sustituye la valoración de un profesional sanitario. Si crees que tu vida está en peligro, llama de inmediato al número de emergencias de tu país (112 en España, 911/106 en Latinoamérica).",
} as const;

/**
 * `vigilancia` no genera fricción para el paciente (RF-ES): solo se informa al
 * profesional. No hay texto que mostrar; se documenta para que quede explícito.
 */
export const TEXTOS_VIGILANCIA = {
  notaInterna:
    "Nivel 'vigilancia': sin mensaje al paciente; se crea alerta para el profesional.",
} as const;

// --- Instrucciones de TONO para el modelo (transporte texto/voz) -------------
// No son texto que se muestre tal cual: guían al LLM para que su respuesta al
// paciente sea calmada, sin diagnosticar y con la derivación adecuada al nivel.

const TONO_BASE =
  "Mantén un tono calmado, cercano y sin dramatizar. No diagnostiques ni " +
  "interpretes la causa: reconoce lo que la persona te ha contado y distingue " +
  "SIEMPRE 'una señal que he notado' de un diagnóstico.";

export const TONO_MODELO_POR_NIVEL: Record<
  Exclude<NivelRiesgo, "normal">,
  string
> = {
  vigilancia:
    `${TONO_BASE} Es una señal leve: sigue el check-in con normalidad y con calidez. ` +
    "No alarmes a la persona; basta con acompañar.",
  contactar:
    `${TONO_BASE} Sugiérele con amabilidad que contacte HOY con su médico o centro ` +
    "de salud para comentarlo. No es una urgencia; transmítele tranquilidad.",
  urgencia:
    `${TONO_BASE} Con serenidad y sin asustar, dile que es importante que le vea un ` +
    "médico ahora y que puede llamar a los servicios de urgencias (112) o a su " +
    "médico. Ofrece acompañarle paso a paso.",
} as const;
