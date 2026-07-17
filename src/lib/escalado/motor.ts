/**
 * Motor de escalado DETERMINISTA por reglas (WP-04, decisión D8: sin ML).
 *
 * Dos capas, con separación estricta carga/evaluación:
 *  - `evaluarReglas(datos, reglas)` — PURO y sin IO: evalúa el JSONB de las
 *    condiciones (`observacion`, `senal`, `combinacion` con `todas`/`alguna`,
 *    `adherencia_critica`, `tendencia`) sobre unos datos ya cargados y devuelve
 *    el nivel más alto disparado y las reglas implicadas con su evidencia.
 *    Es la parte testeable (ver `motor.test.ts`).
 *  - `evaluarCheckin(checkinId)` — carga observaciones del check-in + contexto
 *    histórico (tendencias, adherencia, señales) y las reglas activas aplicables
 *    (globales + del paciente + de su vertical) usando el cliente de servicio
 *    (el paciente, por RLS, no puede leer `reglas_escalado`), y delega en
 *    `evaluarReglas`.
 *
 * El formato completo de `condicion` está documentado en `README.md` y debe
 * coincidir con `supabase/migrations/0003_reglas_semilla.sql` (coincide: no se
 * requiere migración de reformateo).
 */

import { differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos, Json, NivelRiesgo } from "@/types/db";
import {
  nivelMaximoRiesgo,
  normalizarCodigoSenal,
  type NivelSenal,
} from "./senales";

type ClienteBD = SupabaseClient<BaseDatos>;

// =====================================================================
// Formato de `condicion` (JSONB) — tipos + validación Zod
// =====================================================================

export type CondObservacion = {
  tipo: "observacion";
  dominio: string;
  codigo?: string;
  valor_num_gte?: number;
  valor_num_lte?: number;
};
export type CondSenal = { tipo: "senal"; codigo: string };
export type CondAdherencia = {
  tipo: "adherencia_critica";
  dias_consecutivos: number;
};
export type CondTendencia = {
  tipo: "tendencia";
  dominio: string;
  valor_num_gte?: number;
  valor_num_lte?: number;
  dias_consecutivos: number;
};
export type CondCombinacion = {
  tipo: "combinacion";
  todas?: Condicion[];
  alguna?: Condicion[];
};
/**
 * Condición sobre un INSTRUMENTO administrado (WP-16). Casa cuando existe una
 * respuesta del instrumento indicado en el check-in con puntuación dentro del
 * rango. El umbral (`puntuacion_gte`) es CONFIGURABLE y [PENDIENTE CLÍNICO]: vive
 * en la regla de programa, no en el motor.
 */
export type CondInstrumento = {
  tipo: "instrumento";
  instrumento: string;
  puntuacion_gte?: number;
  puntuacion_lte?: number;
};
export type Condicion =
  | CondObservacion
  | CondSenal
  | CondAdherencia
  | CondTendencia
  | CondCombinacion
  | CondInstrumento;

const esquemaCondObservacion = z
  .object({
    tipo: z.literal("observacion"),
    dominio: z.string().min(1),
    codigo: z.string().min(1).optional(),
    valor_num_gte: z.number().optional(),
    valor_num_lte: z.number().optional(),
  })
  .strict();

const esquemaCondSenal = z
  .object({ tipo: z.literal("senal"), codigo: z.string().min(1) })
  .strict();

const esquemaCondAdherencia = z
  .object({
    tipo: z.literal("adherencia_critica"),
    dias_consecutivos: z.number().int().positive(),
  })
  .strict();

const esquemaCondTendencia = z
  .object({
    tipo: z.literal("tendencia"),
    dominio: z.string().min(1),
    valor_num_gte: z.number().optional(),
    valor_num_lte: z.number().optional(),
    dias_consecutivos: z.number().int().positive(),
  })
  .strict();

const esquemaCondInstrumento = z
  .object({
    tipo: z.literal("instrumento"),
    instrumento: z.string().min(1),
    puntuacion_gte: z.number().optional(),
    puntuacion_lte: z.number().optional(),
  })
  .strict();

/** Esquema recursivo: `combinacion` anida condiciones. */
export const esquemaCondicion: z.ZodType<Condicion> = z.lazy(
  (): z.ZodType<Condicion> =>
    z.union([
      esquemaCondObservacion,
      esquemaCondSenal,
      esquemaCondAdherencia,
      esquemaCondTendencia,
      esquemaCondInstrumento,
      esquemaCondCombinacion,
    ]) as unknown as z.ZodType<Condicion>,
);

