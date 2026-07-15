import type { Metadata } from "next";
import { Bell } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";

export const metadata: Metadata = {
  title: "Alertas",
};

export default function AlertasPage() {
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Alertas"
        descripcion="Bandeja de señales detectadas en los check-ins, ordenadas por nivel de escalado."
        icono={<Bell className="h-6 w-6" aria-hidden />}
      />

      <section className="rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
        <p className="text-base text-texto-suave">
          No hay alertas por ahora. La bandeja se activará con el motor de
          escalado.
        </p>
      </section>
    </div>
  );
}
