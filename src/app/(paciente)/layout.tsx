import type { ReactNode } from "react";
import NavInferior from "@/components/paciente/NavInferior";

/**
 * Layout de la app del paciente (PWA móvil-first).
 * Contenedor centrado max-w-md, barra de navegación inferior fija.
 * Tipografía base >=16px heredada de globals.css (perfil geriátrico).
 */
export default function PacienteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-superficie shadow-sm">
      <main className="flex-1 px-5 pb-28 pt-8">{children}</main>
      <NavInferior />
    </div>
  );
}
