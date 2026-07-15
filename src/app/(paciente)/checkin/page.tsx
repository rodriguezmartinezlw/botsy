import type { Metadata } from "next";
import { MessagesSquare, Mic } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";

export const metadata: Metadata = {
  title: "Check-in",
};

export default function CheckinPage() {
  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Tu check-in de hoy"
        descripcion="Cuéntame cómo te encuentras. Puedes escribirme o hablar conmigo, como prefieras."
        icono={<MessagesSquare className="h-6 w-6" aria-hidden />}
      />

      <div className="flex flex-col gap-3">
        <div className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-superficie-suave px-6 text-lg font-semibold text-texto-tenue">
          <MessagesSquare className="h-5 w-5" aria-hidden />
          Escribir (próximamente)
        </div>
        <div className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-borde px-6 text-lg font-semibold text-texto-tenue">
          <Mic className="h-5 w-5" aria-hidden />
          Hablar (próximamente)
        </div>
      </div>

      <p className="text-sm text-texto-tenue">
        La conversación se habilitará en una próxima entrega. Botsy solo registra
        y pregunta; no diagnostica.
      </p>
    </div>
  );
}
