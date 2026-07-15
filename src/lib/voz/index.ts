/**
 * Punto de entrada de la abstracción de voz.
 *
 * La UI importa SOLO desde aquí: la interfaz `VoiceSession` (+ tipos de eventos)
 * y la fábrica `crearSesionVoz`. Nunca importa `openai-realtime.ts` de forma
 * directa (ADR-001: portabilidad de proveedor). Para cambiar de proveedor basta
 * con reapuntar esta fábrica a otra implementación de `VoiceSession`.
 */

import { crearSesionOpenAIRealtime } from "./openai-realtime";
import type { FabricaSesionVoz } from "./types";

export type {
  EstadoVoz,
  RolVoz,
  TranscripcionVoz,
  ToolCallVoz,
  ResultadoToolCallVoz,
  ErrorVoz,
  ManejadoresVoz,
  OpcionesSesionVoz,
  VoiceSession,
  FabricaSesionVoz,
} from "./types";

/** Fábrica de la sesión de voz vigente en F1 (OpenAI Realtime, WebRTC). */
export const crearSesionVoz: FabricaSesionVoz = crearSesionOpenAIRealtime;
