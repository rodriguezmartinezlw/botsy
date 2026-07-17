"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  MENSAJE_NEUTRO_RECUPERACION,
  urlRedireccionRestablecer,
} from "@/lib/auth/recuperacion";

/**
 * Pide el enlace de restablecimiento (WP-20 §B). Tras enviar, muestra SIEMPRE el
 * mismo mensaje neutro exista o no el correo (evita enumeración de usuarios). El
 * enlace lleva a `(auth)/restablecer` mediante `redirectTo`.
 */
export default function FormularioRecuperar() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const supabase = crearClienteNavegador();
      const redirectTo = urlRedireccionRestablecer(window.location.origin);
      // No distinguimos entre éxito y "no existe": Supabase responde igual, y si
      // devolviera un error (p. ej. límite de envíos) tampoco lo revelamos.
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      setEnviado(true);
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo en unos minutos.");
    } finally {
      setCargando(false);
    }
  }

  if (enviado) {
    return (
      <p
        role="status"
        className="rounded-[var(--radius-md)] bg-primario-suave px-4 py-4 text-base font-medium text-texto"
      >
        {MENSAJE_NEUTRO_RECUPERACION}
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={alEnviar}>
      <label className="flex flex-col gap-1.5">
        <span className="text-base font-medium text-texto">
          Correo electrónico
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-tenue"
        />
      </label>

      {error ? (
        <p role="alert" className="text-base font-medium text-urgencia">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={cargando || email.trim().length === 0}
        className="mt-2 flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white disabled:opacity-60"
      >
        {cargando ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