const esquemaCondCombinacion = z
  .object({
    tipo: z.literal("combinacion"),
    todas: z.array(esquemaCondicion).optional(),
    alguna: z.array(esquemaCondicion).optional(),
  })
  .strict();

/** Valida y normaliza una `condicion` JSONB; `null` si es inválida. */
export function parsearCondicion(valor: Json | null | undefined): Condicion | null {
  if (valor === null || valor === undefined) return null;
  const r = esquemaCondicion.safeParse(valor);
  return r.success ? r.data : null;
}

// =====================================================================
// Datos de evaluación (lo que consume `evaluarReglas`) y resultado
// =====================================================================

export type ObservacionEval = {
  dominio: string;
  codigo: string;
  valorNum: number | null;
};

export type PuntoHistorico = {
  /** Día del check-in (YYYY-MM-DD). */
  fecha: string;
  dominio: string;
  valorNum: number | null;
};

export type DiaAdherencia = {
  fecha: string;
  /** ¿Se omitió alguna toma de un fármaco crítico ese día? */
  omitida: boolean;
};

/** Respuesta de un instrumento en el check-in evaluado (WP-16). */
export type InstrumentoEval = {
  instrumento: string;
  puntuacion: number;
};

export type DatosEvaluacion = {
  /** Vertical del paciente; filtra las reglas acotadas por vertical. */
  vertical: string | null;
  /** Observaciones del check-in evaluado (para `observacion` y `combinacion`). */
  observaciones: ObservacionEval[];
  /** Códigos de señal detectados en vivo en este check-in (para `senal`). */
  senales: string[];
  /** Serie histórica por día y dominio, incluida la de hoy (para `tendencia`). */
  historico: PuntoHistorico[];
  /** Adherencia a fármacos críticos por día (para `adherencia_critica`). */
  adherenciaCritica: DiaAdherencia[];
  /**
   * Respuestas de instrumentos del check-in (para `instrumento`, WP-16).
   * Opcional: los datos construidos antes de WP-16 siguen siendo válidos.
   */
  instrumentos?: InstrumentoEval[];
};

export type ReglaEvaluable = {
  id: string | null;
  nombre: string;
  nivel: NivelSenal;
  /** `null` = aplica a cualquier vertical. */
  vertical: string | null;
  condicion: Condicion;
};

export type EvidenciaRegla = {
  observaciones: ObservacionEval[];
  senales: string[];
  detalle: string[];
};

export type ReglaDisparada = {
  reglaId: string | null;
  nombre: string;
  nivel: NivelSenal;
  evidencia: EvidenciaRegla;
};

export type ResultadoEvaluacion = {
  nivel: NivelRiesgo;
  reglasDisparadas: ReglaDisparada[];
};

// =====================================================================
// Evaluación PURA de condiciones
// =====================================================================

type EvaluacionCond = {
  match: boolean;
  observaciones: ObservacionEval[];
  senales: string[];
  detalle: string[];
};

const SIN_MATCH: EvaluacionCond = {
  match: false,
  observaciones: [],
  senales: [],
  detalle: [],
};

function diferenciaDias(fechaA: string, fechaB: string): number {
  return differenceInCalendarDays(parseISO(fechaB), parseISO(fechaA));
}

/** Longitud de la mayor racha de días de calendario CONSECUTIVOS con `ok`. */
function maxDiasConsecutivos(dias: { fecha: string; ok: boolean }[]): number {
  const orden = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let mejor = 0;
  let actual = 0;
  let prev: string | null = null;
  for (const d of orden) {
    if (d.ok) {
      actual = prev !== null && diferenciaDias(prev, d.fecha) === 1 ? actual + 1 : 1;
      mejor = Math.max(mejor, actual);
    } else {
      actual = 0;
    }
    prev = d.fecha;
  }
  return mejor;
}

