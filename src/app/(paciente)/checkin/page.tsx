import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Mic } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { VerticalPaciente } from "@/types/db";
import ChatCheckin from "./ChatCheckin";

export const metadata: Metadata = { title: "Check-in" };

/**
 * Página del check-in por texto. Server Component: solo resuelve la vertical
 * del paciente (para la "recomendación del día") y delega en el chat cliente,
 * que gestiona iniciar/mensaje/finalizar contra `/api/checkin/*`.
 */
export default async function CheckinPage() {
  let vertical: VerticalPaciente = "general";
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("pacientes")
        .select("vertical")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.vertical) vertical = data.vertical;
    }
  } catch {
    // Sin Supabase configurado: degradamos a 'general'.
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Tu check-in de hoy"
        descripcion="Cuéntame cómo te encuentras. Yo te voy preguntando lo que falte."
        icono={<MessagesSquare className="h-6 w-6" aria-hidden />}
      />
      <Link
        href="/checkin/voz"
        className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
      >
        <Mic className="h-5 w-5" aria-hidden />
        Prefiero hablar
      </Link>
      <ChatCheckin vertical={vertical} />
    </div>
  );
}
