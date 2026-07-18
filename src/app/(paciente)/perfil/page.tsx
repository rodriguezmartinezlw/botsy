import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, TrendingUp } from "lucide-react";
import FormularioMisDatos from "@/components/paciente/perfil/FormularioMisDatos";
import BotonCerrarSesion from "@/components/paciente/perfil/BotonCerrarSesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { horaDesdeColumna } from "@/lib/perfil/datos-perfil";
import { esZonaHorariaValida } from "@/lib/perfil/zonas";

export const metadata: Metadata = {
  title: "Perfil",
};

type DatosEditables = {
  nombre: string;
  telefono: string;
  hora: string;
  zona: string;
  avatarUrl: string | null;
};

/**
 * Carga los campos NO clínicos editables del paciente autenticado (WP-20 §C).
 * RLS 'propio': solo ve lo suyo. Ante cualquier fallo devuelve valores por
 * defecto coherentes (nunca lanza).
 */
async function cargarDatosEditables(): Promise<DatosEditables> {
  const porDefecto: DatosEditables = {
    nombre: "",
    telefono: "",
    hora: "10:00",
    zona: "America/Lima",
    avatarUrl: null,
  };
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return porDefecto;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, telefono, zona_horaria, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("hora_checkin")
      .eq("id", user.id)
      .maybeSingle();

    const zona = perfil?.zona_horaria ?? "";
    return {
      nombre: perfil?.nombre ?? "",
      telefono: perfil?.telefono ?? "",
      hora: horaDesdeColumna(paciente?.hora_checkin),
      zona: esZonaHorariaValida(zona) ? zona : "America/Lima",
      avatarUrl: perfil?.avatar_url ?? null,
    };
  } catch {
    return porDefecto;
  }
}

function inicialDe(nombre: string): string {
  const limpio = nombre.trim();
  return limpio.length > 0 ? limpio[0].toUpperCase() : "?";
}

/**
 * Perfil del paciente (WP-05 + WP-20 §C), reenfocado (feedback 2026-07-18):
 * solo IDENTIDAD y AJUSTES. La evolución clínica (gráficos, racha, síntomas) se
 * trasladó a Inicio; aquí quedan los datos personales editables, los
 * consentimientos y el cierre de sesión. No hay contenido que diagnostique.
 */
export default async function PerfilPage() {
  const editables = await cargarDatosEditables();
  const nombreMostrado =
    editables.nombre.trim().length > 0 ? editables.nombre : "Tu perfil";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        {editables.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={editables.avatarUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primario-suave text-2xl font-bold text-primario"
          >
            {inicialDe(editables.nombre)}
          </span>
        )}
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-texto">
            {nombreMostrado}
          </h1>
          <p className="text-base text-texto-suave">Tus datos y ajustes</p>
        </div>
      </header>

      <FormularioMisDatos
        nombreInicial={editables.nombre}
        telefonoInicial={editables.telefono}
        horaInicial={editables.hora}
        zonaInicial={editables.zona}
      />

      <Link
        href="/inicio"
        className="flex h-12 items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave px-5 text-base font-semibold text-texto transition-colors hover:bg-superficie"
      >
        <span className="inline-flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primario" aria-hidden />
          Ver mi evolución
        </span>
        <span className="text-texto-tenue" aria-hidden>
          →
        </span>
      </Link>

      <section
        aria-label="Ajustes de cuenta"
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6"
      >
        <h2 className="text-lg font-bold text-texto">Cuenta y privacidad</h2>
        <Link
          href="/consentimientos"
          className="flex h-12 items-center justify-between gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-5 text-base font-semibold text-primario transition-colors hover:bg-primario-suave"
        >
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            Mis consentimientos
          </span>
        </Link>
        <BotonCerrarSesion />
      </section>

      <p className="text-sm text-texto-tenue">
        Botsy no diagnostica ni sustituye a tu médico.
      </p>
    </div>
  );
}
