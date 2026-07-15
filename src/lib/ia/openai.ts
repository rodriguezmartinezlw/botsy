/**
 * Cliente de OpenAI para el motor conversacional (transporte TEXTO).
 *
 * Se expone como una INTERFAZ (`ClienteOpenAI`) para poder inyectar una
 * implementación real (Chat Completions vía `fetch`) o un mock en los tests
 * sin tocar el resto del código (el loop de tool-calls, la reconciliación y
 * los Route Handlers dependen solo de la interfaz).
 *
 * Modelo por variable de entorno (`OPENAI_TEXT_MODEL`), nunca hardcodeado.
 * La clave (`OPENAI_API_KEY`) se lee en tiempo de petición; si falta, se lanza
 * un error claro (y los Route Handlers lo traducen a un 503 amable).
 */

import { esquemaRespuestaOpenAI } from "./schemas";

/** Llamada a una herramienta emitida por el modelo. */
export type LlamadaHerramienta = {
  id: string;
  nombre: string;
  /** Argumentos como cadena JSON (tal cual los emite el modelo). */
  argumentosJson: string;
};

/** Mensaje en la "memoria de trabajo" del turno (neutral, sin acoplar al SDK). */
export type MensajeLLM =
  | { rol: "system"; contenido: string }
  | { rol: "user"; contenido: string }
  | { rol: "assistant"; contenido: string | null; llamadas?: LlamadaHerramienta[] }
  | { rol: "tool"; idLlamada: string; nombre: string; contenido: string };

/** Definición de tool en el formato de Chat Completions. */
export type HerramientaChat = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type EntradaChat = {
  modelo: string;
  mensajes: MensajeLLM[];
  herramientas?: HerramientaChat[];
  /** Fuerza el uso de una tool concreta (usado por la reconciliación). */
  forzarHerramienta?: string;
  temperatura?: number;
};

export type SalidaChat = {
  contenido: string | null;
  llamadas: LlamadaHerramienta[];
};

export interface ClienteOpenAI {
  crearRespuesta(entrada: EntradaChat): Promise<SalidaChat>;
}

// --- Implementación real (Chat Completions vía fetch) -----------------------

type MensajeOpenAI =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

function aMensajeOpenAI(m: MensajeLLM): MensajeOpenAI {
  switch (m.rol) {
    case "system":
      return { role: "system", content: m.contenido };
    case "user":
      return { role: "user", content: m.contenido };
    case "assistant":
      return {
        role: "assistant",
        content: m.contenido,
        ...(m.llamadas && m.llamadas.length > 0
          ? {
              tool_calls: m.llamadas.map((l) => ({
                id: l.id,
                type: "function" as const,
                function: { name: l.nombre, arguments: l.argumentosJson },
              })),
            }
          : {}),
      };
    case "tool":
      return { role: "tool", tool_call_id: m.idLlamada, content: m.contenido };
  }
}

export type OpcionesClienteOpenAI = {
  apiKey?: string;
  baseUrl?: string;
  /** Inyectable para tests; por defecto el `fetch` global de Node 18+. */
  fetchImpl?: typeof fetch;
};

/**
 * Crea el cliente real contra la API de OpenAI (Chat Completions).
 * La clave se resuelve al invocar `crearRespuesta`, no al crear el cliente,
 * para que el módulo pueda importarse sin variables de entorno.
 */
export function crearClienteOpenAI(
  opciones: OpcionesClienteOpenAI = {},
): ClienteOpenAI {
  const baseUrl = opciones.baseUrl ?? "https://api.openai.com/v1";
  const fetchImpl = opciones.fetchImpl ?? fetch;

  return {
    async crearRespuesta(entrada: EntradaChat): Promise<SalidaChat> {
      const apiKey = opciones.apiKey ?? process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error(
          "Falta la variable de entorno OPENAI_API_KEY. Configúrala en .env.local (ver .env.example).",
        );
      }

      const cuerpo: Record<string, unknown> = {
        model: entrada.modelo,
        messages: entrada.mensajes.map(aMensajeOpenAI),
        temperature: entrada.temperatura ?? 0.4,
      };
      if (entrada.herramientas && entrada.herramientas.length > 0) {
        cuerpo.tools = entrada.herramientas;
        cuerpo.tool_choice = entrada.forzarHerramienta
          ? { type: "function", function: { name: entrada.forzarHerramienta } }
          : "auto";
      }

      const respuesta = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(cuerpo),
      });

      if (!respuesta.ok) {
        // No filtramos el cuerpo del error del proveedor al llamante.
        throw new Error(
          `La API de OpenAI respondió con estado ${respuesta.status}.`,
        );
      }

      const json: unknown = await respuesta.json();
      const analizado = esquemaRespuestaOpenAI.safeParse(json);
      if (!analizado.success) {
        throw new Error("Respuesta de OpenAI con forma inesperada.");
      }

      const mensaje = analizado.data.choices[0].message;
      const llamadas: LlamadaHerramienta[] = (mensaje.tool_calls ?? []).map(
        (tc) => ({
          id: tc.id,
          nombre: tc.function.name,
          argumentosJson: tc.function.arguments,
        }),
      );

      return { contenido: mensaje.content ?? null, llamadas };
    },
  };
}

/** Lee el modelo de texto de entorno con un valor por defecto seguro. */
export function modeloTexto(): string {
  const m = process.env.OPENAI_TEXT_MODEL;
  return m && m.trim().length > 0 ? m : "gpt-5-mini";
}
