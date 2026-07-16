import type { Metadata } from "next";
import { Users } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import ListaPacientes from "@/components/panel/ListaPacientes";
import { listarPacientes } from "@/lib/panel/datos";

export const metadata: Metadata = {
  title: "Pacientes",
};

/**
 * Lista de pacientes del profesional (WP-06).
 *
 * Server Component: lee con el cliente de servidor (la RLS de WP-01 devuelve
 * SÓLO los pacientes asignados) y pasa la lista YA ORDENADA (mayor riesgo →
 * más días sin check-in) al componente cliente, que sólo filtra por nombre.
 */
export default async function PacientesPage() {
  const pacientes = await listarPacientes();

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Pacientes"
        descripcion="Tus pacientes asignados, ordenados por riesgo y tiempo sin check-in."
        icono={<Users className="h-6 w-6" aria-hidden />}
      />
      <ListaPacientes pacientes={pacientes} />
    </div>
  );
}
