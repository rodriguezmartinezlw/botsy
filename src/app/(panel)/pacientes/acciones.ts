"use server";

/**
 * Enrolamiento de pacientes desde el panel (WP-20 §A) — Server Action.
 *
 * Es el onboarding del PSP: el PROGRAMA enrola (MEMORIA §7). Flujo:
 *   1. Valida con Zod y comprueba sesión de profesional/admin (Next 16: la
 *      autorización va DENTRO de la acción).
 *   2. Crea la cuenta con la Auth Admin API (`inviteUserByEmail`, mailer
 *      integrado de Supabase; sin Resend) con metadatos {rol:'paciente', nombre};
 *      el trigger `on_auth_user_created` crea perfil + paciente.
 *   3. Asigna `profesional_id` = el profesional actual y el programa elegido
 *      (reutilizando `asignarProgramaAPaciente` → `sincronizarReglasPrograma`).
 *   4. Si el email ya existe, NO duplica: ofrece VINCULAR al paciente existente.
 *
 * Uso del cliente admin (bypasa RLS): estrictamente para el BOOTSTRAP del alta
 * —crear el usuario y fijar `profesional_id` en un paciente que aún no es "suyo"
 * (la RLS del profesional no puede escribirlo hasta que lo sea)—. Es una tarea de
 * servidor de confianza, exactamente el uso previsto de `crearClienteAdmin`.
 * La auditoría se escribe como el profesional (RLS append-only), no con admin.
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { obtenerSesionPanel, registrarAuditoria } from "@/lib/panel/sesion-panel";
import { asignarProgramaAPaciente } from "@/lib/programas/asignacion";
import {
  enrolarPaciente as ejecutarEnrolamiento,
  esquemaEnrolamiento,
  type PuertoEnrolamiento,
  type ResultadoEnrolamiento,
} from "@/lib/enrolamiento/nucleo";
import type { BaseDatos, Json } from "@/types/db";

/** Base pública para el enlace del correo de invitación (crear contraseña). */
function baseAppUrl(): string {
  return (process.env.APP_URL ?? "").replace(/\/+$/, "");
}

export async function enrolarPaciente(
  entrada: unknown,
): Promise<ResultadoEnrolamiento> {
  const analizado = esquemaEnrolamiento.safeParse(entrada);
  if (!analizado.success) {
    const primero = analizado.error.issues[0]?.message;
    return { ok: false, error: primero ?? "Revisa los datos del formulario." };
  }

  const sesion = await obtenerSesionPanel();
  if (!sesion) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }

  let admin: SupabaseClient<BaseDatos>;
  try {
    admin = crearClienteAdmin();
  } catch {
    return {
      ok: false,
      error:
        "El alta de pacientes no está disponible: falta configurar el servidor. Avisa al administrador.",
    };
  }

  const base = baseAppUrl();

  const puerto: PuertoEnrolamiento = {
    async buscarUsuarioPorEmail(email) {
      // La Auth Admin API no filtra por email; se pagina y se compara (escala de
      // piloto: decenas de pacientes). Cota de páginas para no iterar sin fin.
      const emailBuscado = email.toLowerCase();
      for (let pagina = 1; pagina <= 20; pagina += 1) {
        const { data, error } = await admin.auth.admin.listUsers({
          page: pagina,
          perPage: 200,
        });
        if (error) return null;
        const usuarios = data.users ?? [];
        const encontrado = usuarios.find(
          (u) => (u.email ?? "").toLowerCase() === emailBuscado,
        );
        if (encontrado) return { id: encontrado.id };
        if (usuarios.length < 200) break; // última página
      }
      return null;
    },

    async invitar(email, meta) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { rol: meta.rol, nombre: meta.nombre },
        ...(base ? { redirectTo: `${base}/restablecer` } : {}),
      });
      if (error || !data.user) {
        return {
          ok: false,
          error: "No se pudo enviar la invitación. Revisa el correo e inténtalo de nuevo.",
        };
      }
      return { ok: true, userId: data.user.id };
    },

    async obtenerPaciente(userId) {
      const { data: perfil } = await admin
        .from("perfiles")
        .select("rol")
        .eq("id", userId)
        .maybeSingle();
      const { data: paciente } = await admin
        .from("pacientes")
        .select("profesional_id")
        .eq("id", userId)
        .maybeSingle();
      if (!perfil) return null;
      return {
        profesionalId: paciente?.profesional_id ?? null,
        esPaciente: perfil.rol === "paciente" && paciente !== null,
      };
    },

    async vincularProfesional(userId, profesionalId, extra) {
      const actualizacionPaciente: {
        profesional_id: string;
        fecha_nacimiento?: string;
      } = { profesional_id: profesionalId };
      if (extra.fechaNacimiento) {
        actualizacionPaciente.fecha_nacimiento = extra.fechaNacimiento;
      }
      const { error: errPac } = await admin
        .from("pacientes")
        .update(actualizacionPaciente)
        .eq("id", userId);
      if (errPac) return false;

      if (extra.telefono) {
        const { error: errPerf } = await admin
          .from("perfiles")
          .update({ telefono: extra.telefono })
          .eq("id", userId);
        if (errPerf) return false;
      }
      return true;
    },

    async asignarPrograma(userId, programaClave, asignadoPor) {
      const r = await asignarProgramaAPaciente(
        admin,
        userId,
        programaClave,
        asignadoPor,
      );
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    },

    async auditar(accion, entidadId, detalle) {
      await registrarAuditoria(
        sesion.supabase,
        sesion.userId,
        accion,
        "pacientes",
        entidadId,
        detalle as Json,
      );
    },
  };

  const resultado = await ejecutarEnrolamiento(
    puerto,
    sesion.userId,
    analizado.data,
  );

  if (resultado.ok) revalidatePath("/pacientes");
  return resultado;
}
