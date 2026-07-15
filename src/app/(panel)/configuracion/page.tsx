import type { Metadata } from "next";
import { Settings } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";

export const metadata: Metadata = {
  title: "Configuración",
};

export default function ConfiguracionPage() {
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Ajustes del panel profesional: reglas de escalado, recordatorios y preferencias."
        icono={<Settings className="h-6 w-6" aria-hidden />}
      />

      <section className="rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
        <p className="text-base text-texto-suave">
          Los ajustes se habilitarán en próximas entregas.
        </p>
      </section>
    </div>
  );
}
