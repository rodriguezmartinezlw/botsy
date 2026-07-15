import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import NavInferior from "@/components/paciente/NavInferior";
import { obtenerRolSesion } from "@/lib/auth/sesion";

/**
 * Layout de la app del paciente (PWA móvil-first).
 * Contenedor centrado max-w-md, barra de navegación inferior fija.
 * Tipografía base >=16px heredada de globals.css (perfil geriátrico).
 *
 * Route guard (WP-01): requiere sesión de paciente leída en servidor.
 * Sin sesión -> /login; profesionales/admin -> su panel (/pacientes).
 */
export default async function PacienteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const rol = await obtenerRolSesion();
  if (!rol) redirect("/login");
  if (rol !== "paciente") redirect("/pacientes");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-superficie shadow-sm">
      <main className="flex-1 px-5 pb-28 pt-8">{children}</main>
      <NavInferior />
    </div>
  );
}
