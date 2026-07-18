"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Ear,
  Keyboard,
  Loader2,
  Mic,
  PhoneOff,
  Sparkles,
  Volume2,
} from "lucide-react";
import type { NivelRiesgo, TipoCheckin, VerticalPaciente } from "@/types/db";
import { DOMINIOS_CHECKIN, type DominioCheckin } from "@/lib/ia/dominios";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  comprobarSoporteMicrofono,
  explicarErrorMicrofono,
} from "@/lib/voz/diagnostico-microfono";
import {
  crearSesionVoz,
  type EstadoVoz,
  type VoiceSession,
} from "@/lib/voz";
import { recomendacionDelDia } from "../recomendaciones";
import PantallaUrgencia from "../PantallaUrgencia";
import TarjetaContactar from "../TarjetaContactar";

type Fase =
  | "consentimiento"
  | "inicial"
  | "conectando"
  | "llamada"
  | "cerrando"
  | "cierre"
  | "fallo";

type RespuestaSesion = {
  token: string;
  modelo: string;
  checkinId: string;
  tipo: TipoCheckin;
  pacienteId: string;
  fecha: string;
  maxMinutos: number;
  consentimientos: {
    conversacion: boolean;
    voz_grabacion: boolean;
    voz_biomarcadores: boolean;
  };
};

type RespuestaTool = {
  output: string;
  riesgo: NivelRiesgo | null;
  dominiosCubiertos: DominioCheckin[];
  finalizar: boolean;
};

type RespuestaFinalizar = {
  resumen: string;
  riesgo: NivelRiesgo | null;
  telefono_medico: string | null;
  racha_actual: number;
  racha_maxima: number;
};

type LineaSubtitulo = { rol: "paciente" | "asistente"; texto: string };

const PIEZAS_CONFETI = [
  "var(--color-primario)",
  "var(--color-acento)",
  "var(--color-primario-suave)",
  "var(--color-acento-fuerte)",
  "var(--color-vigilancia)",
];

