import type { Metadata } from "next";
import {
  listarInstitucionesAdmin,
  listarPaises,
} from "@/lib/admin/datos";
import FormularioInstitucion from "@/components/admin/FormularioInstitucion";
import ListaInstituciones from "@/components/admin/ListaInstituciones";

export const metadata: Metadata = {
  title: "Instituciones · Administración",
};

/**
 * Gestión de instituciones (WP-23 §2). Server Component: lee con el cliente de
 * servidor (RLS admin de 0016). Alta y edición con país del catálogo; la lista
 * muestra país, nº de profesionales y de pacientes, y permite activar/desactivar.
 */
export default async function AdminInstitucionesPage() {
  const [instituciones, paises] = await Promise.all([
    listarInstitucionesAdmin(),
    listarPaises(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <FormularioInstitucion paises={paises} />
      <ListaInstituciones instituciones={instituciones} paises={paises} />
    </div>
  );
}