function evalObservacion(
  datos: DatosEvaluacion,
  cond: CondObservacion,
): EvaluacionCond {
  const matches = datos.observaciones.filter((o) => {
    if (o.dominio !== cond.dominio) return false;
    if (cond.codigo !== undefined && o.codigo !== cond.codigo) return false;
    if (
      cond.valor_num_gte !== undefined &&
      !(o.valorNum !== null && o.valorNum >= cond.valor_num_gte)
    ) {
      return false;
    }
    if (
      cond.valor_num_lte !== undefined &&
      !(o.valorNum !== null && o.valorNum <= cond.valor_num_lte)
    ) {
      return false;
    }
    return true;
  });
  if (matches.length === 0) return SIN_MATCH;
  const rango = [
    cond.valor_num_gte !== undefined ? `>= ${cond.valor_num_gte}` : null,
    cond.valor_num_lte !== undefined ? `<= ${cond.valor_num_lte}` : null,
  ]
    .filter(Boolean)
    .join(" y ");
  const cod = cond.codigo ? `/${cond.codigo}` : "";
  return {
    match: true,
    observaciones: matches,
    senales: [],
    detalle: [`Observación ${cond.dominio}${cod}${rango ? ` (${rango})` : ""}.`],
  };
}

function evalSenal(datos: DatosEvaluacion, cond: CondSenal): EvaluacionCond {
  const objetivo = normalizarCodigoSenal(cond.codigo);
  const match = datos.senales.some(
    (s) => normalizarCodigoSenal(s) === objetivo,
  );
  if (!match) return SIN_MATCH;
  return {
    match: true,
    observaciones: [],
    senales: [cond.codigo],
    detalle: [`Señal detectada: ${cond.codigo}.`],
  };
}

function evalAdherencia(
  datos: DatosEvaluacion,
  cond: CondAdherencia,
): EvaluacionCond {
  const racha = maxDiasConsecutivos(
    datos.adherenciaCritica.map((d) => ({ fecha: d.fecha, ok: d.omitida })),
  );
  if (racha < cond.dias_consecutivos) return SIN_MATCH;
  return {
    match: true,
    observaciones: [],
    senales: [],
    detalle: [`Fármaco crítico omitido ${racha} día(s) consecutivo(s).`],
  };
}

function diaCumpleTendencia(valores: number[], cond: CondTendencia): boolean {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const okLte = cond.valor_num_lte === undefined || min <= cond.valor_num_lte;
  const okGte = cond.valor_num_gte === undefined || max >= cond.valor_num_gte;
  return okLte && okGte;
}

function evalTendencia(
  datos: DatosEvaluacion,
  cond: CondTendencia,
): EvaluacionCond {
  const porFecha = new Map<string, number[]>();
  for (const p of datos.historico) {
    if (p.dominio !== cond.dominio || p.valorNum === null) continue;
    const arr = porFecha.get(p.fecha) ?? [];
    arr.push(p.valorNum);
    porFecha.set(p.fecha, arr);
  }
  const dias = [...porFecha.entries()].map(([fecha, valores]) => ({
    fecha,
    ok: diaCumpleTendencia(valores, cond),
  }));
  const racha = maxDiasConsecutivos(dias);
  if (racha < cond.dias_consecutivos) return SIN_MATCH;
  const umbral = [
    cond.valor_num_lte !== undefined ? `<= ${cond.valor_num_lte}` : null,
    cond.valor_num_gte !== undefined ? `>= ${cond.valor_num_gte}` : null,
  ]
    .filter(Boolean)
    .join(" y ");
  return {
    match: true,
    observaciones: [],
    senales: [],
    detalle: [
      `Tendencia de ${cond.dominio} ${umbral} durante ${racha} día(s) consecutivo(s).`,
    ],
  };
}

function evalInstrumento(
  datos: DatosEvaluacion,
  cond: CondInstrumento,
): EvaluacionCond {
  const matches = (datos.instrumentos ?? []).filter((r) => {
    if (r.instrumento !== cond.instrumento) return false;
    if (cond.puntuacion_gte !== undefined && !(r.puntuacion >= cond.puntuacion_gte)) {
      return false;
    }
    if (cond.puntuacion_lte !== undefined && !(r.puntuacion <= cond.puntuacion_lte)) {
      return false;
    }
    return true;
  });
  if (matches.length === 0) return SIN_MATCH;
  const rango = [
    cond.puntuacion_gte !== undefined ? `>= ${cond.puntuacion_gte}` : null,
    cond.puntuacion_lte !== undefined ? `<= ${cond.puntuacion_lte}` : null,
  ]
    .filter(Boolean)
    .join(" y ");
  return {
    match: true,
    observaciones: [],
    senales: [],
    detalle: [
      `Instrumento ${cond.instrumento}${rango ? ` (puntuación ${rango})` : ""}.`,
    ],
  };
}

