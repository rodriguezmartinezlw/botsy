"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Formulario de registro conectado a Supabase Auth. Crea una cuenta de
 * PACIENTE (rol por defecto): el nombre y el rol viajan en user_metadata y el
 * trigger `on_auth_user_created` crea el perfil/paciente. Si el proyecto exige
 * confirmación por correo, se informa; si no, se entra directo a /inicio.
 */
export default function FormularioRegistro() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const supabase = crearClienteNavegador();
      const { data, error: errorRegistro } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre, rol: "paciente" } },
      });
      if (errorRegistro) {
        setError("No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.");
        return;
      }

      if (data.session) {
        router.replace("/inicio");
        router.refresh();
      } else {
        setAviso(
          "Te hemos enviado un correo para confirmar tu cuenta. Ábrelo para continuar.",
        );
      }
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
        <span className="text-base font-medium text-texto">Nombre</span>
        <input
          type="text"
          name="nombre"
          autoComplete="name"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-tenue"
        />
      </label>

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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Crea una contraseña"
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-tenue"
        />
      </label>

      {error ? (
        <p role="alert" className="text-base font-medium text-urgencia">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="text-base font-medium text-acento-fuerte">
          {aviso}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={cargando}
        className="mt-2 flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white disabled:opacity-60"
      >
        {cargando ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
