import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";

export const metadata: Metadata = {
  title: "Consentimientos",
};

export default function ConsentimientosPage() {
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Tus consentimientos"
        descripcion="Aquí controlas qué permites y qué no. Puedes otorgar o retirar cada permiso cuando quieras."
        icono={<ShieldCheck className="h-6 w-6" aria-hidden />}
      />

      <section className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6">
        <h2 className="text-lg font-semibold text-texto">
          Permisos y privacidad
        </h2>
        <p className="text-base text-texto-suave">
          La gestión de consentimientos se habilitará en una próxima entrega.
        </p>
        <p className="text-sm text-texto-tenue">[PENDIENTE LEGAL]</p>
      </section>
    </div>
  );
}