function evalCombinacion(
  datos: DatosEvaluacion,
  cond: CondCombinacion,
): EvaluacionCond {
  const tieneTodas = cond.todas !== undefined && cond.todas.length > 0;
  const tieneAlguna = cond.alguna !== undefined && cond.alguna.length > 0;
  if (!tieneTodas && !tieneAlguna) return SIN_MATCH;

  const subTodas = (cond.todas ?? []).map((c) => evaluarCondicion(datos, c));
  const subAlguna = (cond.alguna ?? []).map((c) => evaluarCondicion(datos, c));
  const okTodas = tieneTodas ? subTodas.every((s) => s.match) : true;
  const okAlguna = tieneAlguna ? subAlguna.some((s) => s.match) : true;
  const match = okTodas && okAlguna;
  if (!match) return SIN_MATCH;

  const fuentes = [...subTodas, ...subAlguna].filter((s) => s.match);
  return {
    match: true,
    observaciones: fuentes.flatMap((s) => s.observaciones),
    senales: fuentes.flatMap((s) => s.senales),
    detalle: fuentes.flatMap((s) => s.detalle),
  };
}

function evaluarCondicion(
  datos: DatosEvaluacion,
  cond: Condicion,
): EvaluacionCond {
  switch (cond.tipo) {
    case "observacion":
      return evalObservacion(datos, cond);
    case "senal":
      return evalSenal(datos, cond);
    case "adherencia_critica":
      return evalAdherencia(datos, cond);
    case "tendencia":
      return evalTendencia(datos, cond);
    case "instrumento":
      return evalInstrumento(datos, cond);
    case "combinacion":
      return evalCombinacion(datos, cond);
  }
}

/**
 * Evalúa TODAS las reglas dadas sobre `datos` y devuelve el nivel más alto
 * disparado (o `normal` si ninguna) junto con las reglas implicadas y su
 * evidencia. PURA: sin IO, totalmente determinista y testeable.
 */
export function evaluarReglas(
  datos: DatosEvaluacion,
  reglas: readonly ReglaEvaluable[],
): ResultadoEvaluacion {
  const disparadas: ReglaDisparada[] = [];
  for (const regla of reglas) {
    // Reglas acotadas a una vertical solo aplican a esa vertical.
    if (regla.vertical !== null && regla.vertical !== datos.vertical) continue;
    const ev = evaluarCondicion(datos, regla.condicion);
    if (ev.match) {
      disparadas.push({
        reglaId: regla.id,
        nombre: regla.nombre,
        nivel: regla.nivel,
        evidencia: {
          observaciones: ev.observaciones,
          senales: ev.senales,
          detalle: ev.detalle,
        },
      });
    }
  }
  const nivel = disparadas.reduce<NivelRiesgo>(
    (acc, d) => nivelMaximoRiesgo(acc, d.nivel) ?? acc,
    "normal",
  );
  return { nivel, reglasDisparadas: disparadas };
}

// =====================================================================
// Carga de datos + reglas (IO) y `evaluarCheckin`
// =====================================================================

export type EvaluacionCheckin = {
  checkinId: string;
  pacienteId: string;
  riesgoActual: NivelRiesgo | null;
  nivel: NivelRiesgo;
  reglasDisparadas: ReglaDisparada[];
  /** Últimos mensajes del check-in, para la evidencia de la alerta. */
  mensajesRelevantes: { rol: string; contenido: string }[];
  /**
   * Códigos de las señales de alarma detectadas en vivo en este check-in
   * (`senal_alarma` en la auditoría). Se usan para materializar la alerta de una
   * señal GENÉRICA (sin regla asociada) cuando el riesgo en vivo llegó a
   * `contactar`/`urgencia` pero ninguna regla la cubre (WP-08, punto b).
   */
  senalesDetectadas: string[];
};

const RESULTADO_VACIO = (checkinId: string): EvaluacionCheckin => ({
  checkinId,
  pacienteId: "",
  riesgoActual: null,
  nivel: "normal",
  reglasDisparadas: [],
  mensajesRelevantes: [],
  senalesDetectadas: [],
});

