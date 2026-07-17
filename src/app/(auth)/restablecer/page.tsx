import type { Metadata } from "next";
import Link from "next/link";
import FormularioRestablecer from "./FormularioRestablecer";

export const metadata: Metadata = {
  title: "Nueva contraseña",
};

/**
 * Establece la contraseña nueva (WP-20 §B) desde la sesión del enlace del correo
 * (recuperación) o de la invitación de alta (WP-20 §A: ambos flujos llegan aquí
 * con una sesión temporal creada por Supabase). El formulario cliente comprueba
 * la sesión del enlace y llama a `auth.updateUser`.
 */
export default function RestablecerPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-texto">Crea tu contraseña</h1>
        <p className="text-base text-texto-suave">
          Elige una contraseña nueva para tu cuenta. La necesitarás para entrar a
          partir de ahora.
        </p>
      </div>

      <FormularioRestablecer />

      <p className="text-center text-base text-texto-suave">
        <Link href="/login" className="font-semibold text-primario">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
