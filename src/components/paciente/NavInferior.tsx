"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessagesSquare, User } from "lucide-react";

const items = [
  { href: "/inicio", label: "Inicio", Icono: Home },
  { href: "/checkin", label: "Check-in", Icono: MessagesSquare },
  { href: "/perfil", label: "Perfil", Icono: User },
] as const;

/**
 * Barra de navegación inferior de la app del paciente (móvil-first).
 * Cliente: resalta el ítem activo según la ruta. Sin más lógica.
 */
export default function NavInferior() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-borde bg-superficie"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-around">
        {items.map(({ href, label, Icono }) => {
          const activo = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-3 text-sm font-medium transition-colors ${
                  activo
                    ? "text-primario"
                    : "text-texto-tenue hover:text-texto"
                }`}
              >
                <Icono
                  className="h-6 w-6"
                  strokeWidth={activo ? 2.4 : 2}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
