"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { rutaPorRol } from "@/lib/auth/roles";

/**
 * Formulario de inicio de sesión conectado a Supabase Auth (email+contraseña).
 * Tras autenticar, redirige según el rol del perfil (paciente -> /inicio,
 * profesional/admin -> /pacientes).
 */
export default function FormularioLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const supabase = crearClienteNavegador();
      const { error: errorLogin } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (errorLogin) {
        setError("Correo o contraseña incorrectos.");
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
      setError(
        "No se pudo conectar con el servidor. Inténtalo de nuevo más tarde.",
      );
    } finally {
      setCargando(false);
    }
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

      <label className="flex flex-col gap-1.5">
        <span className="text-base font-medium text-texto">Contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
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
        disabled={cargando}
        className="mt-2 flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white disabled:opacity-60"
      >
        {cargando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