async function clienteMotor(inyectado?: ClienteBD): Promise<ClienteBD> {
  if (inyectado) return inyectado;
  const { crearClienteAdmin } = await import("@/lib/supabase/admin");
  return crearClienteAdmin();
}

function extraerCodigoSenal(detalle: Json | null): string | null {
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) {
    return null;
  }
  const evidencia = (detalle as Record<string, Json | undefined>).evidencia;
  if (!evidencia || typeof evidencia !== "object" || Array.isArray(evidencia)) {
    return null;
  }
  const tipo = (evidencia as Record<string, Json | undefined>).tipo;
  return typeof tipo === "string" && tipo.length > 0 ? tipo : null;
}

/** Carga las reglas activas aplicables (globales + del paciente + su vertical). */
export async function cargarReglasAplicables(
  supabase: ClienteBD,
  pacienteId: string,
  vertical: string | null,
): Promise<ReglaEvaluable[]> {
  const { data } = await supabase
    .from("reglas_escalado")
    .select("id, nombre, nivel, vertical, paciente_id, condicion")
    .eq("activa", true);

  const reglas: ReglaEvaluable[] = [];
  for (const fila of data ?? []) {
    // Aplicabilidad: global o de este paciente; y vertical libre o coincidente.
    if (fila.paciente_id !== null && fila.paciente_id !== pacienteId) continue;
    if (fila.vertical !== null && fila.vertical !== vertical) continue;
    const condicion = parsearCondicion(fila.condicion);
    if (condicion === null) continue; // regla malformada: se ignora, no se rompe.
    reglas.push({
      id: fila.id,
      nombre: fila.nombre,
      nivel: fila.nivel,
      vertical: fila.vertical,
      condicion,
    });
  }
  return reglas;
}

/** Solo las reglas de tipo `senal` (para la evaluación en vivo desde el loop). */
export async function cargarReglasSenal(
  pacienteId: string,
  vertical: string | null,
  opciones?: { supabase?: ClienteBD },
): Promise<{ codigo: string; nivel: NivelSenal; nombre: string }[]> {
  try {
    const supabase = await clienteMotor(opciones?.supabase);
    const reglas = await cargarReglasAplicables(supabase, pacienteId, vertical);
    return reglas
      .filter((r): r is ReglaEvaluable & { condicion: CondSenal } =>
        r.condicion.tipo === "senal",
      )
      .map((r) => ({ codigo: r.condicion.codigo, nivel: r.nivel, nombre: r.nombre }));
  } catch {
    // Sin acceso de servicio (env ausente) o error: sin reglas → conservador.
    return [];
  }
}

