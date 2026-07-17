import type { Metadata } from "next";
import Link from "next/link";
import FormularioRecuperar from "./FormularioRecuperar";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
};

/**
 * Recuperación de contraseña (WP-20 §B): el paciente introduce su correo y, si
 * está registrado, recibe un enlace del mailer integrado de Supabase (sin
 * Resend). El mensaje es NEUTRO: no revela si el correo existe.
 */
export default function RecuperarPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-texto">¿Olvidaste tu contraseña?</h1>
        <p className="text-base text-texto-suave">
          No pasa nada. Escribe tu correo y te enviaremos un enlace para crear una
          nueva.
        </p>
      </div>

      <FormularioRecuperar />

      <p className="text-center text-base text-texto-suave">
        <Link href="/login" className="font-semibold text-primario">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
