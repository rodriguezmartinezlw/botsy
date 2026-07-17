import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MessagesSquare, Mic } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import InterstitialConsentimiento from "@/components/paciente/InterstitialConsentimiento";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  estadoVigenteConsentimientos,
  puedeConversar,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";
import type { EstadoCheckin, TipoCheckin, VerticalPaciente } from "@/types/db";
import ChatCheckin from "./ChatCheckin";

export const metadata: Metadata = { title: "Check-in" };

type EstadoPagina = {
  vertical: VerticalPaciente;
  puede: boolean;
  estadoHoy: EstadoCheckin | null;
  resumenHoy: string | null;
};

async function cargarEstado(): Promise<EstadoPagina> {
  const porDefecto: EstadoPagina = {
    vertical: "general",
    puede: false,
    estadoHoy: null,
    resumenHoy: null,
  };
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return porDefecto;

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("vertical")
      .eq("id", user.id)
      .maybeSingle();

    const { data: filas } = await supabase
      .from("consentimientos")
      .select("tipo, otorgado, registrado_en")
      .eq("paciente_id", user.id);
    const consentimientos = estadoVigenteConsentimientos(
      (filas ?? []) as FilaConsentimiento[],
    );

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("zona_horaria")
      .eq("id", user.id)
      .maybeSingle();
    const fecha = fechaHoyEnZona(perfil?.zona_horaria ?? "Europe/Madrid");

    // Solo el check-in ESTRUCTURADO de hoy (WP-24: conviven consultas en la
    // misma fecha; sin el filtro por tipo, maybeSingle() fallaría).
    const { data: checkin } = await supabase
      .from("checkins")
      .select("estado, resumen")
      .eq("paciente_id", user.id)
      .eq("fecha", fecha)
      .eq("tipo", "checkin")
      .maybeSingle();

    return {
      vertical: paciente?.vertical ?? "general",
      puede: puedeConversar(consentimientos),
      estadoHoy: checkin?.estado ?? null,
      resumenHoy: checkin?.resumen ?? null,
    };
  } catch {
    // Sin Supabase configurado: degradamos a 'general' y sin consentimientos.
    return porDefecto;
  }
}

/**
 * Página del check-in por texto. Server Component: resuelve la vertical (para
 * la "recomendación del día"), el consentimiento `conversacion` y el estado del
 * check-in de HOY. WP-24: con `?tipo=consulta` abre una conversación a demanda;
 * con el check-in completado NO bloquea — muestra el resumen y ofrece iniciar
 * una conversación. Sin consentimiento, interstitial obligatorio (además del
 * gate de servidor en `/api/checkin/iniciar`).
 */
export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const [{ vertical, puede, estadoHoy, resumenHoy }, sp] = await Promise.all([
    cargarEstado(),
    searchParams,
  ]);
  const modoConsulta = sp.tipo === "consulta";
  const tipo: TipoCheckin = modoConsulta ? "consulta" : "checkin";
  const completadoHoy = estadoHoy === "completado";

  if (!puede) {
    return (
      <div className="flex flex-col gap-6">
        <EncabezadoPagina
          titulo="Tu check-in de hoy"
          descripcion="Cuéntame cómo te encuentras. Yo te voy preguntando lo que falte."
          icono={<MessagesSquare className="h-6 w-6" aria-hidden />}
        />
        <InterstitialConsentimiento />
      </div>
    );
  }

  // Check-in de hoy completado y sin pedir consulta: resumen + invitación a
  // conversar (WP-24 §C.2). Nada de bloquear.
  if (completadoHoy && !modoConsulta) {
    return (
      <div className="flex flex-col gap-6">
        <EncabezadoPagina
          titulo="Tu check-in de hoy"
          descripcion="Ya lo completaste. Puedo escucharte cuando quieras."
          icono={<CheckCircle2 className="h-6 w-6" aria-hidden />}
        />
        {resumenHoy && (
          <section
            aria-label="Resumen de hoy"
            className="rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-5"
          >
            <p className="text-base leading-relaxed text-texto">{resumenHoy}</p>
          </section>
        )}
        <div className="flex flex-col gap-3">
          <Link
            href="/checkin?tipo=consulta"
            className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
          >
            <MessagesSquare className="h-5 w-5" aria-hidden />
            Iniciar una conversación
          </Link>
          <Link
            href="/checkin/voz?tipo=consulta"
            className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
          >
            <Mic className="h-5 w-5" aria-hidden />
            Prefiero hablar
          </Link>
          <Link
            href="/inicio"
            className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] border border-borde bg-superficie px-6 text-base font-semibold text-texto-suave transition-colors hover:bg-superficie-suave"
          >
            Volver al inicio
          </Link>
        </div>
        <p className="text-sm text-texto-tenue">
          Botsy no diagnostica ni sustituye a tu médico.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={modoConsulta ? "Conversación con Botsy" : "Tu check-in de hoy"}
        descripcion={
          modoConsulta
            ? "Cuéntame lo que necesites, a cualquier hora."
            : "Cuéntame cómo te encuentras. Yo te voy preguntando lo que falte."
        }
        icono={<MessagesSquare className="h-6 w-6" aria-hidden />}
      />
      <Link
        href={modoConsulta ? "/checkin/voz?tipo=consulta" : "/checkin/voz"}
        className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
      >
        <Mic className="h-5 w-5" aria-hidden />
        Prefiero hablar
      </Link>
      <ChatCheckin vertical={vertical} tipo={tipo} />
    </div>
  );
}
