/**
 * Configuración de un programa de monitorización (WP-11 v2, §A.2) — módulo PURO
 * y seguro para servidor. Solo depende de `zod` y del TIPO/esquema de `Condicion`
 * (WP-04), de modo que NO arrastra código de servidor (Supabase / next/headers).
 *
 * La entidad `programa` (catálogo) y `programas_paciente` (asignación) guardan la
 * config en columnas `jsonb`. Aquí vive:
 *  - `EsquemaConfigPrograma`: la FORMA CANÓNICA (Zod) que valida esa jsonb.
 *  - `CONFIG_POR_DEFECTO`: la config que reproduce el comportamiento de F1
 *    (un paciente SIN programa asignado se comporta con esta config).
 *  - `configEfectiva(plantilla, override)`: deep-merge validado con fallback
 *    seguro (plantilla del catálogo + override por paciente). Puro y testeado.
 *
 * Todos los umbrales clínicos concretos viven en el SEED de cada programa
 * (`escalado.reglas_clave`) y van marcados `[PENDIENTE CLÍNICO]`; este módulo
 * solo define la estructura, no los números.
 */

import { z } from "zod";
import { esquemaCondicion, type Condicion } from "@/lib/escalado/motor";
import { DOMINIOS_CHECKLIST } from "@/lib/ia/schemas";

// --- Vocabularios ------------------------------------------------------------

export const FRECUENCIAS_CHECKIN = ["diaria", "cada_2_dias", "semanal"] as const;
export type FrecuenciaCheckin = (typeof FRECUENCIAS_CHECKIN)[number];

export const RITMOS_CONVERSACION = ["calmado", "normal"] as const;
export type RitmoConversacion = (typeof RITMOS_CONVERSACION)[number];

export const FRECUENCIAS_INSTRUMENTO = [
  "semanal",
  "quincenal",
  "ninguna",
] as const;

export const NIVELES_ESCALADO = ["vigilancia", "contactar", "urgencia"] as const;

// --- Sub-esquemas ------------------------------------------------------------

/**
 * Pregunta extra que el programa añade al guion del check-in. `dominio` es
 * opcional: si se indica, orienta al modelo sobre dónde registrar la respuesta.
 */
export const esquemaPreguntaExtra = z
  .object({
    clave: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_]+$/, "clave en snake_case ascii"),
    texto: z.string().min(1).max(300),
    dominio: z.enum(DOMINIOS_CHECKLIST).optional(),
  })
  .strict();

export type PreguntaExtra = z.infer<typeof esquemaPreguntaExtra>;

/**
 * Regla clave del programa. Al asignar el programa a un paciente, cada regla se
 * MATERIALIZA como una fila de `reglas_escalado` de ese paciente (WP-11 §A.5).
 * `clave` es el identificador estable para la activación IDEMPOTENTE.
 */
export const esquemaReglaClave = z
  .object({
    clave: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_]+$/, "clave en snake_case ascii"),
    nombre: z.string().min(1).max(160),
    descripcion: z.string().max(400).optional(),
    nivel: z.enum(NIVELES_ESCALADO),
    condicion: esquemaCondicion,
  })
  .strict();

export type ReglaClave = z.infer<typeof esquemaReglaClave>;

export const esquemaEstiloCheckin = z
  .object({
    ritmo: z.enum(RITMOS_CONVERSACION),
    frases_cortas: z.boolean(),
    repeticion: z.boolean(),
  })
  .strict();

export const esquemaFase = z
  .object({
    clave: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_]+$/, "clave en snake_case ascii"),
    nombre: z.string().min(1).max(120),
    dia_inicio: z.number().int().min(0).optional(),
  })
  .strict();

// --- Esquema canónico completo ----------------------------------------------

export const EsquemaConfigPrograma = z
  .object({
    modulos: z
      .object({
        voz: z.boolean(),
        texto: z.boolean(),
        recomendaciones: z.boolean(),
      })
      .strict(),
    perfil_graficos: z
      .object({
        dolor: z.boolean(),
        animo: z.boolean(),
        adherencia: z.boolean(),
        sintomas: z.boolean(),
        sueno: z.boolean(),
        cognicion: z.boolean(),
      })
      .strict(),
    checkin: z
      .object({
        frecuencia: z.enum(FRECUENCIAS_CHECKIN),
        dominios: z.array(z.enum(DOMINIOS_CHECKLIST)).min(1),
        preguntas_extra: z.array(esquemaPreguntaExtra).max(20),
        estilo: esquemaEstiloCheckin,
      })
      .strict(),
    escalado: z
      .object({
        reglas_clave: z.array(esquemaReglaClave).max(40),
      })
      .strict(),
    instrumentos: z
      .object({
        // Consumido por WP-16 (termómetro NCCN). Aquí solo el hueco estructural.
        termometro_distres: z
          .object({
            activo: z.boolean(),
            frecuencia: z.enum(FRECUENCIAS_INSTRUMENTO),
          })
          .strict(),
      })
      .strict(),
    fases: z.array(esquemaFase).max(20).optional(),
  })
  .strict();

export type ConfigPrograma = z.infer<typeof EsquemaConfigPrograma>;

// --- Config por defecto (comportamiento F1 intacto) --------------------------

