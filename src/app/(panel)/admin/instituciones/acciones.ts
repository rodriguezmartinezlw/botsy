"use server";

/**
 * Server Actions del catálogo de instituciones y países (WP-23 §2) — SOLO admin.
 *
 * Cada acción: valida con Zod estricto → exige sesión ADMIN (`obtenerSesionAdmin`;
 * un profesional obtiene error) → escribe con el cliente de SERVIDOR (la RLS de
 * 0016 concede la escritura sólo a `es_admin()`; NO se usa service-role) → audita
 * en `eventos_auditoria` → revalida. No se relaja ninguna política de RLS.
 */

import { revalidatePath } from "next/cache";
import { obtenerSesionAdmin } from "@/lib/admin/sesion-admin";
import { registrarAuditoria } from "@/lib/panel/sesion-panel";
import {
  esquemaCrearInstitucion,
  esquemaEditarInstitucion,
  esquemaEstadoInstitucion,
  esquemaCrearPais,
} from "@/lib/admin/esquemas";
import type { AccionAdmin } from "@/lib/admin/tipos";

const FALLO_SESION = "No tienes permiso para esta acción.";
const FALLO_ESCRITURA = "No se pudo guardar. Inténtalo de nuevo.";

function revalidarAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/instituciones");
}

export async function crearInstitucion(entrada: unknown): Promise<AccionAdmin> {
  const a = esquemaCrearInstitucion.safeParse(entrada);
  if (!a.success) {
    return { ok: false, error: a.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { data: creada, error } = await sesion.supabase
    .from("instituciones")
    .insert({
      nombre: a.data.nombre,
      tipo: a.data.tipo,
      pais_codigo: a.data.paisCodigo,
    })
    .select("id")
    .maybeSingle();
  if (error || !creada) {
    // Causa habitual: el país no existe en el catálogo (FK).
    return {
      ok: false,
      error:
        "No se pudo crear la institución. Comprueba que el país existe en el catálogo.",
    };
  }

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "institucion_creada",
    "instituciones",
    creada.id,
    { nombre: a.data.nombre, tipo: a.data.tipo, pais_codigo: a.data.paisCodigo },
  );
  revalidarAdmin();
  return { ok: true, mensaje: "Institución creada." };
}

export async function editarInstitucion(entrada: unknown): Promise<AccionAdmin> {
  const a = esquemaEditarInstitucion.safeParse(entrada);
  if (!a.success) {
    return { ok: false, error: a.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("instituciones")
    .update({
      nombre: a.data.nombre,
      tipo: a.data.tipo,
      pais_codigo: a.data.paisCodigo,
    })
    .eq("id", a.data.id);
  if (error) {
    return {
      ok: false,
      error:
        "No se pudo guardar. Comprueba que el país existe en el catálogo.",
    };
  }

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "institucion_editada",
    "instituciones",
    a.data.id,
    { nombre: a.data.nombre, tipo: a.data.tipo, pais_codigo: a.data.paisCodigo },
  );
  revalidarAdmin();
  return { ok: true, mensaje: "Cambios guardados." };
}

export async function cambiarEstadoInstitucion(
  entrada: unknown,
): Promise<AccionAdmin> {
  const a = esquemaEstadoInstitucion.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };

  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("instituciones")
    .update({ activa: a.data.activa })
    .eq("id", a.data.id);
  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    a.data.activa ? "institucion_activada" : "institucion_desactivada",
    "instituciones",
    a.data.id,
    { activa: a.data.activa },
  );
  revalidarAdmin();
  return {
    ok: true,
    mensaje: a.data.activa ? "Institución activada." : "Institución desactivada.",
  };
}

export async function crearPais(entrada: unknown): Promise<AccionAdmin> {
  const a = esquemaCrearPais.safeParse(entrada);
  if (!a.success) {
    return { ok: false, error: a.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const sesion = await obtenerSesionAdmin();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("paises")
    .insert({ codigo: a.data.codigo, nombre: a.data.nombre });
  if (error) {
    return {
      ok: false,
      error: "No se pudo añadir el país. ¿Ya existe ese código?",
    };
  }

  // `paises` usa el código (texto) como PK; `eventos_auditoria.entidad_id` es
  // uuid, así que el código va en el detalle y entidad_id queda nulo.
  const { error: errAudit } = await sesion.supabase
    .from("eventos_auditoria")
    .insert({
      actor_id: sesion.userId,
      accion: "pais_creado",
      entidad: "paises",
      entidad_id: null,
      detalle: { codigo: a.data.codigo, nombre: a.data.nombre },
    });
  if (errAudit) console.error("No se pudo registrar el evento de auditoría: pais_creado");

  revalidarAdmin();
  return { ok: true, mensaje: "País añadido al catálogo." };
}
