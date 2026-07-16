"use server";

/**
 * Server Actions de la ficha del paciente (WP-06): medicación y reglas.
 *
 * Cada acción: valida con Zod → comprueba sesión de profesional/admin (Next 16:
 * la autorización va DENTRO de la acción) → escribe con el cliente de SERVIDOR
 * (la RLS de WP-01 confirma que gestiona a ESE paciente) → registra en
 * `eventos_auditoria` → revalida la ficha. Nunca usa service-role.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionPanel, registrarAuditoria } from "@/lib/panel/sesion-panel";
import { construirReglaDesdePlantilla } from "@/lib/panel/reglas-plantillas";
import type { Json } from "@/types/db";
import type { ResultadoAccion } from "@/lib/panel/tipos";

const FALLO_SESION = "No tienes permiso para esta acción.";
const FALLO_ESCRITURA = "No se pudo guardar el cambio. Inténtalo de nuevo.";

// --- Medicación --------------------------------------------------------------

const esquemaAltaPauta = z
  .object({
    pacienteId: z.string().uuid(),
    farmaco: z.string().trim().min(1).max(120),
    dosis: z.string().trim().max(120).optional(),
    momentos: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
    critica: z.boolean(),
  })
  .strict();

export async function altaPauta(entrada: unknown): Promise<ResultadoAccion> {
  const analizado = esquemaAltaPauta.safeParse(entrada);
  if (!analizado.success) return { ok: false, error: "Datos de la pauta no válidos." };
  const p = analizado.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { data, error } = await sesion.supabase
    .from("pautas_medicacion")
    .insert({
      paciente_id: p.pacienteId,
      farmaco: p.farmaco,
      dosis: p.dosis && p.dosis.length > 0 ? p.dosis : null,
      momentos: p.momentos,
      critica: p.critica,
      activa: true,
      creada_por: sesion.userId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "pauta_alta",
    "pautas_medicacion",
    data.id,
    {
      paciente_id: p.pacienteId,
      farmaco: p.farmaco,
      dosis: p.dosis ?? null,
      momentos: p.momentos,
      critica: p.critica,
    },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}

const esquemaEditarPauta = z
  .object({
    pacienteId: z.string().uuid(),
    pautaId: z.string().uuid(),
    farmaco: z.string().trim().min(1).max(120),
    dosis: z.string().trim().max(120).optional(),
    momentos: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
    critica: z.boolean(),
  })
  .strict();

export async function editarPauta(entrada: unknown): Promise<ResultadoAccion> {
  const analizado = esquemaEditarPauta.safeParse(entrada);
  if (!analizado.success) return { ok: false, error: "Datos de la pauta no válidos." };
  const p = analizado.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("pautas_medicacion")
    .update({
      farmaco: p.farmaco,
      dosis: p.dosis && p.dosis.length > 0 ? p.dosis : null,
      momentos: p.momentos,
      critica: p.critica,
    })
    .eq("id", p.pautaId)
    .eq("paciente_id", p.pacienteId);

  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "pauta_edicion",
    "pautas_medicacion",
    p.pautaId,
    { paciente_id: p.pacienteId, farmaco: p.farmaco, dosis: p.dosis ?? null, momentos: p.momentos, critica: p.critica },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}

const esquemaCambioActiva = z
  .object({
    pacienteId: z.string().uuid(),
    pautaId: z.string().uuid(),
    activa: z.boolean(),
  })
  .strict();

export async function cambiarEstadoPauta(entrada: unknown): Promise<ResultadoAccion> {
  const analizado = esquemaCambioActiva.safeParse(entrada);
  if (!analizado.success) return { ok: false, error: "Datos no válidos." };
  const p = analizado.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("pautas_medicacion")
    .update({ activa: p.activa })
    .eq("id", p.pautaId)
    .eq("paciente_id", p.pacienteId);

  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    p.activa ? "pauta_reactivada" : "pauta_desactivada",
    "pautas_medicacion",
    p.pautaId,
    { paciente_id: p.pacienteId, activa: p.activa },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}

// --- Reglas (desde plantillas amigables → JSONB de WP-04) --------------------

const esquemaCrearRegla = z
  .object({
    pacienteId: z.string().uuid(),
    plantilla: z.enum(["dolor_alto", "omision_critico", "animo_bajo"]),
    nivel: z.enum(["vigilancia", "contactar", "urgencia"]),
    umbral: z.number().int().min(0).max(10).optional(),
    dias: z.number().int().min(1).max(14).optional(),
  })
  .strict();

export async function crearReglaPaciente(entrada: unknown): Promise<ResultadoAccion> {
  const analizado = esquemaCrearRegla.safeParse(entrada);
  if (!analizado.success) return { ok: false, error: "Datos de la regla no válidos." };
  const p = analizado.data;

  const generada = construirReglaDesdePlantilla({
    plantilla: p.plantilla,
    nivel: p.nivel,
    umbral: p.umbral,
    dias: p.dias,
  });
  if (!generada.ok) return { ok: false, error: generada.error };

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { data, error } = await sesion.supabase
    .from("reglas_escalado")
    .insert({
      paciente_id: p.pacienteId,
      vertical: null,
      nombre: generada.regla.nombre,
      descripcion: generada.regla.descripcion,
      condicion: generada.regla.condicion as Json,
      nivel: generada.regla.nivel,
      activa: true,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "regla_alta",
    "reglas_escalado",
    data.id,
    {
      paciente_id: p.pacienteId,
      plantilla: p.plantilla,
      nivel: generada.regla.nivel,
      condicion: generada.regla.condicion as Json,
    },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}

const esquemaEstadoRegla = z
  .object({
    pacienteId: z.string().uuid(),
    reglaId: z.string().uuid(),
    activa: z.boolean(),
  })
  .strict();

export async function cambiarEstadoRegla(entrada: unknown): Promise<ResultadoAccion> {
  const analizado = esquemaEstadoRegla.safeParse(entrada);
  if (!analizado.success) return { ok: false, error: "Datos no válidos." };
  const p = analizado.data;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  // Sólo reglas propias del paciente (las globales las gestiona el admin; la RLS
  // además impide tocar reglas con paciente_id null).
  const { error } = await sesion.supabase
    .from("reglas_escalado")
    .update({ activa: p.activa })
    .eq("id", p.reglaId)
    .eq("paciente_id", p.pacienteId);

  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    p.activa ? "regla_activada" : "regla_desactivada",
    "reglas_escalado",
    p.reglaId,
    { paciente_id: p.pacienteId, activa: p.activa },
  );

  revalidatePath(`/pacientes/${p.pacienteId}`);
  return { ok: true };
}
