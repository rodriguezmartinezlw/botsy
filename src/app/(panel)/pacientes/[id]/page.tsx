import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CabeceraFicha from "@/components/panel/ficha/CabeceraFicha";
import FichaPacienteTabs from "@/components/panel/ficha/FichaPacienteTabs";
import {
  cargarFichaPaciente,
  cargarMotivos,
  cargarProgramaPaciente,
} from "@/lib/panel/datos";

export const metadata: Metadata = {
  title: "Ficha del paciente",
};

/**
 * Ficha 360º del paciente (WP-06).
 *
 * Server Component: carga con el cliente de servidor. La RLS de WP-01 devuelve
 * la ficha SÓLO si el paciente está asignado a este profesional; si no, la
 * consulta viene vacía y respondemos 404 (un profesional no puede ver, ni
 * forzando la URL, a pacientes de otro profesional).
 */
export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ficha = await cargarFichaPaciente(id);
  if (!ficha) notFound();
  const [programa, motivos] = await Promise.all([
    cargarProgramaPaciente(id),
    cargarMotivos(),
  ]);
  const motivosDiscontinuacion = motivos.filter(
    (m) => m.ambito === "discontinuacion",
  );

  return (
    <div className="flex flex-col gap-6">
      <CabeceraFicha cabecera={ficha.cabecera} />
      <FichaPacienteTabs
        ficha={ficha}
        programa={programa}
        motivosDiscontinuacion={motivosDiscontinuacion}
      />
    </div>
  );
}
