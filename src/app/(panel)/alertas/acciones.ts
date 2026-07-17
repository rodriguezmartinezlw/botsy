"use server";

/**
 * Server Actions de la bandeja de alertas (WP-06 + WP-11 v2 §B).
 *
 * REGLA DE ORO 3: `resolver` y `descartar` EXIGEN una disposición estructurada
 * completa (decisión codificada + motivo del catálogo + días de seguimiento).
 * Sin ella, la mutación se rechaza — resolver/descartar "a pelo" es imposible
 * por diseño. Cada acción: valida con Zod estricto → sesión de profesional/admin
 * → comprueba el motivo contra `catalogo_motivos` → INSERTA la `disposicion` →
 * actualiza el estado de la alerta → audita. Cliente de SERVIDOR (RLS), nunca
 * service-role.
 *
 * `marcarVista` (sin disposición) sigue permitida: no CIERRA la alerta.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionPanel, registrarAuditoria } from "@/lib/panel/sesion-panel";
import {
  validarDisposicion,
  esquemaRegistrarDesenlace,
  ETIQUETA_DECISION,
} from "@/lib/disposiciones/nucleo";
import type { AmbitoMotivo, EstadoAlerta, Json } from "@/types/db";
import type { ResultadoAccion } from "@/lib/panel/tipos";

const FALLO_SESION = "No tienes permiso para esta acción.";
const FALLO_ESCRITURA = "No se pudo actualizar la alerta. Inténtalo de nuevo.";

// --- Marcar vista (no cierra la alerta; sin disposición) ---------------------

const esquemaMarcar = z.object({ alertaId: z.string().uuid() }).strict();

export async function marcarVista(entrada: unknown): Promise<ResultadoAccion> {
  const a = esquemaMarcar.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos no válidos." };

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("alertas")
    .update({
      estado: "vista",
      gestionada_por: sesion.userId,
      gestionada_en: new Date().toISOString(),
    })
    .eq("id", a.data.alertaId);
  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "alerta_vista",
    "alertas",
    a.data.alertaId,
    { estado: "vista" },
  );
  revalidatePath("/alertas");
  return { ok: true };
}

// --- Cierre con disposición estructurada (resolver / descartar) --------------

/**
 * Cierra una alerta (`resuelta` o `descartada`) creando su `disposicion`. Exige
 * que la disposición sea COMPLETA y que el motivo pertenezca al ámbito esperado
 * del catálogo. Idempotencia: `disposiciones.alerta_id` es UNIQUE, así que una
 * alerta no puede cerrarse dos veces.
 */
async function cerrarConDisposicion(
  entrada: unknown,
  nuevoEstado: Extract<EstadoAlerta, "resuelta" | "descartada">,
  ambitoEsperado: AmbitoMotivo,
): Promise<ResultadoAccion> {
  const validacion = validarDisposicion(entrada);
  if (!validacion.ok) return { ok: false, error: validacion.error };
  const d = validacion.datos;

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  // El motivo debe existir, estar activo y ser del ámbito correcto.
  const { data: motivo } = await sesion.supabase
    .from("catalogo_motivos")
    .select("id, etiqueta, ambito, activo")
    .eq("id", d.motivoCodigo)
    .maybeSingle();
  if (!motivo || motivo.activo === false || motivo.ambito !== ambitoEsperado) {
    return { ok: false, error: "El motivo seleccionado no es válido." };
  }

  // Inserta la disposición (fuente de verdad del cierre). alerta_id UNIQUE ⇒ si
  // ya estaba cerrada, la inserción falla y no se duplica.
  const { data: dispuesta, error: errDisp } = await sesion.supabase
    .from("disposiciones")
    .insert({
      alerta_id: d.alertaId,
      decision: d.decision,
      motivo_codigo: d.motivoCodigo,
      motivo_texto: d.motivoTexto ?? null,
      dias_seguimiento: d.diasSeguimiento,
      creada_por: sesion.userId,
    })
    .select("id")
    .maybeSingle();
  if (errDisp || !dispuesta) {
    return {
      ok: false,
      error:
        "Esta alerta ya tiene una disposición registrada o no se pudo guardar.",
    };
  }

  // Actualiza el estado de la alerta. `motivo_descarte` conserva el texto legible
  // para la vista (compatibilidad con WP-06).
  const motivoLegible = d.motivoTexto ?? motivo.etiqueta;
  const { error: errAlerta } = await sesion.supabase
    .from("alertas")
    .update({
      estado: nuevoEstado,
      motivo_descarte: nuevoEstado === "descartada" ? motivoLegible : null,
      gestionada_por: sesion.userId,
      gestionada_en: new Date().toISOString(),
    })
    .eq("id", d.alertaId);
  if (errAlerta) return { ok: false, error: FALLO_ESCRITURA };

  const detalle: Json = {
    estado: nuevoEstado,
    disposicion_id: dispuesta.id,
    decision: d.decision,
    decision_etiqueta: ETIQUETA_DECISION[d.decision],
    motivo_codigo: d.motivoCodigo,
    dias_seguimiento: d.diasSeguimiento,
    ...(d.motivoTexto ? { motivo_texto: d.motivoTexto } : {}),
  };
  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    `alerta_${nuevoEstado}`,
    "alertas",
    d.alertaId,
    detalle,
  );

  revalidatePath("/alertas");
  revalidatePath("/desenlaces");
  return { ok: true };
}

export async function resolverAlerta(entrada: unknown): Promise<ResultadoAccion> {
  return cerrarConDisposicion(entrada, "resuelta", "disposicion");
}

export async function descartarAlerta(entrada: unknown): Promise<ResultadoAccion> {
  return cerrarConDisposicion(entrada, "descartada", "descarte");
}

// --- Registro del desenlace de una disposición (WP-11 v2 §B.3) ---------------

export async function registrarDesenlace(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const a = esquemaRegistrarDesenlace.safeParse(entrada);
  if (!a.success) return { ok: false, error: "Datos del desenlace no válidos." };

  const sesion = await obtenerSesionPanel();
  if (!sesion) return { ok: false, error: FALLO_SESION };

  const { error } = await sesion.supabase
    .from("disposiciones")
    .update({
      desenlace: a.data.desenlace,
      desenlace_nota: a.data.nota ?? null,
      desenlace_registrado_en: new Date().toISOString(),
    })
    .eq("id", a.data.disposicionId);
  if (error) return { ok: false, error: FALLO_ESCRITURA };

  await registrarAuditoria(
    sesion.supabase,
    sesion.userId,
    "desenlace_registrado",
    "disposiciones",
    a.data.disposicionId,
    { desenlace: a.data.desenlace, ...(a.data.nota ? { nota: a.data.nota } : {}) },
  );

  revalidatePath("/desenlaces");
  revalidatePath("/alertas");
  return { ok: true };
}
