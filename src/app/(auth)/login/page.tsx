import type { Metadata } from "next";
import Link from "next/link";
import { destinoSeguro } from "@/lib/auth/roles";
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
  searchParams: Promise<{ rol?: string; next?: string }>;
}) {
  const { rol, next } = await searchParams;
  const esProfesional = rol === "profesional";
  const esPatrocinador = rol === "patrocinador";
  // Destino tras autenticar (sesión expirada): solo rutas relativas seguras
  // (evita open-redirect). Si no es válido, se usa la ruta por rol.
  const destino = destinoSeguro(next);

  const titulo = esPatrocinador
    ? "Acceso para patrocinadores"
    : esProfesional
      ? "Acceso profesional"
      : "Bienvenido de nuevo";
  const subtitulo = esPatrocinador
    ? "Entra para ver los agregados de las cohortes que financias."
    : esProfesional
      ? "Entra en tu panel para revisar a tus pacientes y alertas."
      : "Entra para hacer tu check-in de hoy.";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-texto">{titulo}</h1>
        <p className="text-base text-texto-suave">{subtitulo}</p>
      </div>

      <FormularioLogin destino={destino} />

      <p className="text-center text-base text-texto-suave">
        <Link href="/recuperar" className="font-semibold text-primario">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>

      {!esProfesional && !esPatrocinador ? (
        <p className="text-center text-base text-texto-suave">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-primario">
            Crea una
          </Link>
        </p>
      ) : null}
    </div>
  );
}
