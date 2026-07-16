"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  PhoneCall,
  Send,
  Sparkles,
} from "lucide-react";
import type { NivelRiesgo, VerticalPaciente } from "@/types/db";
import { DOMINIOS_CHECKIN, type DominioCheckin } from "@/lib/ia/dominios";
import { recomendacionDelDia } from "./recomendaciones";
import PantallaUrgencia from "./PantallaUrgencia";
import TarjetaContactar from "./TarjetaContactar";

type RolMensajeUI = "asistente" | "paciente";
type MensajeUI = { rol: RolMensajeUI; contenido: string };

type RespuestaIniciar = {
  checkinId: string;
  estado: "en_curso" | "completado" | "abandonado";
  mensajes: { rol: RolMensajeUI; contenido: string }[];
  dominiosCubiertos: DominioCheckin[];
  riesgo: NivelRiesgo | null;
};

type RespuestaMensaje = {
  respuesta: string;
  dominiosCubiertos: DominioCheckin[];
  riesgo: NivelRiesgo | null;
  finalizarSugerido: boolean;
};

type RespuestaFinalizar = {
  resumen: string;
  riesgo: NivelRiesgo | null;
  telefono_medico: string | null;
  racha_actual: number;
  racha_maxima: number;
};

type Fase = "cargando" | "listo" | "cierre" | "no_disponible";

/**
 * Sesión expirada (401): manda al login CONSERVANDO el destino para volver
 * aquí tras reautenticarse (WP-08, robustez).
 */
