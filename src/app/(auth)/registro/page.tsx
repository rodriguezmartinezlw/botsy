import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

/**
 * Registro estático (WP-00). Sin lógica: se conecta en WP-01.
 */
export default function RegistroPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-texto">Crea tu cuenta</h1>
        <p className="text-base text-texto-suave">
          Empieza a cuidar tu salud con un check-in diario.
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-texto">Nombre</span>
          <input
            type="text"
            name="nombre"
            autoComplete="name"
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
            placeholder="Crea una contraseña"
            className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-tenue"
          />
        </label>

        <button
          type="button"
          disabled
          className="mt-2 flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white disabled:opacity-60"
        >
          Crear cuenta
        </button>
      </form>

      <p className="text-center text-base text-texto-suave">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-primario">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
