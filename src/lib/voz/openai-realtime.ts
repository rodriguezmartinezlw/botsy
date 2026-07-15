/**
 * Implementación de `VoiceSession` sobre OpenAI Realtime por WebRTC (WP-03).
 *
 * Flujo (ADR-001):
 *  1. Recibe un TOKEN EFÍMERO ya emitido por nuestro backend (`/api/voz/sesion`).
 *     La API key real de OpenAI NUNCA llega al cliente.
 *  2. Abre una `RTCPeerConnection`: publica la pista del micrófono, reproduce el
 *     audio remoto y abre un data channel (`oai-events`) para los eventos del
 *     protocolo Realtime.
 *  3. Intercambia SDP con el endpoint de Realtime usando el token efímero.
 *  4. Mapea los eventos entrantes a los manejadores (`onEstado`,
 *     `onTranscripcion`, `onToolCall`, `onError`) y, cuando el modelo pide una
 *     tool, la reenvía a `onToolCall` y devuelve el resultado por el data
 *     channel (`function_call_output` + `response.create`).
 *
 * Este módulo usa exclusivamente APIs de NAVEGADOR (RTCPeerConnection,
 * getUserMedia, DOM) dentro de las funciones — nada en el nivel de módulo —, de
 * modo que solo se ejecuta en el cliente. La instrucción y las tools ya van
 * embebidas en la sesión efímera (server-side), así que aquí no se configura
 * comportamiento del asistente.
 *
 * NOTA DE INTEGRACIÓN: los nombres exactos de eventos y el endpoint SDP de la
 * API Realtime evolucionan. El manejo de eventos es TOLERANTE (por prefijos) y
 * los detalles de red se validan en la prueba manual E2E documentada en la
 * entrega (no se ejercitan en build/test porque requieren navegador + token).
 */

import type {
  EstadoVoz,
  ManejadoresVoz,
  OpcionesSesionVoz,
  ToolCallVoz,
  VoiceSession,
} from "./types";

const URL_BASE_REALTIME_POR_DEFECTO = "https://api.openai.com/v1/realtime/calls";

/** Evento genérico del data channel de Realtime (forma mínima que usamos). */
type EventoRealtime = {
  type?: string;
  delta?: string;
  transcript?: string;
  text?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  error?: { message?: string; code?: string } | string;
};

function parsearEvento(datos: unknown): EventoRealtime | null {
  if (typeof datos !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(datos);
    if (parsed && typeof parsed === "object") return parsed as EventoRealtime;
    return null;
  } catch {
    return null;
  }
}