function redirigirALogin(): void {
  if (typeof window === "undefined") return;
  const destino = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(destino)}`;
}

const PIEZAS_CONFETI = [
  "var(--color-primario)",
  "var(--color-acento)",
  "var(--color-primario-suave)",
  "var(--color-acento-fuerte)",
  "var(--color-vigilancia)",
];

export default function ChatCheckin({
  vertical,
}: {
  vertical: VerticalPaciente;
}) {
  const [fase, setFase] = useState<Fase>("cargando");
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [estado, setEstado] = useState<RespuestaIniciar["estado"]>("en_curso");
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [dominios, setDominios] = useState<DominioCheckin[]>([]);
  const [riesgo, setRiesgo] = useState<NivelRiesgo | null>(null);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cierre, setCierre] = useState<RespuestaFinalizar | null>(null);

  const finDeLista = useRef<HTMLDivElement>(null);

  // Iniciar (o retomar) el check-in de hoy al montar.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch("/api/checkin/iniciar", { method: "POST" });
        if (!res.ok) {
          if (res.status === 401) {
            redirigirALogin();
            return;
          }
          if (!cancelado) setFase("no_disponible");
          return;
        }
        const data = (await res.json()) as RespuestaIniciar;
        if (cancelado) return;
        setCheckinId(data.checkinId);
        setEstado(data.estado);
        setMensajes(data.mensajes);
        setDominios(data.dominiosCubiertos);
        setRiesgo(data.riesgo);
        setFase("listo");
      } catch {
        if (!cancelado) setFase("no_disponible");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Auto-scroll al último mensaje / indicador.
  useEffect(() => {
    finDeLista.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando, fase]);

  const enviarMensaje = useCallback(async () => {
    const texto = entrada.trim();
    if (texto.length === 0 || enviando || !checkinId) return;
    setError(null);
    setEntrada("");
    setEnviando(true);
    setMensajes((prev) => [...prev, { rol: "paciente", contenido: texto }]);
    try {
      const res = await fetch("/api/checkin/mensaje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinId, texto }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          redirigirALogin();
          return;
        }
        // El servidor no persistió nada: revertir la burbuja optimista.
        setMensajes((prev) => prev.slice(0, -1));
        setEntrada(texto);
        setError(
          res.status === 503
            ? "El asistente no está disponible ahora mismo. Inténtalo de nuevo en unos minutos."
            : "No se pudo enviar tu mensaje. Inténtalo de nuevo.",
        );
        return;
      }
      const data = (await res.json()) as RespuestaMensaje;
      setMensajes((prev) => [...prev, { rol: "asistente", contenido: data.respuesta }]);
      setDominios(data.dominiosCubiertos);
      setRiesgo(data.riesgo);
    } catch {
      setMensajes((prev) => prev.slice(0, -1));
      setEntrada(texto);
      setError("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }, [entrada, enviando, checkinId]);

  const finalizar = useCallback(async () => {
    if (!checkinId || finalizando) return;
    setError(null);
    setFinalizando(true);
    try {
      const res = await fetch("/api/checkin/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinId }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          redirigirALogin();
          return;
        }
        setError("No se pudo finalizar el check-in. Inténtalo de nuevo.");
        return;
      }
      const data = (await res.json()) as RespuestaFinalizar;
      setCierre(data);
      setFase("cierre");
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setFinalizando(false);
    }
  }, [checkinId, finalizando]);

  if (fase === "cargando") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-texto-suave">
        <Loader2 className="h-8 w-8 animate-spin text-primario" aria-hidden />
        <p className="text-base">Preparando tu check-in…</p>
      </div>
    );
  }

  if (fase === "no_disponible") {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6">
        <p className="text-lg font-semibold text-texto">
          Ahora mismo no puedo iniciar tu check-in.
        </p>
        <p className="text-base text-texto-suave">
          Inténtalo de nuevo en unos minutos. Botsy solo registra y pregunta; no
          diagnostica.
        </p>
        <Link
          href="/inicio"
          className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (fase === "cierre" && cierre) {
    // Urgencia: pantalla dedicada, calmada pero inequívoca (RF-ES-03).
    if (cierre.riesgo === "urgencia") {
      return (
        <PantallaUrgencia
          checkinId={checkinId ?? ""}
          telefonoMedico={cierre.telefono_medico}
          resumen={cierre.resumen}
        />
      );
    }
    return (
      <PantallaCierre
        cierre={cierre}
        vertical={vertical}
        checkinId={checkinId ?? ""}
      />
    );
  }

  const setDominiosCubiertos = new Set(dominios);
  const yaCompletado = estado === "completado";

  return (
    <div className="flex flex-col gap-5">
      {/* Checklist visual de dominios */}
      <section aria-label="Temas del check-in de hoy" className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
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
                {cubierto ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                ) : null}
                {d.etiqueta}
                {cubierto ? <span className="sr-only"> (cubierto)</span> : null}
              </span>
            );
          })}
        </div>
      </section>

      {(riesgo === "contactar" || riesgo === "urgencia") && (
        <BannerRiesgo nivel={riesgo} />
      )}

      {/* Conversación */}
      <div
        role="log"
        aria-label="Conversación con Botsy"
        aria-live="polite"
        className="flex flex-col gap-3"
      >
        {mensajes.map((m, i) => (
          <Burbuja key={i} rol={m.rol} contenido={m.contenido} />
        ))}
        {enviando && (
          <div
            className="flex w-fit items-center gap-2 rounded-[var(--radius-lg)] bg-superficie-suave px-4 py-3 text-texto-tenue"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="text-base">Botsy está escribiendo…</span>
          </div>
        )}
        <div ref={finDeLista} className="h-24" />
      </div>

      {error && (
        <p role="alert" className="text-base font-medium text-urgencia">
          {error}
        </p>
      )}

      {yaCompletado ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-5">
          <p className="text-base text-texto-suave">
            Ya has completado tu check-in de hoy. ¡Buen trabajo!
          </p>
          <Link
            href="/inicio"
            className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-base font-semibold text-white transition-colors hover:bg-primario-fuerte"
          >
            Volver al inicio
          </Link>
        </div>
      ) : (
        <>
          {/* Barra de entrada fija */}
          <div className="fixed inset-x-0 bottom-[68px] z-20 border-t border-borde bg-superficie">
            <div className="mx-auto w-full max-w-md px-5 py-3">
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviarMensaje();
                }}
              >
                <label htmlFor="mensaje-checkin" className="sr-only">
                  Escribe tu mensaje para Botsy
                </label>
                <textarea
                  id="mensaje-checkin"
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void enviarMensaje();
                    }
                  }}
                  rows={1}
                  placeholder="Escríbeme cómo te encuentras…"
                  disabled={enviando}
                  className="max-h-32 min-h-12 flex-1 resize-none rounded-[var(--radius-lg)] border border-borde bg-fondo px-4 py-3 text-base text-texto placeholder:text-texto-tenue focus:border-primario disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={enviando || entrada.trim().length === 0}
                  aria-label="Enviar mensaje"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-primario text-white transition-colors hover:bg-primario-fuerte disabled:opacity-50"
                >
                  <Send className="h-5 w-5" aria-hidden />
                </button>
              </form>
              <button
                type="button"
                onClick={() => void finalizar()}
                disabled={finalizando}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-4 text-base font-semibold text-primario transition-colors hover:bg-primario-suave disabled:opacity-60"
              >
                {finalizando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                )}
                Terminar mi check-in
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Burbuja({ rol, contenido }: { rol: RolMensajeUI; contenido: string }) {
  const esBotsy = rol === "asistente";
  return (
    <div
      className={`flex ${esBotsy ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-4 py-3 text-base leading-relaxed ${
          esBotsy
            ? "bg-superficie-suave text-texto"
            : "bg-primario text-white"
        }`}
      >
        <span className="sr-only">{esBotsy ? "Botsy: " : "Tú: "}</span>
        {contenido}
      </div>
    </div>
  );
}

function BannerRiesgo({ nivel }: { nivel: NivelRiesgo }) {
  const esUrgencia = nivel === "urgencia";
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-[var(--radius-lg)] border-2 p-4"
      style={{
        borderColor: esUrgencia
          ? "var(--color-urgencia)"
          : "var(--color-vigilancia)",
        background: "var(--color-superficie)",
      }}
    >
      <p className="flex items-center gap-2 text-base font-semibold text-texto">
        <PhoneCall className="h-5 w-5" aria-hidden />
        {esUrgencia
          ? "Esto conviene atenderlo pronto"
          : "Una señal para comentar con tu médico"}
      </p>
      <p className="text-base text-texto-suave">
        {esUrgencia
          ? "Por lo que me cuentas, es mejor que llames a tu médico o a los servicios de urgencias. Mantén la calma."
          : "He detectado una señal que conviene comentar. Te recomiendo contactar hoy con tu médico. Esto es una señal, no un diagnóstico."}
      </p>
    </div>
  );
}

function PantallaCierre({
  cierre,
  vertical,
  checkinId,
}: {
  cierre: RespuestaFinalizar;
  vertical: VerticalPaciente;
  checkinId: string;
}) {
  const recomendacion = recomendacionDelDia(vertical);
  return (
    <div className="relative flex flex-col items-center gap-6 pt-6 text-center">
      {/* Confeti sobrio */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden">
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

      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-acento-suave text-acento-fuerte">
        <CheckCircle2 className="h-9 w-9" aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-texto">¡Check-in completado!</h2>
        <p className="text-lg font-semibold text-primario">
          {cierre.racha_actual > 1
            ? `Llevas ${cierre.racha_actual} días seguidos`
            : "Primer día registrado"}
        </p>
      </div>

      <section
        aria-label="Resumen de hoy"
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
