import { redirect } from "next/navigation";

/**
 * Índice de administración: entra directamente a la gestión de instituciones
 * (la primera pestaña). El guard solo-admin vive en el layout de `/admin`.
 */
export default function AdminIndexPage() {
  redirect("/admin/instituciones");
}
