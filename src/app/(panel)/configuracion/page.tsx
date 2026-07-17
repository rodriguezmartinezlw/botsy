import type { Metadata } from "next";
import { Building2, Settings } from "lucide-react";
import EncabezadoPagina from "@/components/ui/EncabezadoPagina";
import FormularioConfiguracion from "@/components/panel/FormularioConfiguracion";
import {
  cargarConfiguracion,
  listarInstitucionesDelProfesional,
} from "@/lib/panel/datos";

export const metadata: Metadata = {
  title: "Configuración",
};

/**
 * Configuración del profesional (WP-06, F1 mínimo): nombre y teléfono de
 * contacto que ven sus pacientes. Server Component: lee su propio perfil (RLS
 * `perfiles_select_propio`) y delega en el formulario cliente.
 *
 * WP-22: muestra además, en SOLO LECTURA, las instituciones del profesional (y
 * su país). La gestión de países/instituciones/membresías es del administrador.
 */
export default async function ConfiguracionPage() {
  const [config, instituciones] = await Promise.all([
    cargarConfiguracion(),
    listarInstitucionesDelProfesional(),
  ]);

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

      <section
        aria-label="Mis instituciones"
        className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6"
      >
        <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
          <Building2 className="h-5 w-5 text-primario" aria-hidden />
          Mis instituciones
        </h2>
        {instituciones.length === 0 ? (
          <p className="text-base text-texto-suave">
            Aún no tienes ninguna institución asignada. Pide al administrador que
            te asigne una para poder dar de alta y ver pacientes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {instituciones.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-superficie-suave px-4 py-3"
              >
                <span className="text-base font-medium text-texto">{i.nombre}</span>
                {i.paisNombre ? (
                  <span className="text-sm text-texto-tenue">{i.paisNombre}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-texto-tenue">
          Ves a los pacientes de estas instituciones. La gestión de países,
          instituciones y membresías la realiza el administrador.
        </p>
      </section>
    </div>
  );
}
