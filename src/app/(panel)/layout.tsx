import type { ReactNode } from "react";
import NavLateral from "@/components/panel/NavLateral";

/**
 * Layout del panel profesional.
 * Escritorio: sidebar a la izquierda + contenido. Móvil: barra superior + contenido.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo md:flex-row">
      <NavLateral />
      <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
