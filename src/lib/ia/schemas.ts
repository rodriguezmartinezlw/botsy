/**
 * Validación Zod de TODA entrada externa del motor conversacional:
 *  - argumentos de cada tool que el modelo puede llamar (regla de CLAUDE.md:
 *    toda salida estructurada del LLM se valida con Zod antes de persistir; si
 *    no valida, se descarta y se le pide al modelo que corrija — nunca se
 *    inserta a ciegas);
 *  - salida de la reconciliación (segunda pasada estructurada);
 *  - cuerpos JSON de los Route Handlers de `/api/checkin/*`.
 *
 * `aEsquemaJson` deriva el JSON Schema de los parámetros de tools DESDE el
 * esquema Zod, de modo que la definición para el LLM y la validación tienen
 * una única fuente de verdad (no pueden divergir).
 */

import { z } from "zod";

// --- Vocabularios (espejo de los checks del SQL / dominios de checklist) -----

export const DOMINIOS_OBSERVACION = [
  "dolor",
  "sintoma_fisico",
  "animo",
  "ansiedad",
  "estres",
  "sueno",
  "cognicion",
  "adherencia",
  "tratamiento",
  "habitos",
] as const;

export const DOMINIOS_CHECKLIST = [
  "adherencia",
  "dolor",
  "sintomas_fisicos",
  "animo",
  "cognicion",
  "tratamiento",
  "habitos",
] as const;

export const MOMENTOS_PAUTA = ["mañana", "mediodía", "noche"] as const;
export const ESTADOS_TOMA = ["tomada", "omitida", "desconocido"] as const;

/** Código clínico corto en snake_case ascii, p. ej. `dolor_cabeza`, `disnea`. */
const codigoClinico = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9_]+$/,
    "El código debe ir en snake_case ascii (solo minúsculas, dígitos y guion bajo).",
  );

// --- Argumentos de tools (validados antes de persistir) ---------------------

export const esquemaRegistrarObservacion = z
  .object({
    dominio: z.enum(DOMINIOS_OBSERVACION),
    codigo: codigoClinico,
    valor_num: z.number().min(0).max(10).optional(),
    valor_texto: z.string().min(1).max(500).optional(),
    confianza: z.number().min(0).max(1),
  })
  .strict();

export const esquemaRegistrarToma = z
  .object({
    pauta_id: z.string().uuid(),
    momento: z.enum(MOMENTOS_PAUTA),
    estado: z.enum(ESTADOS_TOMA),
  })
  .strict();

export const esquemaMarcarDominioCubierto = z
  .object({
    dominio: z.enum(DOMINIOS_CHECKLIST),
  })
  .strict();

export const esquemaSenalAlarma = z
  .object({
    tipo: z.string().min(1).max(80),
    descripcion: z.string().min(1).max(500),
    evidencia_textual: z.string().min(1).max(1000),
  })
  .strict();

export const esquemaFinalizarCheckin = z
  .object({
    resumen: z.string().min(1).max(1000),
  })
  .strict();

export type ArgsRegistrarObservacion = z.infer<typeof esquemaRegistrarObservacion>;
export type ArgsRegistrarToma = z.infer<typeof esquemaRegistrarToma>;
export type ArgsMarcarDominioCubierto = z.infer<typeof esquemaMarcarDominioCubierto>;
export type ArgsSenalAlarma = z.infer<typeof esquemaSenalAlarma>;
export type ArgsFinalizarCheckin = z.infer<typeof esquemaFinalizarCheckin>;

// --- Reconciliación (segunda pasada estructurada sobre el transcript) --------

export const esquemaObservacionExtraida = z.object({
  dominio: z.enum(DOMINIOS_OBSERVACION),
  codigo: codigoClinico,
  valor_num: z.number().min(0).max(10).nullish(),
  valor_texto: z.string().min(1).max(500).nullish(),
  confianza: z.number().min(0).max(1),
});

export const esquemaLoteExtraccion = z
  .object({
    observaciones: z.array(esquemaObservacionExtraida).max(40),
  })
  .strict();

export type ObservacionExtraida = z.infer<typeof esquemaObservacionExtraida>;
export type LoteExtraccion = z.infer<typeof esquemaLoteExtraccion>;

// --- Cuerpos de los Route Handlers ------------------------------------------

export const esquemaCuerpoMensaje = z
  .object({
    checkinId: z.string().uuid(),
    texto: z.string().trim().min(1).max(2000),
  })
  .strict();

export const esquemaCuerpoFinalizar = z
  .object({
    checkinId: z.string().uuid(),
  })
  .strict();

/**
 * Cuerpo de `POST /api/voz/tool`: la tool-call reenviada desde el data channel
 * del modelo Realtime. Aquí solo se valida la ENVOLTURA; los argumentos
 * (`argumentosJson`) se validan dentro con los esquemas por-tool de arriba
 * (mismos que el modo texto).
 */
export const esquemaCuerpoToolVoz = z
  .object({
    checkinId: z.string().uuid(),
    callId: z.string().min(1).max(200),
    nombre: z.string().min(1).max(80),
    argumentosJson: z.string().max(20000),
  })
  .strict();

/** Cuerpo de `POST /api/voz/finalizar`: como el de texto + ruta de audio opcional. */
export const esquemaCuerpoFinalizarVoz = z
  .object({
    checkinId: z.string().uuid(),
    audioPath: z.string().min(1).max(400).optional(),
  })
  .strict();

export type CuerpoMensaje = z.infer<typeof esquemaCuerpoMensaje>;
export type CuerpoFinalizar = z.infer<typeof esquemaCuerpoFinalizar>;
export type CuerpoToolVoz = z.infer<typeof esquemaCuerpoToolVoz>;
export type CuerpoFinalizarVoz = z.infer<typeof esquemaCuerpoFinalizarVoz>;

// --- Envoltura de la respuesta de OpenAI (Chat Completions) ------------------
// Se valida la forma de la respuesta del proveedor antes de usarla.

export const esquemaLlamadaToolOpenAI = z.object({
  id: z.string(),
  type: z.literal("function").optional(),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export const esquemaRespuestaOpenAI = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z.array(esquemaLlamadaToolOpenAI).nullish(),
        }),
      }),
    )
    .min(1),
});

// --- Derivación de JSON Schema para las definiciones de tool ----------------

/**
 * Convierte un esquema Zod en el JSON Schema que espera OpenAI en
 * `function.parameters`. Elimina la clave `$schema` (no la admite el endpoint).
 */
export function aEsquemaJson(esquema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(esquema, { target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
}
