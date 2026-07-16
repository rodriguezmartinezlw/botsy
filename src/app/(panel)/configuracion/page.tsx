import type { Metadata } from "next";
import { Settings } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import FormularioConfiguracion from "@/components/panel/FormularioConfiguracion";
import { cargarConfiguracion } from "@/lib/panel/datos";

export const metadata: Metadata = {
  title: "Configuración",
};

/**
 * Configuración del profesional (WP-06, F1 mínimo): nombre y teléfono de
 * contacto que ven sus pacientes. Server Component: lee su propio perfil (RLS
 * `perfiles_select_propio`) y delega en el formulario cliente.
 */
export default async function ConfiguracionPage() {
  const config = await cargarConfiguracion();

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Tus datos de contacto. El teléfono es el que Botsy ofrece a tus pacientes cuando les recomienda llamarte."
        icono={<Settings className="h-6 w-6" aria-hidden />}
      />
      <FormularioConfiguracion
        nombreInicial={config.nombre}
        telefonoInicial={config.telefono ?? ""}
      />
    </div>
  );
}