export function crearSesionOpenAIRealtime(
  opciones: OpcionesSesionVoz,
): VoiceSession {
  const manejadores: ManejadoresVoz = opciones.manejadores ?? {};
  const fetchImpl = opciones.fetchImpl ?? fetch;
  const urlBase = opciones.urlBaseRealtime ?? URL_BASE_REALTIME_POR_DEFECTO;

  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let audioRemoto: HTMLAudioElement | null = null;
  let streamPropio: MediaStream | null = null;
  let cerrada = false;

  function emitirEstado(estado: EstadoVoz): void {
    manejadores.onEstado?.(estado);
  }

  function emitirError(mensaje: string, codigo?: string): void {
    manejadores.onError?.({ mensaje, codigo });
  }

  function enviar(evento: Record<string, unknown>): void {
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(evento));
    }
  }

  async function manejarToolCall(tc: ToolCallVoz): Promise<void> {
    if (!manejadores.onToolCall) return;
    try {
      const resultado = await manejadores.onToolCall(tc);
      // Reintroduce el resultado en la conversación del modelo y pide que siga.
      enviar({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: resultado.callId,
          output: resultado.output,
        },
      });
      enviar({ type: "response.create" });
    } catch {
      // Si el backend falla, informamos al modelo para que no se quede colgado.
      enviar({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: tc.callId,
          output: "ERROR: no se pudo ejecutar la herramienta.",
        },
      });
      enviar({ type: "response.create" });
    }
  }

  function manejarEvento(evento: EventoRealtime): void {
    const tipo = evento.type ?? "";

    // --- Tool-call completa (argumentos listos) ---
    if (tipo.endsWith("function_call_arguments.done")) {
      const nombre = evento.name ?? "";
      const callId = evento.call_id ?? "";
      const argumentosJson = evento.arguments ?? "{}";
      if (nombre && callId) {
        void manejarToolCall({ callId, nombre, argumentosJson });
      }
      return;
    }

    // --- Transcripción del ASISTENTE (audio de salida) ---
    if (tipo.includes("output_audio_transcript") || tipo.includes("audio_transcript")) {
      const parcial = tipo.endsWith(".delta");
      const texto = parcial ? (evento.delta ?? "") : (evento.transcript ?? evento.text ?? "");
      if (texto) {
        manejadores.onTranscripcion?.({ rol: "asistente", texto, final: !parcial });
      }
      return;
    }

    // --- Transcripción del PACIENTE (audio de entrada) ---
    if (tipo.includes("input_audio_transcription")) {
      const parcial = tipo.endsWith(".delta");
      const texto = parcial ? (evento.delta ?? "") : (evento.transcript ?? "");
      if (texto) {
        manejadores.onTranscripcion?.({ rol: "paciente", texto, final: !parcial });
      }
      return;
    }

    // --- Estado conversacional (turn-taking) ---
    if (tipo === "input_audio_buffer.speech_started") {
      emitirEstado("escuchando");
      return;
    }
    if (tipo === "response.created" || tipo.startsWith("response.output_audio.")) {
      emitirEstado("hablando");
      return;
    }
    if (tipo === "response.done" || tipo === "output_audio_buffer.stopped") {
      if (!cerrada) emitirEstado("escuchando");
      return;
    }

    // --- Error del proveedor ---
    if (tipo === "error") {
      const err = evento.error;
      const mensaje =
        typeof err === "string" ? err : (err?.message ?? "Error en la sesión de voz.");
      const codigo = typeof err === "object" ? err?.code : undefined;
      emitirError(mensaje, codigo);
    }
  }

  async function conectar(): Promise<void> {
    if (pc) return; // ya conectada / conectando
    emitirEstado("conectando");

    try {
      // 1. Micrófono: reutiliza el stream de la UI o lo pide (fallback claro).
      streamPropio = opciones.micStream ?? null;
      const stream =
        streamPropio ??
        (await navigator.mediaDevices.getUserMedia({ audio: true }));
      if (!opciones.micStream) streamPropio = stream;

      // 2. Conexión par a par.
      pc = new RTCPeerConnection();

      // Audio remoto → elemento de audio oculto que reproduce a Botsy.
      audioRemoto = document.createElement("audio");
      audioRemoto.autoplay = true;
      audioRemoto.setAttribute("playsinline", "true");
      audioRemoto.style.display = "none";
      document.body.appendChild(audioRemoto);
      pc.ontrack = (e: RTCTrackEvent) => {
        if (audioRemoto) audioRemoto.srcObject = e.streams[0] ?? null;
      };

      for (const pista of stream.getTracks()) {
        pc.addTrack(pista, stream);
      }

      // 3. Data channel de eventos.
      dc = pc.createDataChannel("oai-events");
      dc.onmessage = (e: MessageEvent) => {
        const evento = parsearEvento(e.data);
        if (evento) manejarEvento(evento);
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "connected") {
          emitirEstado("escuchando");
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          if (!cerrada) {
            emitirError("Se perdió la conexión de voz.");
            emitirEstado("error");
          }
        }
      };

      // 4. Oferta SDP → endpoint Realtime con el token efímero.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const respuesta = await fetchImpl(
        `${urlBase}?model=${encodeURIComponent(opciones.modelo)}`,
        {
          method: "POST",
          body: offer.sdp ?? "",
          headers: {
            Authorization: `Bearer ${opciones.token}`,
            "Content-Type": "application/sdp",
          },
        },
      );
      if (!respuesta.ok) {
        throw new Error(`El servicio de voz respondió ${respuesta.status}.`);
      }

      const sdpRespuesta = await respuesta.text();
      await pc.setRemoteDescription({ type: "answer", sdp: sdpRespuesta });
    } catch (e) {
      const mensaje =
        e instanceof Error ? e.message : "No se pudo iniciar la sesión de voz.";
      emitirError(mensaje);
      emitirEstado("error");
      await colgar();
      throw e;
    }
  }

  async function colgar(): Promise<void> {
    if (cerrada) return;
    cerrada = true;
    try {
      dc?.close();
    } catch {
      /* noop */
    }
    dc = null;
    try {
      pc?.close();
    } catch {
      /* noop */
    }
    pc = null;
    // Solo paramos el stream si lo hemos creado nosotros (no el de la UI, que
    // puede seguir grabando hasta subir el audio).
    if (streamPropio && !opciones.micStream) {
      for (const pista of streamPropio.getTracks()) pista.stop();
    }
    streamPropio = null;
    if (audioRemoto) {
      audioRemoto.srcObject = null;
      audioRemoto.remove();
      audioRemoto = null;
    }
    emitirEstado("cerrada");
  }

  function solicitarDespedida(): void {
    // Aviso de fin de sesión: pide a Botsy cerrar con calidez (§ límite de coste).
    enviar({
      type: "response.create",
      response: {
        instructions:
          "El tiempo de esta sesión está terminando. Despídete con calidez en una o dos frases y anima a la persona a volver mañana. No abras temas nuevos.",
      },
    });
  }

  return { conectar, colgar, solicitarDespedida };
}
