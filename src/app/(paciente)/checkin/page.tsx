import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Mic } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import InterstitialConsentimiento from "@/components/paciente/InterstitialConsentimiento";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  estadoVigenteConsentimientos,
  puedeConversar,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import type { VerticalPaciente } from "@/types/db";
import ChatCheckin from "./ChatCheckin";

export const metadata: Metadata = { title: "Check-in" };

/**
 * Página del check-in por texto. Server Component: resuelve la vertical del
 * paciente (para la "recomendación del día") y su consentimiento `conversacion`.
 * Sin ese consentimiento, se muestra el interstitial obligatorio y NO se permite
 * conversar (además del gate de servidor en `/api/checkin/iniciar`).
 */
export default async function CheckinPage() {
  let vertical: VerticalPaciente = "general";
  let consentimientos = estadoVigenteConsentimientos([]);
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

      const { data: filas } = await supabase
        .from("consentimientos")
        .select("tipo, otorgado, registrado_en")
        .eq("paciente_id", user.id);
      consentimientos = estadoVigenteConsentimientos(
        (filas ?? []) as FilaConsentimiento[],
      );
    }
  } catch {
    // Sin Supabase configurado: degradamos a 'general' y sin consentimientos.
  }

  const puede = puedeConversar(consentimientos);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Tu check-in de hoy"
        descripcion="Cuéntame cómo te encuentras. Yo te voy preguntando lo que falte."
        icono={<MessagesSquare className="h-6 w-6" aria-hidden />}
      />
      {puede ? (
        <>
          <Link
            href="/checkin/voz"
            className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
          >
            <Mic className="h-5 w-5" aria-hidden />
            Prefiero hablar
          </Link>
          <ChatCheckin vertical={vertical} />
        </>
      ) : (
        <InterstitialConsentimiento />
      )}
    </div>
  );
}