/** Sesión expirada (401): al login conservando el destino (WP-08, robustez). */
function redirigirALogin(): void {
  if (typeof window === "undefined") return;
  const destino = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(destino)}`;
}

function elegirMimeGrabacion(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  for (const c of candidatos) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

export default function PantallaVoz({
  vertical,
  tipo = "checkin",
  consentimientoConversacion,
  consentimientoGrabacion,
}: {
  vertical: VerticalPaciente;
  /** 'consulta' (WP-24) abre una conversación a demanda: sin checklist ni racha. */
  tipo?: TipoCheckin;
  consentimientoConversacion: boolean;
  consentimientoGrabacion: boolean;
}) {
  const router = useRouter();
  const esConsulta = tipo === "consulta";
  const hrefTexto = esConsulta ? "/checkin?tipo=consulta" : "/checkin";

  const [fase, setFase] = useState<Fase>(
    consentimientoConversacion ? "inicial" : "consentimiento",
  );
  const [estado, setEstado] = useState<EstadoVoz>("inactiva");
  const [subtitulos, setSubtitulos] = useState<LineaSubtitulo[]>([]);
  const [parcialPaciente, setParcialPaciente] = useState("");
  const [parcialAsistente, setParcialAsistente] = useState("");
  const [mostrarSubtitulos, setMostrarSubtitulos] = useState(true);
  const [dominios, setDominios] = useState<DominioCheckin[]>([]);
  const [riesgo, setRiesgo] = useState<NivelRiesgo | null>(null);
  const [avisoFin, setAvisoFin] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasosError, setPasosError] = useState<string[]>([]);
  const [reintentable, setReintentable] = useState(true);
  const [cierre, setCierre] = useState<RespuestaFinalizar | null>(null);

  // Recursos vivos (no provocan re-render): sesión, medios, grabadora, timers.
  const sesionRef = useRef<VoiceSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const checkinRef = useRef<{
    checkinId: string;
    pacienteId: string;
    fecha: string;
  } | null>(null);
  const maxMinutosRef = useRef(8);
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const corteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Transcript COMPLETO de la sesión (los subtítulos solo guardan las últimas
  // líneas): se persiste al cerrar para que la conversación de voz tenga
  // historial y el profesional pueda leerla (WP-25; antes se perdía).
  const transcripcionRef = useRef<{ rol: "paciente" | "asistente"; texto: string }[]>([]);
  const parcialPacienteRef = useRef("");
  const parcialAsistenteRef = useRef("");
  const cerrandoRef = useRef(false);

  // Libera micrófono/sesión/grabadora al desmontar (sin finalizar el check-in).
  useEffect(() => {
    return () => {
      if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
      if (corteTimerRef.current) clearTimeout(corteTimerRef.current);
      try {
        grabadoraRef.current?.stop();
      } catch {
        /* noop */
      }
      void sesionRef.current?.colgar();
      const stream = streamRef.current;
      if (stream) for (const t of stream.getTracks()) t.stop();
    };
  }, []);

  function limpiarTimers() {
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    if (corteTimerRef.current) clearTimeout(corteTimerRef.current);
    avisoTimerRef.current = null;
    corteTimerRef.current = null;
  }

  function detenerStream() {
    const stream = streamRef.current;
    if (stream) for (const t of stream.getTracks()) t.stop();
    streamRef.current = null;
  }

  /** Detiene la grabadora y resuelve con el blob acumulado (o null). */
  function detenerGrabadora(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = grabadoraRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: "audio/webm" })
            : null;
        resolve(blob);
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }

  async function subirAudio(
    blob: Blob,
    pacienteId: string,
    fecha: string,
    checkinId: string,
  ): Promise<string | null> {
    // Best-effort: si la subida falla, no bloquea el cierre (el audio es secundario).
    try {
      const supabase = crearClienteNavegador();
      // Las consultas (WP-24) llevan el id en la ruta: puede haber varias al
      // día y no deben pisar el audio del check-in ni el de otra consulta.
      const ruta = esConsulta
        ? `${pacienteId}/${fecha}-${checkinId}.webm`
        : `${pacienteId}/${fecha}.webm`;
      const { error: errSubida } = await supabase.storage
        .from("audios-checkin")
        .upload(ruta, blob, { upsert: true, contentType: "audio/webm" });
      return errSubida ? null : ruta;
    } catch {
      return null;
    }
  }

  function empujarTranscripcion(rol: "paciente" | "asistente", texto: string) {
    // Acumula el transcript completo (para persistirlo al cerrar) y muestra solo
    // las últimas líneas como subtítulos.
    const ult = transcripcionRef.current[transcripcionRef.current.length - 1];
    if (ult && ult.rol === rol) {
      ult.texto = `${ult.texto} ${texto}`.trim(); // une fragmentos del mismo turno
    } else {
      transcripcionRef.current.push({ rol, texto });
    }
    setSubtitulos((prev) => {
      const siguiente = [...prev, { rol, texto }];
      return siguiente.slice(-8); // mantén las últimas líneas visibles
    });
  }

  async function iniciar() {
    if (!consentimientoConversacion) {
      setFase("consentimiento");
      return;
    }
    setError(null);
    setPasosError([]);
    setReintentable(true);
    setAvisoFin(false);
    setSubtitulos([]);
    transcripcionRef.current = [];

    // 0. Comprobación PREVIA del micrófono (sin disparar el prompt): navegador
    //    incompatible, contexto no seguro o permiso ya bloqueado → instrucciones
    //    claras ANTES de gastar una sesión (feedback móvil 2026-07-18).
    const previo = await comprobarSoporteMicrofono({
      mediaDevices: navigator.mediaDevices,
      permissions: navigator.permissions as never,
      esContextoSeguro: window.isSecureContext,
    });
    if (previo) {
      setError(previo.titulo);
      setPasosError(previo.pasos);
      setReintentable(previo.reintentable);
      setFase("fallo");
      return;
    }

    setFase("conectando");
    setEstado("conectando");

    // 1. Token efímero + sesión (server-side); el tipo decide check-in o consulta.
    let datos: RespuestaSesion;
    try {
      const res = await fetch("/api/voz/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          redirigirALogin();
          return;
        }
        if (res.status === 403) {
          setError(
            "Necesitas aceptar el registro de conversaciones para usar el modo voz.",
          );
          setFase("consentimiento");
          return;
        }
        setError(
          res.status === 503
            ? "El modo voz no está disponible ahora mismo. Puedes usar el chat de texto."
            : "No se pudo iniciar la sesión de voz. Inténtalo de nuevo.",
        );
        setFase("fallo");
        return;
      }
      datos = (await res.json()) as RespuestaSesion;
    } catch {
      setError("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
      setFase("fallo");
      return;
    }

    checkinRef.current = {
      checkinId: datos.checkinId,
      pacienteId: datos.pacienteId,
      fecha: datos.fecha,
    };
    maxMinutosRef.current = datos.maxMinutos;

    // 2. Micrófono (fallback claro si getUserMedia falla). Con cancelación de
    //    eco/ruido: en móvil con ALTAVOZ, la voz de Botsy se colaba por el micro
    //    y el detector de turnos la tomaba como que el paciente hablaba →
    //    interrumpía a Botsy (barge-in) y la conversación "se quedaba" a medias.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      const d = explicarErrorMicrofono(e);
      setError(d.titulo);
      setPasosError(d.pasos);
      setReintentable(d.reintentable);
      setFase("fallo");
      return;
    }
    streamRef.current = stream;

    // 3. Grabación local SOLO con consentimiento voz_grabacion (regla CLAUDE.md):
    //    sin ese consentimiento NO se instancia MediaRecorder.
    if (datos.consentimientos.voz_grabacion) {
      const mime = elegirMimeGrabacion();
      if (mime) {
        try {
          chunksRef.current = [];
          const rec = new MediaRecorder(stream, { mimeType: mime });
          rec.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          rec.start(1000);
          grabadoraRef.current = rec;
          setGrabando(true);
        } catch {
          grabadoraRef.current = null;
        }
      }
    }

    // 4. Sesión de voz (solo la interfaz VoiceSession; la UI no conoce el transporte).
    const sesion = crearSesionVoz({
      token: datos.token,
      modelo: datos.modelo,
      micStream: stream,
      manejadores: {
        onEstado: (e) => setEstado(e),
        onTranscripcion: (t) => {
          if (t.rol === "paciente") {
            if (t.final) {
              const texto = t.texto || parcialPacienteRef.current;
              parcialPacienteRef.current = "";
              setParcialPaciente("");
              if (texto.trim()) empujarTranscripcion("paciente", texto.trim());
            } else {
              parcialPacienteRef.current += t.texto;
              setParcialPaciente(parcialPacienteRef.current);
            }
          } else {
            if (t.final) {
              const texto = t.texto || parcialAsistenteRef.current;
              parcialAsistenteRef.current = "";
              setParcialAsistente("");
              if (texto.trim()) empujarTranscripcion("asistente", texto.trim());
            } else {
              parcialAsistenteRef.current += t.texto;
              setParcialAsistente(parcialAsistenteRef.current);
            }
          }
        },
        onToolCall: async (tc) => {
          const checkinId = checkinRef.current?.checkinId;
          if (!checkinId) return { callId: tc.callId, output: "ERROR: sin sesión." };
          try {
            const res = await fetch("/api/voz/tool", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                checkinId,
                callId: tc.callId,
                nombre: tc.nombre,
                argumentosJson: tc.argumentosJson,
              }),
            });
            if (!res.ok) {
              return { callId: tc.callId, output: "ERROR: no se pudo registrar." };
            }
            const data = (await res.json()) as RespuestaTool;
            setDominios(data.dominiosCubiertos);
            setRiesgo(data.riesgo);
            return { callId: tc.callId, output: data.output };
          } catch {
            return { callId: tc.callId, output: "ERROR: sin conexión." };
          }
        },
        onError: (e) => setError(e.mensaje),
      },
    });
    sesionRef.current = sesion;

    try {
      await sesion.conectar();
    } catch {
      setError(
        "No se pudo conectar la voz en este dispositivo. Puedes usar el chat de texto.",
      );
      await liberar();
      setFase("fallo");
      return;
    }

    setFase("llamada");
    programarTimers();
  }

  function programarTimers() {
    const max = maxMinutosRef.current;
    const msAviso = Math.max(0, (max - 1) * 60_000);
    const msCorte = max * 60_000;
    avisoTimerRef.current = setTimeout(() => {
      setAvisoFin(true);
      sesionRef.current?.solicitarDespedida?.();
    }, msAviso);
    corteTimerRef.current = setTimeout(() => {
      void terminar();
    }, msCorte);
  }

  async function liberar() {
    limpiarTimers();
    try {
      grabadoraRef.current?.stop();
    } catch {
      /* noop */
    }
    try {
      await sesionRef.current?.colgar();
    } catch {
      /* noop */
    }
    detenerStream();
  }

  async function terminar() {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    limpiarTimers();
    setFase("cerrando");

    try {
      await sesionRef.current?.colgar();
    } catch {
      /* noop */
    }

    // Audio (best-effort): detener grabadora, subir; su fallo no bloquea el cierre.
    let audioPath: string | undefined;
    try {
      const blob = await detenerGrabadora();
      const info = checkinRef.current;
      if (blob && info) {
        const ruta = await subirAudio(
          blob,
          info.pacienteId,
          info.fecha,
          info.checkinId,
        );
        if (ruta) audioPath = ruta;
      }
    } catch {
      /* el audio es secundario */
    }
    detenerStream();

    const checkinId = checkinRef.current?.checkinId;
    if (!checkinId) {
      setError("No se pudo cerrar el check-in.");
      setFase("fallo");
      cerrandoRef.current = false;
      return;
    }

    try {
      const res = await fetch("/api/voz/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkinId,
          ...(audioPath ? { audioPath } : {}),
          // Transcript completo de la conversación de voz → se guarda en `mensajes`.
          transcripcion: transcripcionRef.current,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          redirigirALogin();
          return;
        }
        setError(
          "Tu conversación se guardó, pero no pude generar el resumen. Puedes verlo desde el inicio.",
        );
        setFase("fallo");
        cerrandoRef.current = false;
        return;
      }
      const data = (await res.json()) as RespuestaFinalizar;
      setCierre(data);
      setFase("cierre");
    } catch {
      setError("No se pudo conectar para cerrar el check-in.");
      setFase("fallo");
    } finally {
      cerrandoRef.current = false;
    }
  }

  async function cambiarATexto() {
    // Cuelga la voz sin cerrar la sesión y sigue por texto (misma modalidad:
    // check-in o consulta).
    await liberar();
    router.push(hrefTexto);
  }

  // --- Render ---------------------------------------------------------------

  if (fase === "consentimiento") {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6">
        <p className="text-lg font-semibold text-texto">
          Antes de hablar, necesito tu permiso
        </p>
        <p className="text-base text-texto-suave">
          Para conversar por voz necesito que aceptes el registro de
          conversaciones. La grabación del audio es un permiso aparte y opcional:
          si no lo das, hablamos igual pero sin grabar.
        </p>
        <Link
          href="/consentimientos"
          className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-base font-semibold text-white transition-colors hover:bg-primario-fuerte"
        >
          Ir a mis permisos
        </Link>
        <Link
          href={hrefTexto}
          className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
        >
          Prefiero escribir
        </Link>
      </div>
    );
  }

  if (fase === "inicial") {
    return (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primario-suave text-primario">
            <Mic className="h-10 w-10" aria-hidden />
          </span>
          <p className="text-lg font-semibold text-texto">
            {esConsulta
              ? "Cuando quieras, te escucho"
              : "Cuando quieras, empezamos a hablar"}
          </p>
          <p className="text-base text-texto-suave">
            {esConsulta
              ? "Cuéntame lo que necesites, a cualquier hora. Puedes ver los subtítulos en pantalla y colgar en cualquier momento."
              : "Te iré preguntando cómo te encuentras. Puedes ver los subtítulos en pantalla y colgar en cualquier momento."}
          </p>
          <p className="text-sm text-texto-tenue">
            {consentimientoGrabacion
              ? "Grabaré el audio de esta conversación (diste tu permiso). Podrás retirarlo cuando quieras."
              : "No grabaré el audio (no has dado ese permiso). Hablamos igual."}
          </p>
        </section>

        <button
          type="button"
          onClick={() => void iniciar()}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-[var(--radius-lg)] bg-primario px-6 text-xl font-bold text-white transition-colors hover:bg-primario-fuerte"
        >
          <Mic className="h-6 w-6" aria-hidden />
          {esConsulta ? "Iniciar una conversación" : "Empezar a hablar"}
        </button>

        <button
          type="button"
          onClick={() => void cambiarATexto()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
        >
          <Keyboard className="h-5 w-5" aria-hidden />
          Prefiero escribir
        </button>

        <p className="text-sm text-texto-tenue">
          Botsy no diagnostica ni sustituye a tu médico.
        </p>
      </div>
    );
  }

  if (fase === "conectando" || fase === "cerrando") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-texto-suave">
        <Loader2 className="h-8 w-8 animate-spin text-primario" aria-hidden />
        <p className="text-base">
          {fase === "conectando" ? "Conectando…" : "Cerrando tu check-in…"}
        </p>
      </div>
    );
  }

  if (fase === "fallo") {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6">
        <p className="text-lg font-semibold text-texto">
          No pudimos seguir por voz
        </p>
        <p role="alert" className="text-base text-texto-suave">
          {error ?? "Algo no ha ido bien. Puedes usar el chat de texto."}
        </p>
        {pasosError.length > 0 && (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-base text-texto-suave">
            {pasosError.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        )}
        {reintentable && (
          <button
            type="button"
            onClick={iniciar}
            className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-base font-semibold text-white transition-colors hover:bg-primario-fuerte"
          >
            <Mic className="h-5 w-5" aria-hidden />
            Reintentar
          </button>
        )}
        <Link
          href={hrefTexto}
          className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-base font-semibold text-white transition-colors hover:bg-primario-fuerte"
        >
          <Keyboard className="h-5 w-5" aria-hidden />
          Continuar por texto
        </Link>
        <Link
          href="/inicio"
          className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] border border-borde bg-superficie px-6 text-base font-semibold text-texto-suave transition-colors hover:bg-superficie-suave"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (fase === "cierre" && cierre) {
    if (cierre.riesgo === "urgencia") {
      return (
        <PantallaUrgencia
          checkinId={checkinRef.current?.checkinId ?? ""}
          telefonoMedico={cierre.telefono_medico}
          resumen={cierre.resumen}
        />
      );
    }
    return (
      <PantallaCierreVoz
        cierre={cierre}
        vertical={vertical}
        checkinId={checkinRef.current?.checkinId ?? ""}
        esConsulta={esConsulta}
      />
    );
  }

  // fase === "llamada"
  const setDominiosCubiertos = new Set(dominios);
  const hablando = estado === "hablando";
  const escuchando = estado === "escuchando";

  return (
    <div className="flex flex-col gap-5">
      {/* Checklist visual de dominios (solo check-in estructurado; la consulta
          no recorre dominios, WP-24) */}
      {!esConsulta && (
        <section aria-label="Temas del check-in de hoy" className="flex flex-wrap gap-2">
          {DOMINIOS_CHECKIN.map((d) => {
            const cubierto = setDominiosCubiertos.has(d.id);
            return (
              <span
                key={d.id}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                  cubierto
                    ? "bg-acento-suave text-acento-fuerte"
                    : "bg-superficie-suave text-texto-tenue"
                }`}
              >
                {cubierto ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null}
                {d.etiqueta}
              </span>
            );
          })}
        </section>
      )}

      {(riesgo === "contactar" || riesgo === "urgencia") && (
        <div
          role="status"
          className="rounded-[var(--radius-lg)] border-2 p-4 text-base text-texto-suave"
          style={{
            borderColor:
              riesgo === "urgencia"
                ? "var(--color-urgencia)"
                : "var(--color-vigilancia)",
          }}
        >
          He detectado una señal que conviene comentar con tu médico. Es una
          señal, no un diagnóstico. Lo verás con más detalle al terminar.
        </div>
      )}

      {avisoFin && (
        <p role="status" className="text-base font-medium text-texto">
          Nos queda un minuto. Iré cerrando con calma.
        </p>
      )}

      {/* Indicador de estado (onda/pulso) */}
      <section
        aria-label="Estado de la llamada"
        className="flex flex-col items-center gap-4 py-6"
      >
        <span
          aria-hidden
          className={`flex h-28 w-28 items-center justify-center rounded-full transition-colors ${
            hablando
              ? "bg-primario text-white"
              : escuchando
                ? "bg-acento-suave text-acento-fuerte"
                : "bg-superficie-suave text-texto-tenue"
          } ${hablando || escuchando ? "animate-pulse motion-reduce:animate-none" : ""}`}
        >
          {hablando ? (
            <Volume2 className="h-12 w-12" aria-hidden />
          ) : (
            <Ear className="h-12 w-12" aria-hidden />
          )}
        </span>
        <p className="text-base font-medium text-texto" aria-live="polite">
          {hablando
            ? "Botsy está hablando…"
            : escuchando
              ? "Te escucho…"
              : "Un momento…"}
        </p>
        {grabando && (
          <p className="text-sm text-texto-tenue">
            {esConsulta ? "Grabando esta conversación" : "Grabando este check-in"}
          </p>
        )}
      </section>

      {/* Subtítulos en vivo (RF-CV-09, activados por defecto) */}
      <section aria-label="Subtítulos" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-texto-suave">Subtítulos</span>
          <button
            type="button"
            role="switch"
            aria-checked={mostrarSubtitulos}
            onClick={() => setMostrarSubtitulos((v) => !v)}
            className="text-sm font-semibold text-primario underline"
          >
            {mostrarSubtitulos ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {mostrarSubtitulos && (
          <div
            role="log"
            aria-live="polite"
            className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-[var(--radius-lg)] border border-borde bg-fondo p-4"
          >
            {subtitulos.length === 0 && !parcialPaciente && !parcialAsistente ? (
              <p className="text-base text-texto-tenue">
                Aquí aparecerá lo que hablemos.
              </p>
            ) : (
              <>
                {subtitulos.map((l, i) => (
                  <p key={i} className="text-base leading-relaxed text-texto">
                    <span className="font-semibold">
                      {l.rol === "asistente" ? "Botsy: " : "Tú: "}
                    </span>
                    {l.texto}
                  </p>
                ))}
                {parcialAsistente && (
                  <p className="text-base leading-relaxed text-texto-suave">
                    <span className="font-semibold">Botsy: </span>
                    {parcialAsistente}
                  </p>
                )}
                {parcialPaciente && (
                  <p className="text-base leading-relaxed text-texto-suave">
                    <span className="font-semibold">Tú: </span>
                    {parcialPaciente}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-base font-medium text-texto-suave">
          {error}
        </p>
      )}

      {/* Controles */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={() => void terminar()}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-[var(--radius-lg)] bg-primario px-6 text-xl font-bold text-white transition-colors hover:bg-primario-fuerte"
        >
          <PhoneOff className="h-6 w-6" aria-hidden />
          Colgar y terminar
        </button>
        <button
          type="button"
          onClick={() => void cambiarATexto()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
        >
          <Keyboard className="h-5 w-5" aria-hidden />
          Prefiero escribir
        </button>
      </div>
    </div>
  );
}

function PantallaCierreVoz({
  cierre,
  vertical,
  checkinId,
  esConsulta,
}: {
  cierre: RespuestaFinalizar;
  vertical: VerticalPaciente;
  checkinId: string;
  esConsulta: boolean;
}) {
  const recomendacion = recomendacionDelDia(vertical);
  return (
    <div className="relative flex flex-col items-center gap-6 pt-6 text-center">
      {/* Confeti sobrio (solo el logro diario del check-in) */}
      {!esConsulta && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden"
        >
          {PIEZAS_CONFETI.concat(PIEZAS_CONFETI).map((color, i) => (
            <span
              key={i}
              className="confeti-pieza"
              style={{
                left: `${(i * 9 + 6) % 100}%`,
                background: color,
                animationDelay: `${(i % 5) * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-acento-suave text-acento-fuerte">
        <CheckCircle2 className="h-9 w-9" aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-texto">
          {esConsulta ? "Gracias por contármelo" : "¡Check-in completado!"}
        </h2>
        {/* La consulta no toca la racha (WP-24): no se muestra contador. */}
        {!esConsulta && (
          <p className="text-lg font-semibold text-primario">
            {cierre.racha_actual > 1
              ? `Llevas ${cierre.racha_actual} días seguidos`
              : "Primer día registrado"}
          </p>
        )}
      </div>

      <section
        aria-label={esConsulta ? "Resumen de la conversación" : "Resumen de hoy"}
        className="w-full rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-5 text-left"
      >
        <p className="text-base leading-relaxed text-texto">{cierre.resumen}</p>
      </section>

      {cierre.riesgo === "contactar" && (
        <TarjetaContactar
          checkinId={checkinId}
          telefonoMedico={cierre.telefono_medico}
        />
      )}

      <section
        aria-label="Recomendación del día"
        className="flex w-full flex-col gap-2 rounded-[var(--radius-lg)] border border-borde bg-primario-suave p-5 text-left"
      >
        <p className="flex items-center gap-2 text-base font-semibold text-primario">
          <Sparkles className="h-5 w-5" aria-hidden />
          Recomendación del día
        </p>
        <p className="text-base leading-relaxed text-texto">{recomendacion}</p>
      </section>

      <Link
        href="/inicio"
        className="flex h-14 w-full items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
      >
        Volver al inicio
      </Link>
      <p className="text-sm text-texto-tenue">
        Botsy no diagnostica ni sustituye a tu médico.
      </p>
    </div>
  );
}
