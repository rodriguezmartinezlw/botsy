import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Home, MessagesSquare } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";
import type { EstadoCheckin } from "@/types/db";

export const metadata: Metadata = { title: "Inicio" };

type EstadoInicio = {
  nombre: string;
  rachaActual: number;
  estadoCheckinHoy: EstadoCheckin | null;
};

async function cargarEstado(): Promise<EstadoInicio> {
  const porDefecto: EstadoInicio = {
    nombre: "",
    rachaActual: 0,
    estadoCheckinHoy: null,
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
      .select("racha_actual")
      .eq("id", user.id)
      .maybeSingle();

    const fecha = fechaHoyEnZona(perfil?.zona_horaria ?? "Europe/Madrid");
    const { data: checkin } = await supabase
      .from("checkins")
      .select("estado")
      .eq("paciente_id", user.id)
      .eq("fecha", fecha)
      .maybeSingle();

    return {
      nombre: perfil?.nombre ?? "",
      rachaActual: paciente?.racha_actual ?? 0,
      estadoCheckinHoy: checkin?.estado ?? null,
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
  const { nombre, rachaActual, estadoCheckinHoy } = await cargarEstado();
  const saludoNombre = primerNombre(nombre);
  const completado = estadoCheckinHoy === "completado";
  const enCurso = estadoCheckinHoy === "en_curso";

  const textoEstado = completado
    ? "Ya has hecho tu check-in de hoy. ¡Gracias por cuidarte!"
    : enCurso
      ? "Tienes un check-in a medias. ¿Lo terminamos?"
      : "Aún no has hecho tu check-in de hoy.";

  const textoCta = enCurso ? "Continuar mi check-in" : "Empezar mi check-in";

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo={saludoNombre ? `Hola, ${saludoNombre}` : "Hola de nuevo"}
        descripcion="Este es tu espacio diario. Cuando estés listo, cuéntame cómo te encuentras hoy."
        icono={<Home className="h-6 w-6" aria-hidden />}
      />

      {rachaActual > 0 && (
        <section
          aria-label="Tu racha"
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-borde bg-primario-suave p-5"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-superficie text-primario">
            <Flame className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold text-texto">
              {rachaActual} {rachaActual === 1 ? "día" : "días"} seguidos
            </p>
            <p className="text-sm text-texto-suave">
              Cada día que registras cuenta.
            </p>
          </div>
        </section>
      )}

      <section
        aria-label="Check-in de hoy"
        className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6"
      >
        <p className="text-base text-texto-suave">{textoEstado}</p>
        {completado ? (
          <Link
            href="/checkin"
            className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-lg font-semibold text-primario transition-colors hover:bg-primario-suave"
          >
            <MessagesSquare className="h-5 w-5" aria-hidden />
            Ver mi check-in
          </Link>
        ) : (
          <Link
            href="/checkin"
            className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
          >
            <MessagesSquare className="h-5 w-5" aria-hidden />
            {textoCta}
          </Link>
        )}
      </section>

      <p className="text-sm text-texto-tenue">
        Botsy no diagnostica ni sustituye a tu médico.
      </p>
    </div>
  );
}
