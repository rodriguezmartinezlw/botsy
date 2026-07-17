"use server";

/**
 * Server Actions de profesionales y membresías (WP-23 §3 y §4) — SOLO admin.
 *
 * - `invitarProfesional`: reutiliza el patrón de WP-20 (Auth Admin API con puerto
 *   inyectable). El cliente service-role se usa EXCLUSIVAMENTE para crear la
 *   cuenta (tarea de servidor de confianza); el trigger crea el perfil con rol
 *   'profesional' (0001, sin fila de paciente). La auditoría se escribe como el
 *   admin (RLS append-only), no con service-role.
 * - `asignarMembresia` / `retirarMembresia`: escriben `profesionales_instituciones`
 *   con el cliente de SERVIDOR (RLS admin de 0016). Al retirar la ÚLTIMA membresía
 *   activa de un profesional con pacientes, se exige confirmación (aviso).
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { obtenerSesionAdmin } from "@/lib/admin/sesion-admin";
import { registrarAuditoria } from "@/lib/panel/sesion-panel";
import {
  invitarProfesional as ejecutarInvitacion,
  esquemaInvitarProfesional,
  type PuertoInvitacionProfesional,
} from "@/lib/admin/invitacion";
import {
  esquemaAsignarMembresia,
  esquemaRetirarMembresia,
  avisoRetiroMembresia,
} from "@/lib/admin/esquemas";
import type { AccionAdmin } from "@/lib/admin/tipos";
import type { BaseDatos, Json } from "@/types/db";

const FALLO_SESION = "No tienes permiso para esta acción.";
const FALLO_ESCRITURA = "No se pudo guardar. Inténtalo de nuevo.";

/** Base pública para el enlace del correo de invitación (crear contraseña). */
function baseAppUrl(): string {
  return (process.env.APP_URL ?? "").replace(/\/+$/, "");
}

function revalidarAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/profesionales");
}

// --- Invitación de profesional (Auth Admin API, como WP-20) ------------------

export async function invitarProfesional(entrada: unknown): Promise<AccionAdmin> {
  const analizado = esquemaInvitarProfesional.safeParse(entrada);
  if (!analizado.success) {
    return {
      ok: false,
      error: analizado.error.issues[0]?.message ?? "Revisa los datos.",
    };
  }

  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  let admin: SupabaseClient<BaseDatos>;
  try {
    admin = crearClienteAdmin();
  } catch {
    return {
      ok: false,
      error:
        "La invitación no está disponible: falta configurar el servidor. Avisa al administrador del sistema.",
    };
  }

  const base = baseAppUrl();

  const puerto: PuertoInvitacionProfesional = {
    async buscarUsuarioPorEmail(email) {
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
          error:
            "No se pudo enviar la invitación. Revisa el correo e inténtalo de nuevo.",
        };
      }
      return { ok: true, userId: data.user.id };
    },

    async obtenerRol(userId) {
      const { data: perfil } = await admin
        .from("perfiles")
        .select("rol")
        .eq("id", userId)
        .maybeSingle();
      return perfil?.rol ?? null;
    },

    async auditar(accion, entidadId, detalle) {
      await registrarAuditoria(
        sesion.supabase,
        sesion.userId,
        accion,
        "perfiles",
        entidadId,
        detalle as Json,
      );
    },
  };

  const resultado = await ejecutarInvitacion(puerto, sesion.userId, analizado.data);
  if (!resultado.ok) return { ok: false, error: resultado.error };

  revalidarAdmin();
  return { ok: true, mensaje: resultado.mensaje };
}

// --- Membresías --------------------------------------------------------------

export async function asignarMembresia(entrada: unknown): Promise<AccionAdmin> {
  const a = esquemaAsignarMembresia.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };

  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  // El destinatario debe ser un profesional; la institución debe estar activa.
  const [{ data: perfil }, { data: institucion }] = await Promise.all([
    sesion.supabase
      .from("perfiles")
      .select("rol")
      .eq("id", a.data.profesionalId)
      .maybeSingle(),
    sesion.supabase
      .from("instituciones")
      .select("activa")
      .eq("id", a.data.institucionId)
      .maybeSingle(),
  ]);
  if (perfil?.rol !== "profesional") {
    return { ok: false, error: "Esa cuenta no es de un profesional." };
  }
  if (!institucion) {
    return { ok: false, error: "La institución no existe." };
  }
  if (!institucion.activa) {
    return { ok: false, error: "La institución está desactivada; actívala primero." };
  }

  // Crea o REACTIVA la membresía (unique profesional_id+institucion_id).
  const { error } = await sesion.supabase
    .from("profesionales_instituciones")
    .upsert(
      {
        profesional_id: a.data.profesionalId,
        institucion_id: a.data.institucionId,
        activa: true,
      },
      { onConflict: "profesional_id,institucion_id" },
    );
  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "membresia_asignada",
    "profesionales_instituciones",
    a.data.profesionalId,
    { profesional_id: a.data.profesionalId, institucion_id: a.data.institucionId },
  );
  revalidarAdmin();
  return { ok: true, mensaje: "Membresía asignada." };
}

export async function retirarMembresia(entrada: unknown): Promise<AccionAdmin> {
  const a = esquemaRetirarMembresia.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };

  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { data: membresia } = await sesion.supabase
    .from("profesionales_instituciones")
    .select("id, profesional_id, institucion_id, activa")
    .eq("id", a.data.membresiaId)
    .maybeSingle();
  if (!membresia) return { ok: false, error: "La membresía no existe." };
  if (!membresia.activa) {
    revalidarAdmin();
    return { ok: true, mensaje: "La membresía ya estaba retirada." };
  }

  // Aviso al retirar la ÚLTIMA membresía activa de un profesional con pacientes.
  const [{ count: otrasActivas }, { count: pacientes }, { data: institucion }] =
    await Promise.all([
      sesion.supabase
        .from("profesionales_instituciones")
        .select("id", { count: "exact", head: true })
        .eq("profesional_id", membresia.profesional_id)
        .eq("activa", true)
        .neq("id", membresia.id),
      sesion.supabase
        .from("pacientes")
        .select("id", { count: "exact", head: true })
        .eq("institucion_id", membresia.institucion_id),
      sesion.supabase
        .from("instituciones")
        .select("nombre")
        .eq("id", membresia.institucion_id)
        .maybeSingle(),
    ]);

  if (!a.data.confirmar) {
    const aviso = avisoRetiroMembresia({
      otrasMembresiasActivas: otrasActivas ?? 0,
      pacientesEnInstitucion: pacientes ?? 0,
      nombreInstitucion: institucion?.nombre ?? "esta institución",
    });
    if (aviso) return { ok: false, error: aviso, confirmable: true };
  }

  const { error } = await sesion.supabase
    .from("profesionales_instituciones")
    .update({ activa: false })
    .eq("id", membresia.id);
  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "membresia_retirada",
    "profesionales_instituciones",
    membresia.profesional_id,
    {
      profesional_id: membresia.profesional_id,
      institucion_id: membresia.institucion_id,
    },
  );
  revalidarAdmin();
  return { ok: true, mensaje: "Membresía retirada." };
}
