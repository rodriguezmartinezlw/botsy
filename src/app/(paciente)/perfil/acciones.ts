"use server";

/**
 * Edición de "Mis datos" del paciente (WP-20 §C) — Server Action.
 *
 * El paciente edita SOLO sus campos NO clínicos: nombre, teléfono, hora del
 * recordatorio de check-in y zona horaria. Valida con Zod (esquema `.strict()`,
 * que rechaza cualquier campo clínico) → sesión propia → UPDATE de su propia fila
 * en `perfiles` (nombre, teléfono, zona) y `pacientes` (hora_checkin) vía el
 * cliente de SERVIDOR (RLS `..._update_propio`; nunca service-role) → audita →
 * revalida. Vertical, condiciones, programa y pautas NO se tocan aquí (son del
 * profesional; regla clínica de CLAUDE.md).
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/panel/sesion-panel";
import {
  esquemaMisDatos,
  horaAColumna,
} from "@/lib/perfil/datos-perfil";
import type { BaseDatos } from "@/types/db";
import type { ResultadoAccion } from "@/lib/panel/tipos";

export async function actualizarMisDatos(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const analizado = esquemaMisDatos.safeParse(entrada);
  if (!analizado.success) {
    const primero = analizado.error.issues[0]?.message;
    return { ok: false, error: primero ?? "Revisa los datos e inténtalo de nuevo." };
  }
  const { nombre, telefono, horaCheckin, zonaHoraria } = analizado.data;

  let supabase: SupabaseClient<BaseDatos>;
  try {
    supabase = await crearClienteServidor();
  } catch {
    return { ok: false, error: "No se pudo conectar. Inténtalo de nuevo." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };

  const telefonoLimpio = telefono && telefono.length > 0 ? telefono : null;

  const { error: errPerfil } = await supabase
    .from("perfiles")
    .update({ nombre, telefono: telefonoLimpio, zona_horaria: zonaHoraria })
    .eq("id", user.id);
  if (errPerfil) {
    return { ok: false, error: "No se pudieron guardar tus datos. Inténtalo de nuevo." };
  }

  const { error: errPaciente } = await supabase
    .from("pacientes")
    .update({ hora_checkin: horaAColumna(horaCheckin) })
    .eq("id", user.id);
  if (errPaciente) {
    return { ok: false, error: "No se pudo guardar la hora del recordatorio." };
  }

  await registrarAuditoria(
    supabase,
    user.id,
    "perfil_paciente_actualizado",
    "perfiles",
    user.id,
    { nombre, telefono: telefonoLimpio, hora_checkin: horaCheckin, zona_horaria: zonaHoraria },
  );

  revalidatePath("/perfil");
  return { ok: true };
}
