/**
 * Orquestador de una tool-call del canal de VOZ (WP-03).
 *
 * El modelo Realtime, durante la conversación hablada, emite tool-calls por el
 * data channel; el cliente las reenvía a `POST /api/voz/tool`, que delega aquí.
 * `manejarToolVoz` reutiliza EXACTAMENTE la misma maquinaria que el modo texto:
 *  - verifica la PERTENENCIA del check-in al usuario de la sesión,
 *  - ejecuta la tool con `ejecutarHerramienta` (mismos schemas Zod de WP-02,
 *    misma persistencia por `RepositorioCheckin`, misma clasificación de señal),
 *  - y, si el turno eleva el riesgo, MATERIALIZA el escalado de inmediato (igual
 *    que `/api/checkin/mensaje`): no espera al cierre del check-in.
 *
 * Todo el IO entra por el puerto `PuertoToolVoz`, de modo que la lógica es
 * testeable con dobles en memoria (sin Supabase ni red). El Route Handler provee
 * la implementación real (cliente de servidor + repositorio de Supabase +
 * motor de escalado de WP-04).
 */

import type { EstadoCheckin, NivelRiesgo, TipoCheckin } from "@/types/db";
import type { ReglaSenal } from "@/lib/escalado/senales";
import type { LlamadaHerramienta } from "./openai";
import type { RepositorioCheckin } from "./loop";
import { ejecutarHerramienta } from "./loop";
import type { DominioCheckin } from "./conversacion";

/** Check-in cargado (ya verificado como propio del usuario de la sesión). */
export type CheckinVoz = {
  id: string;
  pacienteId: string;
  estado: EstadoCheckin;
  riesgo: NivelRiesgo | null;
  fecha: string;
  dominiosCubiertos: DominioCheckin[];
  vertical: string | null;
  /** ¿Se administra hoy el instrumento? (WP-16). Gating de `registrar_instrumento`. */
  instrumentoActivo: boolean;
  /** 'checkin' o 'consulta' (WP-24). Ausente = 'checkin' (compatibilidad). */
  tipo?: TipoCheckin;
};

/** Repositorio de turno + lectura del estado derivado (idéntico al modo texto). */
export type RepositorioTurnoVoz = {
  repositorio: RepositorioCheckin;
  obtenerRiesgo: () => NivelRiesgo | null;
  obtenerDominios: () => DominioCheckin[];
};

/** Puerto de IO del manejo de una tool de voz (Supabase en prod, fake en tests). */
export interface PuertoToolVoz {
  /** Carga el check-in SOLO si pertenece a `userId`; `null` si no existe o es ajeno. */
  cargarCheckinPropio(
    checkinId: string,
    userId: string,
  ): Promise<CheckinVoz | null>;
  /** Reglas `senal` aplicables (para clasificar la señal en vivo). */
  cargarReglasSenal(
    pacienteId: string,
    vertical: string | null,
  ): Promise<readonly ReglaSenal[]>;
  /** Repositorio de persistencia del turno (mismo que el modo texto). */
  crearRepositorio(checkin: CheckinVoz): RepositorioTurnoVoz;
  /**
   * Materializa el escalado inmediato (crea la alerta ya) de forma idempotente.
   * Best-effort: la implementación no debe lanzar.
   */
  materializarEscalado(checkinId: string): Promise<void>;
}

export type SalidaToolVoz =
  | {
      ok: true;
      /** Texto que el cliente devuelve al modelo por el data channel. */
      output: string;
      riesgo: NivelRiesgo | null;
      dominiosCubiertos: DominioCheckin[];
      finalizar: boolean;
      resumen: string | null;
    }
  | { ok: false; estado: number; error: string };

export type EntradaToolVoz = {
  userId: string;
  checkinId: string;
  llamada: LlamadaHerramienta;
};

/**
 * Maneja una tool-call del canal de voz. Devuelve el resultado a reenviar al
 * modelo o un error con código HTTP para el Route Handler.
 */
export async function manejarToolVoz(
  entrada: EntradaToolVoz,
  puerto: PuertoToolVoz,
): Promise<SalidaToolVoz> {
  const checkin = await puerto.cargarCheckinPropio(
    entrada.checkinId,
    entrada.userId,
  );
  // Pertenencia: si no es del usuario de la sesión, no se toca nada.
  if (!checkin) return { ok: false, estado: 404, error: "Check-in no encontrado." };
  if (checkin.estado !== "en_curso") {
    return {
      ok: false,
      estado: 409,
      error:
        checkin.tipo === "consulta"
          ? "Esta conversación ya está cerrada."
          : "Este check-in ya está cerrado.",
    };
  }

  const reglasSenal = await puerto.cargarReglasSenal(
    checkin.pacienteId,
    checkin.vertical,
  );
  const { repositorio, obtenerRiesgo, obtenerDominios } =
    puerto.crearRepositorio(checkin);

  // Ejecuta la tool con la MISMA función que el loop de texto: valida con Zod,
  // persiste si es válida, o devuelve el error para que el modelo corrija.
  const dominios = new Set<DominioCheckin>(checkin.dominiosCubiertos);
  const resultado = await ejecutarHerramienta(entrada.llamada, repositorio, dominios, {
    vertical: checkin.vertical,
    dominiosYaCubiertos: checkin.dominiosCubiertos,
    reglasSenal,
    instrumentoActivo: checkin.instrumentoActivo,
  });

  const riesgo = obtenerRiesgo();

  // Materialización INMEDIATA del escalado (RF-ES-03/04): si el turno subió el
  // riesgo, el profesional debe enterarse ya, sin esperar al cierre. Misma
  // maquinaria idempotente que /api/checkin/mensaje.
  if (riesgo === "contactar" || riesgo === "urgencia") {
    await puerto.materializarEscalado(checkin.id);
  }

  return {
    ok: true,
    output: resultado.mensaje,
    riesgo,
    dominiosCubiertos: obtenerDominios(),
    finalizar: resultado.finalizar === true,
    resumen: resultado.resumen ?? null,
  };
}
