import type { Metadata } from "next";
import { Users } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";

export const metadata: Metadata = {
  title: "Pacientes",
};

export default function PacientesPage() {
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Pacientes"
        descripcion="Listado de tus pacientes asignados, con su estado y último check-in."
        icono={<Users className="h-6 w-6" aria-hidden />}
      />

      <section className="rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
        <p className="text-base text-texto-suave">
          Aún no hay pacientes que mostrar. El listado se poblará en una próxima
          entrega.
        </p>
      </section>
    </div>
  );
}
