import type { Metadata } from "next";
import CabeceraPerfil from "@/components/paciente/perfil/CabeceraPerfil";
import PanelPerfil from "@/components/paciente/perfil/PanelPerfil";
import { cargarDatosPerfil } from "./datos";

export const metadata: Metadata = {
  title: "Perfil",
};

/**
 * Perfil evolutivo del paciente (WP-05).
 *
 * Server Component: carga y AGREGA los datos en el servidor (RLS 'propio' de
 * WP-01) y pasa las series YA CALCULADAS a los componentes cliente de gráfico.
 * No hay ningún fetch de datos desde el cliente. Reflejo de lo registrado; sin
 * contenido que diagnostique.
 */
export default async function PerfilPage() {
  const datos = await cargarDatosPerfil();

  return (
    <div className="flex flex-col gap-6">
      <CabeceraPerfil cabecera={datos.cabecera} />
      <PanelPerfil datos={datos} />
      <p className="text-sm text-texto-tenue">
        Esto refleja lo que registras en tus check-ins. Botsy no diagnostica ni
        sustituye a tu médico.
      </p>
    </div>
  );
}
