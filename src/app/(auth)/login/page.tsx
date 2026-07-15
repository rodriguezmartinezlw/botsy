import type { Metadata } from "next";
import Link from "next/link";
import FormularioLogin from "./FormularioLogin";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

/**
 * Login (WP-01): encabezado en servidor (adapta según ?rol=profesional) +
 * formulario cliente conectado a Supabase Auth.
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

      <FormularioLogin />

      <p className="text-center text-base text-texto-suave">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primario">
          Crea una
        </Link>
      </p>
    </div>
  );
}
