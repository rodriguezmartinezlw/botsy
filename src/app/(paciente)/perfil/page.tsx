import type { Metadata } from "next";
import { User } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";

export const metadata: Metadata = {
  title: "Perfil",
};

export default function PerfilPage() {
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Tu perfil"
        descripcion="Aquí verás tu evolución y tus datos. Tú decides qué compartes; puedes revisarlo cuando quieras."
        icono={<User className="h-6 w-6" aria-hidden />}
      />

      <section className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6">
        <h2 className="text-lg font-semibold text-texto">Tu evolución</h2>
        <p className="text-base text-texto-suave">
          Cuando empieces a hacer check-ins, aquí aparecerá tu progreso.
        </p>
      </section>
    </div>
  );
}
