import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { obtenerSesionAdmin } from "@/lib/admin/sesion-admin";
import TabsAdmin from "@/components/admin/TabsAdmin";

/**
 * Layout de la consola de administración (WP-23 §1).
 *
 * Route guard SOLO ADMIN: el layout de `(panel)` ya exige profesional o admin; aquí
 * se estrecha a admin. Un profesional que navegue a `/admin` recibe un redirect a
 * `/pacientes` (su área). La garantía se refuerza en CADA Server Action con
 * `obtenerSesionAdmin` (Next 16: el proxy no protege por rol).
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sesion = await obtenerSesionAdmin();
  if (!sesion) redirect("/pacientes");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-primario-suave text-primario"
        >
          <Shield className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-texto">
          Administración
        </h1>
        <p className="text-base leading-relaxed text-texto-suave">
          Alta y gestión de instituciones, profesionales y sus membresías. Sólo el
          administrador ve esta sección.
        </p>
      </header>
      <TabsAdmin />
      {children}
    </div>
  );
}