/**
 * Config que reproduce el comportamiento de F1: todos los módulos activos, los 7
 * dominios de la checklist, sin preguntas extra ni reglas de programa, y el
 * termómetro apagado. Un paciente SIN programa asignado usa exactamente esto.
 */
export const CONFIG_POR_DEFECTO: ConfigPrograma = {
  modulos: { voz: true, texto: true, recomendaciones: true },
  perfil_graficos: {
    dolor: true,
    animo: true,
    adherencia: true,
    sintomas: true,
    sueno: true,
    cognicion: true,
  },
  checkin: {
    frecuencia: "diaria",
    dominios: [...DOMINIOS_CHECKLIST],
    preguntas_extra: [],
    estilo: { ritmo: "normal", frases_cortas: true, repeticion: false },
  },
  escalado: { reglas_clave: [] },
  instrumentos: { termometro_distres: { activo: false, frecuencia: "ninguna" } },
};

// --- Deep-merge + configEfectiva --------------------------------------------

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge de objetos planos: para cada clave, si AMBOS lados son objetos
 * planos se fusionan recursivamente; en cualquier otro caso (escalares, arrays,
 * null) el valor de la DERECHA (override) reemplaza al de la izquierda. Los
 * arrays se reemplazan enteros a propósito (p. ej. `dominios`, `reglas_clave`):
 * un override que toca un array declara la lista completa, no un parche parcial.
 */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!esObjetoPlano(base) || !esObjetoPlano(override)) return override;
  const resultado: Record<string, unknown> = { ...base };
  for (const [clave, valor] of Object.entries(override)) {
    if (valor === undefined) continue;
    resultado[clave] = deepMerge(base[clave], valor);
  }
  return resultado;
}

export type OrigenConfig = "efectiva" | "plantilla" | "defecto";

export type ResultadoConfigEfectiva = {
  config: ConfigPrograma;
  /**
   * De dónde salió la config finalmente devuelta:
   *  - `efectiva`: default + plantilla + override, validado OK.
   *  - `plantilla`: el override rompía el esquema; se cayó a default + plantilla.
   *  - `defecto`: también la plantilla rompía; se cayó a `CONFIG_POR_DEFECTO`.
   */
  origen: OrigenConfig;
};

/**
 * Calcula la config EFECTIVA de un paciente combinando, en este orden:
 *   `CONFIG_POR_DEFECTO`  ◂  plantilla del catálogo  ◂  override del paciente.
 *
 * Deep-merge validado con FALLBACK SEGURO: si el resultado no valida contra
 * `EsquemaConfigPrograma`, se descarta el override (nivel `plantilla`); si la
 * plantilla tampoco valida, se devuelve `CONFIG_POR_DEFECTO` (nivel `defecto`).
 * Nunca lanza: una config corrupta degrada a un comportamiento seguro conocido.
 * Función PURA.
 */
export function configEfectiva(
  plantilla: unknown,
  override: unknown = {},
): ResultadoConfigEfectiva {
  const conPlantilla = deepMerge(CONFIG_POR_DEFECTO, plantilla);

  const efectiva = deepMerge(conPlantilla, override);
  const r1 = EsquemaConfigPrograma.safeParse(efectiva);
  if (r1.success) return { config: r1.data, origen: "efectiva" };

  const r2 = EsquemaConfigPrograma.safeParse(conPlantilla);
  if (r2.success) return { config: r2.data, origen: "plantilla" };

  return { config: CONFIG_POR_DEFECTO, origen: "defecto" };
}

/** Valida una config completa; `null` si no cumple el esquema canónico. */
export function parsearConfigPrograma(valor: unknown): ConfigPrograma | null {
  const r = EsquemaConfigPrograma.safeParse(valor);
  return r.success ? r.data : null;
}

// --- Gating de módulos (decisión pura) ---------------------------------------

export type ModuloPrograma = "voz" | "texto" | "recomendaciones";

/**
 * ¿Está activo un módulo en esta config? Decisión PURA que respalda el gating
 * server-side: la ruta la usa para responder 403/redirección cuando el módulo
 * está apagado (nunca basta con ocultar el botón — WP-11 §A.3).
 */
export function moduloActivo(
  config: ConfigPrograma,
  modulo: ModuloPrograma,
): boolean {
  return config.modulos[modulo] === true;
}

// --- Reglas clave: selección para activación idempotente ---------------------

/**
 * Dada la config efectiva de un programa y el conjunto de claves de regla YA
 * materializadas para el paciente (las que ya existen en `reglas_escalado`),
 * devuelve las reglas clave que FALTAN por insertar. Idempotente: si todas
 * están, devuelve `[]`. Función PURA (el IO lo hace la Server Action).
 */
export function reglasClavePendientes(
  config: ConfigPrograma,
  clavesExistentes: readonly string[],
): ReglaClave[] {
  const existentes = new Set(clavesExistentes);
  return config.escalado.reglas_clave.filter((r) => !existentes.has(r.clave));
}

/** Todas las claves de regla que un programa aporta (para desactivar al suspender). */
export function clavesReglasPrograma(config: ConfigPrograma): string[] {
  return config.escalado.reglas_clave.map((r) => r.clave);
}

// --- Condicion re-export (comodidad para consumidores del módulo) ------------
export type { Condicion };
