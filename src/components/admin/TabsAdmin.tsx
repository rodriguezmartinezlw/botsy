"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, UserX } from "lucide-react";

const tabs = [
  { href: "/admin/instituciones", label: "Instituciones", Icono: Building2 },
  { href: "/admin/profesionales", label: "Profesionales", Icono: Users },
  { href: "/admin/pacientes", label: "Pacientes sin institución", Icono: UserX },
] as const;

/**
 * Pestañas de la consola de administración (WP-23). Cliente: resalta la sección
 * activa según la ruta. La visibilidad de la sección la controla el layout (guard
 * solo-admin); estas pestañas sólo navegan dentro de ella.
 */
export default function TabsAdmin() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones de administración"
      className="flex flex-wrap gap-1 border-b border-borde pb-2"
    >
      {tabs.map(({ href, label, Icono }) => {
        const activo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-base font-medium transition-colors ${
              activo
                ? "bg-primario-suave text-primario"
                : "text-texto-suave hover:bg-superficie-suave hover:text-texto"
            }`}
          >
            <Icono className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
