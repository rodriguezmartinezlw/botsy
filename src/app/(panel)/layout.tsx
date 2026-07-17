import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import NavLateral from "@/components/panel/NavLateral";
import { obtenerRolSesion } from "@/lib/auth/sesion";
import {
  contarAlertasNuevas,
  contarDesenlacesPendientes,
} from "@/lib/panel/datos";

/**
 * Layout del panel profesional.
 * Escritorio: sidebar a la izquierda + contenido. Móvil: barra superior + contenido.
 *
 * Route guard (WP-01): requiere sesión de profesional o admin leída en
 * servidor. Sin sesión -> /login; pacientes -> su app (/inicio).
 */
export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const rol = await obtenerRolSesion();
  if (!rol) redirect("/login");
  if (rol !== "profesional" && rol !== "admin") redirect("/inicio");

  const [alertasNuevas, desenlacesPendientes] = await Promise.all([
    contarAlertasNuevas(),
    contarDesenlacesPendientes(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-fondo md:flex-row">
      <NavLateral
        alertasNuevas={alertasNuevas}
        desenlacesPendientes={desenlacesPendientes}
      />
      <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
