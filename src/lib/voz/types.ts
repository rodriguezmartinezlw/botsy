/**
 * Abstracción de VOZ (WP-03 / ADR-001).
 *
 * `VoiceSession` es la ÚNICA superficie de la que depende la UI: la pantalla de
 * llamada no conoce a OpenAI Realtime ni al transporte WebRTC. Cambiar de
 * proveedor (Gemini Live, un pipeline propio…) debe ser cambiar la
 * implementación de esta interfaz, no reescribir el producto (ADR-001).
 *
 * Módulo PURO de tipos: no importa ninguna implementación ni toca APIs de
 * navegador en tiempo de carga, de modo que puede compartirse sin acoplar la UI
 * a un transporte concreto.
 */

/** Estado observable de la sesión de voz (para onda/estado de la UI). */
export type EstadoVoz =
  | "inactiva"
  | "conectando"
  | "escuchando" // Botsy escucha al paciente (el paciente habla)
  | "hablando" // Botsy habla
  | "cerrada"
  | "error";

export type RolVoz = "paciente" | "asistente";

/** Fragmento de transcripción en vivo (subtítulos, RF-CV-09). */
export type TranscripcionVoz = {
  rol: RolVoz;
  texto: string;
  /** `false` = parcial (streaming); `true` = turno cerrado. */
  final: boolean;
};

/** Tool-call emitida por el modelo por el data channel. */
export type ToolCallVoz = {
  callId: string;
  nombre: string;
  /** Argumentos como cadena JSON, tal cual los emite el modelo. */
  argumentosJson: string;
};

/** Resultado de una tool-call que se devuelve al modelo por el data channel. */
export type ResultadoToolCallVoz = {
  callId: string;
  /** Texto (normalmente el mensaje que devuelve el servidor tras ejecutarla). */
  output: string;
};

export type ErrorVoz = {
  mensaje: string;
  codigo?: string;
};

/** Manejadores de eventos que la UI registra al crear la sesión. */
export type ManejadoresVoz = {
  onEstado?: (estado: EstadoVoz) => void;
  onTranscripcion?: (t: TranscripcionVoz) => void;
  /**
   * El transporte entrega cada tool-call aquí; el manejador (la UI) la reenvía
   * al backend (`/api/voz/tool`), que la valida/ejecuta, y devuelve el
   * resultado, que el transporte reintroduce en la conversación del modelo.
   */
  onToolCall?: (tc: ToolCallVoz) => Promise<ResultadoToolCallVoz>;
  onError?: (e: ErrorVoz) => void;
};

/** Parámetros para instanciar una sesión de voz. */
export type OpcionesSesionVoz = {
  /** Token EFÍMERO obtenido de nuestro backend. Nunca la API key real. */
  token: string;
  /** Modelo Realtime (p. ej. el valor de OPENAI_REALTIME_MODEL). */
  modelo: string;
  /**
   * Stream del micrófono ya obtenido por la UI (para compartirlo con la
   * grabación local). Si no se pasa, la implementación lo solicita ella misma.
   */
  micStream?: MediaStream;
  manejadores?: ManejadoresVoz;
  /** URL base del endpoint de intercambio SDP (inyectable para pruebas). */
  urlBaseRealtime?: string;
  /** `fetch` inyectable (pruebas); por defecto el global del navegador. */
  fetchImpl?: typeof fetch;
};

/**
 * Sesión de voz full-duplex. La UI solo usa `conectar`/`colgar` y los eventos.
 * `solicitarDespedida` es OPCIONAL (no todo proveedor lo soporta): permite
 * pedir al asistente que se despida antes del corte por límite de tiempo.
 */
export interface VoiceSession {
  conectar(): Promise<void>;
  colgar(): Promise<void>;
  solicitarDespedida?(): void;
}

/** Firma de una fábrica de sesiones de voz (lo que consume la UI). */
export type FabricaSesionVoz = (opciones: OpcionesSesionVoz) => VoiceSession;
