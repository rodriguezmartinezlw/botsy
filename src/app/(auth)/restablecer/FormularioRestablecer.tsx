"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { rutaPorRol } from "@/lib/auth/roles";
import { validarPasswordNueva, MIN_LONGITUD_PASSWORD } from "@/lib/auth/recuperacion";

type EstadoEnlace = "comprobando" | "listo" | "invalido";

/**
 * Establece la contraseña nueva con la sesión del enlace. Soporta ambos formatos
 * de Supabase: token en el hash (`#access_token`, procesado al crear el cliente)
 * y código PKCE en la query (`?code=`, que se intercambia por sesión). Tras
 * guardar, redirige según el rol del perfil.
 */
export default function FormularioRestablecer() {
  const router = useRouter();
  // El cliente se crea SOLO en el navegador (dentro del efecto): crearlo en el
  // inicializador de useState rompía el prerender estático cuando las variables
  // de entorno no existen en build (fallo real del deploy a Vercel, 2026-07-17).
  const [supabase, setSupabase] = useState<ReturnType<
    typeof crearClienteNavegador
  > | null>(null);

  const [estadoEnlace, setEstadoEnlace] = useState<EstadoEnlace>("comprobando");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    let cliente: ReturnType<typeof crearClienteNavegador>;
    try {
      cliente = crearClienteNavegador();
    } catch {
      // Backend sin configurar: fallo controlado, sin romper el render.
      setEstadoEnlace("invalido");
      return;
    }
    setSupabase(cliente);
    const supabase = cliente;

    const sub = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!cancelado && session) setEstadoEnlace("listo");
    });

    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error_description") || params.get("error")) {
        if (!cancelado) setEstadoEnlace("invalido");
        return;
      }
      // Formato token_hash (invitación de alta / recuperación con plantilla por
      // defecto de Supabase): se verifica el OTP para crear la sesión del enlace.
      const tokenHash = params.get("token_hash");
      const tipo = params.get("type");
      if (tokenHash && tipo) {
        const { error: errOtp } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tipo as EmailOtpType,
        });
        if (!cancelado) setEstadoEnlace(errOtp ? "invalido" : "listo");
        return;
      }
      // Formato PKCE (código en la query, mismo navegador que pidió el enlace).
      const code = params.get("code");
      if (code) {
        const { error: errCanje } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelado) setEstadoEnlace(errCanje ? "invalido" : "listo");
        return;
      }
      // Enlace por hash: el cliente ya procesó el token al crearse.
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;
      if (data.session) {
        setEstadoEnlace("listo");
      } else if (!window.location.hash.includes("access_token")) {
        // Ni sesión ni token en la URL: el enlace no es válido o ha caducado.
        setEstadoEnlace("invalido");
      }
      // Si hay hash con access_token pero aún no hay sesión, esperamos al evento.
    })();

    return () => {
      cancelado = true;
      sub.data.subscription.unsubscribe();
    };
    // Se ejecuta una sola vez al montar (el cliente se crea dentro).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    if (!supabase) {
      setError("No se pudo conectar. Recarga la página e inténtalo de nuevo.");
      return;
    }
    const validacion = validarPasswordNueva(password, confirmacion);
    if (!validacion.ok) {
      setError(validacion.error);
      return;
    }
    setGuardando(true);
    try {
      const { error: errUpdate } = await supabase.auth.updateUser({ password });
      if (errUpdate) {
        setError(
          "No se pudo guardar la contraseña. Es posible que el enlace haya caducado; pide uno nuevo.",
        );
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let rol: string | null = null;
      if (user) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .maybeSingle();
        rol = perfil?.rol ?? null;
      }
      router.replace(rutaPorRol(rol));
      router.refresh();
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (estadoEnlace === "comprobando") {
    return (
      <p role="status" className="text-base text-texto-suave">
        Comprobando tu enlace…
      </p>
    );
  }

  if (estadoEnlace === "invalido") {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-md)] bg-superficie-suave px-4 py-4">
        <p role="alert" className="text-base font-medium text-texto">
          Este enlace no es válido o ha caducado.
        </p>
        <Link
          href="/recuperar"
          className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-base font-semibold text-white transition-colors hover:bg-primario-fuerte"
        >
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={alEnviar}>
      <label className="flex flex-col gap-1.5">
        <span className="text-base font-medium text-texto">Contraseña nueva</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MIN_LONGITUD_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Al menos 8 caracteres"
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-tenue"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-base font-medium text-texto">
          Repite la contraseña
        </span>
        <input
          type="password"
          name="confirmacion"
          autoComplete="new-password"
          required
          minLength={MIN_LONGITUD_PASSWORD}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          placeholder="Vuelve a escribirla"
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
        disabled={guardando}
        className="mt-2 flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
