import type { Metadata } from "next";
import Link from "next/link";
import { Home, MessagesSquare } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";

export const metadata: Metadata = {
  title: "Inicio",
};

export default function InicioPage() {
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Hola de nuevo"
        descripcion="Este es tu espacio diario. Cuando estés listo, cuéntame cómo te encuentras hoy."
        icono={<Home className="h-6 w-6" aria-hidden />}
      />

      <section
        aria-label="Check-in de hoy"
        className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6"
      >
        <p className="text-base text-texto-suave">
          Aún no has hecho tu check-in de hoy.
        </p>
        <Link
          href="/checkin"
          className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
        >
          <MessagesSquare className="h-5 w-5" aria-hidden />
          Empezar mi check-in
        </Link>
      </section>

      <p className="text-sm text-texto-tenue">
        Botsy no diagnostica ni sustituye a tu médico.
      </p>
    </div>
  );
}
