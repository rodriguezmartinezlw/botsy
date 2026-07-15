import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

/**
 * Login estático (WP-00). Sin lógica de autenticación: se conecta en WP-01.
 * Lee ?rol=profesional para adaptar el encabezado.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const { rol } = await searchParams;
  const esProfesional = rol === "profesional";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-texto">
          {esProfesional ? "Acceso profesional" : "Bienvenido de nuevo"}
        </h1>
        <p className="text-base text-texto-suave">
          {esProfesional
            ? "Entra en tu panel para revisar a tus pacientes y alertas."
            : "Entra para hacer tu check-in de hoy."}
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-texto">
            Correo electrónico
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
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
            placeholder="••••••••"
            className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-tenue"
          />
        </label>

        <button
          type="button"
          disabled
          className="mt-2 flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white disabled:opacity-60"
        >
          Entrar
        </button>
      </form>

      <p className="text-center text-base text-texto-suave">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primario">
          Crea una
        </Link>
      </p>
    </div>
  );
}
