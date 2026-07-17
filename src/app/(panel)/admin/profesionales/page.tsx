import type { Metadata } from "next";
import {
  listarProfesionalesAdmin,
  listarInstitucionesOpciones,
} from "@/lib/admin/datos";
import FormularioInvitarProfesional from "@/components/admin/FormularioInvitarProfesional";
import ListaProfesionales from "@/components/admin/ListaProfesionales";

export const metadata: Metadata = {
  title: "Profesionales · Administración",
};

/**
 * Gestión de profesionales y membresías (WP-23 §3 y §4). Server Component: lee con
 * el cliente de servidor (RLS admin). Invitación por email (Auth Admin API) y
 * asignación/retiro de membresías profesional↔institución.
 */
export default async function AdminProfesionalesPage() {
  const [profesionales, instituciones] = await Promise.all([
    listarProfesionalesAdmin(),
    listarInstitucionesOpciones(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <FormularioInvitarProfesional />
      <ListaProfesionales
        profesionales={profesionales}
        instituciones={instituciones}
      />
    </div>
  );
}
