import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Home, MessagesSquare, Mic, TrendingUp, UserRoundSearch } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import InterstitialConsentimiento from "@/components/paciente/InterstitialConsentimiento";
import EstadoCheckinHoy from "@/components/paciente/EstadoCheckinHoy";
import PanelPerfil from "@/components/paciente/perfil/PanelPerfil";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";
import {
  estadoVigenteConsentimientos,
  puedeConversar,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import type { EstadoCheckin } from "@/types/db";
import { cargarDatosPerfil } from "../perfil/datos";

export const metadata: Metadata = { title: "Inicio" };

type EstadoInicio = {
  nombre: string;
  estadoCheckinHoy: EstadoCheckin | null;
  puedeConversar: boolean;
  vinculado: boolean;
  email: string;
};

async function cargarEstado(): Promise<EstadoInicio> {
  const porDefecto: EstadoInicio = {
    nombre: "",
    estadoCheckinHoy: null,
    puedeConversar: false,
    vinculado: true,
    email: "",
  };
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return porDefecto;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, zona_horaria")
      .eq("id", user.id)
      .maybeSingle();

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("profesional_id, institucion_id")
      .eq("id", user.id)
      .maybeSingle();

    const fecha = fechaHoyEnZona(perfil?.zona_horaria ?? "Europe/Madrid");
    // Solo el check-in ESTRUCTURADO de hoy: desde WP-24 pueden convivir varias
    // filas por fecha (check-in + consultas) y sin el filtro maybeSingle() falla.
    const { data: checkin } = await supabase
      .from("checkins")
      .select("estado")
      .eq("paciente_id", user.id)
      .eq("fecha", fecha)
      .eq("tipo", "checkin")
      .maybeSingle();

    const { data: filasConsent } = await supabase
      .from("consentimientos")
      .select("tipo, otorgado, registrado_en")
      .eq("paciente_id", user.id);
    const consent = estadoVigenteConsentimientos(
      (filasConsent ?? []) as FilaConsentimiento[],
    );

    return {
      nombre: perfil?.nombre ?? "",
      estadoCheckinHoy: checkin?.estado ?? null,
      puedeConversar: puedeConversar(consent),
      // Si no hay fila de paciente todavía, no mostramos el aviso (evita falsos
      // positivos ante un backend a medio configurar). Con el modelo por
      // institución (WP-22), la INVISIBILIDAD real la causa institucion_id NULL
      // (ningún profesional lo ve), así que el aviso cubre ambos huecos:
      // sin médico responsable O sin institución.
      vinculado: paciente
        ? paciente.profesional_id !== null && paciente.institucion_id !== null
        : true,
      email: user.email ?? "",
    };
  } catch {
    return porDefecto;
  }
}

function primerNombre(nombre: string): string {
  const limpio = nombre.trim();
  return limpio.length > 0 ? limpio.split(/\s+/)[0] : "";
}

export default async function InicioPage() {
  // Inicio es el HUB (feedback 2026-07-18): además de la conversación diaria,
  // muestra la EVOLUCIÓN clínica que antes vivía en Perfil (Perfil se queda solo
  // con los datos personales editables y los ajustes de cuenta).
  const [estado, datos] = await Promise.all([
    cargarEstado(),
    cargarDatosPerfil(),
  ]);
  const {
    nombre,
    estadoCheckinHoy,
    puedeConversar: puede,
    vinculado,
    email,
  } = estado;
  const { rachaActual, checkinsMes } = datos.cabecera;
  const saludoNombre = primerNombre(nombre);
  const completado = estadoCheckinHoy === "completado";
  const enCurso = estadoCheckinHoy === "en_curso";

  const textoEstado = completado
    ? "Check-in de hoy completado ✓ — puedo escucharte cuando quieras."
    : enCurso
      ? "Tienes un check-in a medias. ¿Lo terminamos?"
      : "Aún no has hecho tu check-in de hoy, tu conversación diaria conmigo.";

  // WP-24: los dos botones grandes SIEMPRE visibles. Con el check-in pendiente
  // van al check-in (voz/texto); con el día hecho abren una CONSULTA a demanda.
  const hrefVoz = completado ? "/checkin/voz?tipo=consulta" : "/checkin/voz";
  const hrefTexto = completado ? "/checkin?tipo=consulta" : "/checkin";

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo={saludoNombre ? `Hola, ${saludoNombre}` : "Hola de nuevo"}
        descripcion="Este es tu espacio diario. Cuando estés listo, cuéntame cómo te encuentras hoy."
        icono={<Home className="h-6 w-6" aria-hidden />}
      />

      {!vinculado && (
        <section
          aria-label="Vinculación con tu equipo de salud"
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border-2 border-primario bg-primario-suave p-5"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-superficie text-primario">
            <UserRoundSearch className="h-6 w-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-texto">
              Tu equipo de salud aún no te ha vinculado
            </p>
            <p className="text-base text-texto-suave">
              Para que puedan seguir tus check-ins, dales este correo con el que te
              registraste:
            </p>
            {email ? (
              <p className="mt-1 break-all rounded-[var(--radius-md)] bg-superficie px-3 py-2 text-base font-semibold text-texto">
                {email}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-texto-tenue">
              Puedes seguir haciendo tu check-in mientras tanto; se guardará para
              cuando te vinculen.
            </p>
          </div>
        </section>
      )}

      {!puede ? (
        <InterstitialConsentimiento />
      ) : (
        <>
          <section
            aria-label="Check-in de hoy"
            className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6"
          >
            <p className="text-base text-texto-suave">{textoEstado}</p>
            {completado && (
              <p className="text-base font-medium text-texto">
                Cuéntame lo que necesites, a cualquier hora.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {/* WP-24: micrófono accesible desde inicio, SIEMPRE. */}
              <Link
                href={hrefVoz}
                className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
              >
                <Mic className="h-5 w-5" aria-hidden />
                Hablar con Botsy
              </Link>
              <Link
                href={hrefTexto}
                className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-lg font-semibold text-primario transition-colors hover:bg-primario-suave"
              >
                <MessagesSquare className="h-5 w-5" aria-hidden />
                {enCurso ? "Continuar por escrito" : "Escribir"}
              </Link>
              {completado && (
                <Link
                  href="/checkin"
                  className="flex min-h-11 items-center justify-center px-4 py-2 text-base font-semibold text-primario underline-offset-4 hover:underline"
                >
                  Ver mi check-in de hoy
                </Link>
              )}
            </div>
          </section>

          {/* Evolución clínica (antes en Perfil). Cabecera de racha + panel. */}
          <section aria-label="Tu evolución" className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primario" aria-hidden />
              <h2 className="text-xl font-bold text-texto">Tu evolución</h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-borde bg-primario-suave px-4 py-3">
                <Flame className="h-6 w-6 text-primario" aria-hidden />
                <span className="text-base font-semibold text-texto">
                  {rachaActual} {rachaActual === 1 ? "día" : "días"} de racha
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave px-4 py-3">
                <span className="text-base text-texto-suave">
                  Check-ins este mes:
                </span>
                <span className="text-base font-semibold text-texto">
                  {checkinsMes}
                </span>
              </div>
            </div>

            <PanelPerfil datos={datos} />
          </section>
        </>
      )}

      <p className="text-sm text-texto-tenue">
        Botsy no diagnostica ni sustituye a tu médico.
      </p>

      {/* Estado del check-in de hoy, bajo el aviso legal (feedback 2026-07-18). */}
      {puede && <EstadoCheckinHoy estado={estadoCheckinHoy} />}
    </div>
  );
}
