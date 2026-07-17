import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import CabeceraPerfil from "@/components/paciente/perfil/CabeceraPerfil";
import PanelPerfil from "@/components/paciente/perfil/PanelPerfil";
import FormularioMisDatos from "@/components/paciente/perfil/FormularioMisDatos";
import BotonCerrarSesion from "@/components/paciente/perfil/BotonCerrarSesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { horaDesdeColumna } from "@/lib/perfil/datos-perfil";
import { esZonaHorariaValida } from "@/lib/perfil/zonas";
import { cargarDatosPerfil } from "./datos";

export const metadata: Metadata = {
  title: "Perfil",
};

type DatosEditables = {
  nombre: string;
  telefono: string;
  hora: string;
  zona: string;
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
  };
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return porDefecto;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, telefono, zona_horaria")
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
    };
  } catch {
    return porDefecto;
  }
}

/**
 * Perfil evolutivo del paciente (WP-05) + cuenta editable (WP-20 §C).
 *
 * Server Component: carga y AGREGA los datos en el servidor (RLS 'propio' de
 * WP-01) y pasa las series YA CALCULADAS a los componentes cliente de gráfico.
 * Añade la sección "Mis datos" (editable), el acceso a "Mis consentimientos" y el
 * cierre de sesión. No hay contenido que diagnostique.
 */
export default async function PerfilPage() {
  const [datos, editables] = await Promise.all([
    cargarDatosPerfil(),
    cargarDatosEditables(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <CabeceraPerfil cabecera={datos.cabecera} />
      <PanelPerfil datos={datos} />

      <FormularioMisDatos
        nombreInicial={editables.nombre}
        telefonoInicial={editables.telefono}
        horaInicial={editables.hora}
        zonaInicial={editables.zona}
      />

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
        Esto refleja lo que registras en tus check-ins. Botsy no diagnostica ni
        sustituye a tu médico.
      </p>
    </div>
  );
}
