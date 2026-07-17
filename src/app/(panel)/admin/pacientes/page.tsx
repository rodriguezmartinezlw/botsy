import type { Metadata } from "next";
import {
  listarPacientesSinInstitucion,
  listarInstitucionesOpciones,
} from "@/lib/admin/datos";
import PacientesSinInstitucion from "@/components/admin/PacientesSinInstitucion";

export const metadata: Metadata = {
  title: "Pacientes sin institución · Administración",
};

/**
 * Pacientes sin institución (WP-23 §5). Cierra el riesgo operativo de WP-22: un
 * paciente con `institucion_id` NULL no es visible para ningún profesional. Server
 * Component: lee con el cliente de servidor (RLS `pacientes_admin_todo`).
 */
export default async function AdminPacientesPage() {
  const [pacientes, instituciones] = await Promise.all([
    listarPacientesSinInstitucion(),
    listarInstitucionesOpciones(),
  ]);

  return (
    <PacientesSinInstitucion
      pacientes={pacientes}
      instituciones={instituciones}
    />
  );
}
