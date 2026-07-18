/**
 * Emisión SERVER-SIDE del token efímero de OpenAI Realtime (WP-03 / ADR-001).
 *
 * Este módulo es la ÚNICA pieza que toca la API key real de OpenAI para la voz:
 * pide a OpenAI una sesión efímera con la configuración del asistente
 * (instrucciones + tools construidas por el builder de WP-02, voz en español) y
 * devuelve solo el `client_secret` de corta vida. Ese token es lo único que
 * viaja al cliente; la clave real (`OPENAI_API_KEY`) jamás sale del servidor
 * (regla de CLAUDE.md). Vive en `src/lib/ia/` porque ahí van todas las llamadas
 * a OpenAI.
 *
 * La respuesta del proveedor se valida con Zod antes de usarse. Los nombres de
 * campos de la API Realtime pueden variar entre versiones: la extracción del
 * token es tolerante (`value` o `client_secret.value`).
 */

import { z } from "zod";

/**
 * "Ansiedad" del detector de turnos semántico (cuánto espera antes de responder).
 * Por defecto `medium`: equilibrio entre no interrumpir al paciente y responder
 * con agilidad. `low` esperaba demasiado y la conversación "se quedaba" entre
 * turnos (feedback en teléfono, 2026-07-18). Configurable con
 * `OPENAI_REALTIME_EAGERNESS` (low|medium|high|auto).
 */
export function procesoEagerness(): "low" | "medium" | "high" | "auto" {
  const v = (process.env.OPENAI_REALTIME_EAGERNESS ?? "medium").trim();
  return v === "low" || v === "high" || v === "auto" ? v : "medium";
}

/** Lee el modelo Realtime de entorno (configurable, nunca hardcodeado). */
export function modeloRealtime(): string {
  const m = process.env.OPENAI_REALTIME_MODEL;
  return m && m.trim().length > 0 ? m : "gpt-realtime-2.1-mini";
}

/**
 * Voz TTS del asistente (timbre). El idioma lo fijan las instrucciones (es-ES).
 * Por defecto `marin`: una de las dos voces NUEVAS y naturales de gpt-realtime
 * (junto con `cedar`), mucho menos robótica que las clásicas (alloy/echo…)
 * (feedback 2026-07-18). Configurable con `OPENAI_REALTIME_VOICE`.
 */
export function vozRealtime(): string {
  const v = process.env.OPENAI_REALTIME_VOICE;
  return v && v.trim().length > 0 ? v : "marin";
}

export type ToolRealtime = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type OpcionesSesionRealtime = {
  instrucciones: string;
  tools: ToolRealtime[];
  modelo?: string;
  voz?: string;
  apiKey?: string;
  /** `fetch` inyectable (pruebas); por defecto el global. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

export type SesionRealtime = {
  /** Token efímero (client secret) para el intercambio SDP desde el navegador. */
  token: string;
  expiraEn: number | null;
  modelo: string;
};

const esquemaTokenRealtime = z.object({
  value: z.string().optional(),
  expires_at: z.number().optional(),
  client_secret: z
    .object({ value: z.string(), expires_at: z.number().optional() })
    .optional(),
});

/**
 * Crea una sesión Realtime efímera. Lanza un error claro si falta la clave o si
 * el proveedor responde mal (los Route Handlers lo traducen a un 503 amable).
 */
export async function crearSesionRealtime(
  opciones: OpcionesSesionRealtime,
): Promise<SesionRealtime> {
  const apiKey = opciones.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "Falta la variable de entorno OPENAI_API_KEY. Configúrala en .env.local (ver .env.example).",
    );
  }

  const modelo = opciones.modelo ?? modeloRealtime();
  const voz = opciones.voz ?? vozRealtime();
  const baseUrl = opciones.baseUrl ?? "https://api.openai.com/v1";
  const fetchImpl = opciones.fetchImpl ?? fetch;

  // Configuración de la sesión: instrucciones + tools server-side, transcripción
  // de entrada activada (subtítulos del paciente) y detección de turno por VAD.
  const cuerpo = {
    session: {
      type: "realtime",
      model: modelo,
      instructions: opciones.instrucciones,
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
          // Detección de turno SEMÁNTICA (WP-25): en vez de cortar por silencio
          // (server_vad), un clasificador decide cuándo la persona ha TERMINADO de
          // hablar por lo que dice → menos cortes con pacientes que hacen pausas.
          // `eagerness: 'low'` = espera más antes de responder (población mayor,
          // en tratamiento, que habla despacio). Configurable por env.
          turn_detection: {
            type: "semantic_vad",
            eagerness: procesoEagerness(),
          },
        },
        output: { voice: voz },
      },
      tools: opciones.tools,
      tool_choice: "auto",
    },
  };

  const respuesta = await fetchImpl(`${baseUrl}/realtime/client_secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });

  if (!respuesta.ok) {
    // No se filtra el cuerpo del error del proveedor al llamante.
    throw new Error(`La API de OpenAI (Realtime) respondió ${respuesta.status}.`);
  }

  const json: unknown = await respuesta.json();
  const analizado = esquemaTokenRealtime.safeParse(json);
  if (!analizado.success) {
    throw new Error("Respuesta de OpenAI (Realtime) con forma inesperada.");
  }

  const token = analizado.data.value ?? analizado.data.client_secret?.value;
  if (!token || token.trim().length === 0) {
    throw new Error("OpenAI (Realtime) no devolvió un token efímero.");
  }

  const expiraEn =
    analizado.data.expires_at ?? analizado.data.client_secret?.expires_at ?? null;

  return { token, expiraEn, modelo };
}

/** Límite de duración de una sesión de voz en minutos (control de coste). */
export function maxMinutosVoz(): number {
  const bruto = process.env.VOZ_MAX_MINUTOS;
  const n = bruto ? Number.parseInt(bruto, 10) : NaN;
  if (Number.isFinite(n) && n > 0 && n <= 30) return n;
  return 8;
}
