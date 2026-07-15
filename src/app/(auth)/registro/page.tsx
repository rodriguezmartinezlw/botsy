import type { Metadata } from "next";
import Link from "next/link";
import FormularioRegistro from "./FormularioRegistro";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

/**
 * Registro (WP-01): formulario cliente conectado a Supabase Auth (crea cuenta
 * de paciente).
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

      <FormularioRegistro />

      <p className="text-center text-base text-texto-suave">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-primario">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
