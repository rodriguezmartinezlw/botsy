"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Bell, Settings, HeartPulse } from "lucide-react";

const items = [
  { href: "/pacientes", label: "Pacientes", Icono: Users },
  { href: "/alertas", label: "Alertas", Icono: Bell },
  { href: "/configuracion", label: "Configuración", Icono: Settings },
] as const;

/**
 * Navegación del panel profesional.
 * Responsive: sidebar fija en escritorio (md+), barra superior en móvil.
 * Cliente: resalta el ítem activo según la ruta.
 */
export default function NavLateral() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación del panel"
      className="flex shrink-0 flex-col border-borde bg-superficie md:h-dvh md:w-64 md:border-r"
    >
      <div className="flex items-center gap-2 border-b border-borde px-5 py-4">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-primario text-white"
        >
          <HeartPulse className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span className="text-lg font-bold text-texto">Botsy</span>
        <span className="text-sm text-texto-tenue">· Panel</span>
      </div>

      <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:gap-1 md:overflow-visible md:p-3">
        {items.map(({ href, label, Icono }) => {
          const activo = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0 md:shrink">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-base font-medium transition-colors ${
                  activo
                    ? "bg-primario-suave text-primario"
                    : "text-texto-suave hover:bg-superficie-suave hover:text-texto"
                }`}
              >
                <Icono className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