async function cargarDatosEvaluacion(
  supabase: ClienteBD,
  checkinId: string,
  pacienteId: string,
  fecha: string,
  vertical: string | null,
): Promise<DatosEvaluacion> {
  const desde = subDias(fecha, 30);

  const [
    { data: observaciones },
    { data: eventos },
    { data: checkinsRecientes },
    { data: pautasCriticas },
    { data: instrumentos },
  ] = await Promise.all([
    supabase
      .from("observaciones")
      .select("dominio, codigo, valor_num")
      .eq("checkin_id", checkinId),
    supabase
      .from("eventos_auditoria")
      .select("detalle")
      .eq("accion", "senal_alarma")
      .eq("entidad", "checkins")
      .eq("entidad_id", checkinId),
    supabase
      .from("checkins")
      .select("id, fecha")
      .eq("paciente_id", pacienteId)
      .gte("fecha", desde)
      .lte("fecha", fecha),
    supabase
      .from("pautas_medicacion")
      .select("id")
      .eq("paciente_id", pacienteId)
      .eq("critica", true)
      .eq("activa", true),
    // Instrumentos administrados en este check-in (WP-16). Best-effort: si la
    // consulta falla, `instrumentos` queda vacío y las reglas de instrumento no
    // disparan (nunca rompe la evaluación del resto).
    supabase
      .from("instrumentos_respuestas")
      .select("instrumento, puntuacion")
      .eq("checkin_id", checkinId),
  ]);

  const senales: string[] = [];
  for (const e of eventos ?? []) {
    const cod = extraerCodigoSenal(e.detalle);
    if (cod) senales.push(cod);
  }

  const fechaPorCheckin = new Map<string, string>();
  for (const c of checkinsRecientes ?? []) fechaPorCheckin.set(c.id, c.fecha);
  const idsCheckins = [...fechaPorCheckin.keys()];

  const historico: PuntoHistorico[] = [];
  if (idsCheckins.length > 0) {
    const { data: obsHist } = await supabase
      .from("observaciones")
      .select("checkin_id, dominio, valor_num")
      .in("checkin_id", idsCheckins);
    for (const o of obsHist ?? []) {
      const fechaObs = fechaPorCheckin.get(o.checkin_id);
      if (fechaObs) {
        historico.push({
          fecha: fechaObs,
          dominio: o.dominio,
          valorNum: o.valor_num,
        });
      }
    }
  }

  let adherenciaCritica: DiaAdherencia[] = [];
  const idsCriticas = (pautasCriticas ?? []).map((p) => p.id);
  if (idsCriticas.length > 0) {
    const { data: tomas } = await supabase
      .from("tomas_medicacion")
      .select("fecha, estado")
      .eq("paciente_id", pacienteId)
      .in("pauta_id", idsCriticas)
      .gte("fecha", desde)
      .lte("fecha", fecha);
    const omitidaPorFecha = new Map<string, boolean>();
    for (const t of tomas ?? []) {
      const previo = omitidaPorFecha.get(t.fecha) ?? false;
      omitidaPorFecha.set(t.fecha, previo || t.estado === "omitida");
    }
    adherenciaCritica = [...omitidaPorFecha.entries()].map(([f, omitida]) => ({
      fecha: f,
      omitida,
    }));
  }

  return {
    vertical,
    observaciones: (observaciones ?? []).map((o) => ({
      dominio: o.dominio,
      codigo: o.codigo,
      valorNum: o.valor_num,
    })),
    senales,
    historico,
    adherenciaCritica,
    instrumentos: (instrumentos ?? []).map((r) => ({
      instrumento: r.instrumento,
      puntuacion: Number(r.puntuacion),
    })),
  };
}

async function cargarMensajesRelevantes(
  supabase: ClienteBD,
  checkinId: string,
): Promise<{ rol: string; contenido: string }[]> {
  const { data } = await supabase
    .from("mensajes")
    .select("rol, contenido, orden")
    .eq("checkin_id", checkinId)
    .order("orden", { ascending: false })
    .limit(4);
  return (data ?? [])
    .reverse()
    .map((m) => ({ rol: m.rol, contenido: m.contenido }));
}

/** Resta `dias` a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. */
function subDias(fecha: string, dias: number): string {
  return subDays(parseISO(fecha), dias).toISOString().slice(0, 10);
}

/**
 * Carga los datos y el contexto de un check-in y evalúa todas las reglas
 * aplicables. Devuelve `{nivel, reglasDisparadas}` (con el nivel más alto) más
 * el contexto que `acciones.aplicarEscalado` necesita para crear la alerta.
 *
 * Usa el cliente de servicio por defecto (el paciente no puede leer reglas);
 * se puede inyectar un cliente en tests.
 */
export async function evaluarCheckin(
  checkinId: string,
  opciones?: { supabase?: ClienteBD },
): Promise<EvaluacionCheckin> {
  const supabase = await clienteMotor(opciones?.supabase);

  const { data: checkin } = await supabase
    .from("checkins")
    .select("id, paciente_id, fecha, riesgo")
    .eq("id", checkinId)
    .maybeSingle();
  if (!checkin) return RESULTADO_VACIO(checkinId);

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("vertical")
    .eq("id", checkin.paciente_id)
    .maybeSingle();
  const vertical = paciente?.vertical ?? null;

  const [datos, reglas, mensajesRelevantes] = await Promise.all([
    cargarDatosEvaluacion(
      supabase,
      checkin.id,
      checkin.paciente_id,
      checkin.fecha,
      vertical,
    ),
    cargarReglasAplicables(supabase, checkin.paciente_id, vertical),
    cargarMensajesRelevantes(supabase, checkin.id),
  ]);

  const { nivel, reglasDisparadas } = evaluarReglas(datos, reglas);
  return {
    checkinId: checkin.id,
    pacienteId: checkin.paciente_id,
    riesgoActual: checkin.riesgo,
    nivel,
    reglasDisparadas,
    mensajesRelevantes,
    senalesDetectadas: datos.senales,
  };
}
