/**
 * Agregación pseudonimizada para el dashboard del patrocinador (WP-17) — módulo
 * PURO (solo `date-fns` + helpers de `@/lib/agregados`). No importa Supabase.
 *
 * ============================ K-ANONIMATO ============================
 * Regla de oro de CLAUDE.md / PLAN §7: el patrocinador SOLO ve agregados con
 * k-anonimato >= 5. Aquí eso se materializa como código puro y testeado: cada
 * función que produce un corte comprueba el tamaño de la cohorte y, si es < 5,
 * SUPRIME el resultado (lista vacía o marcador `suficiente:false`) — nunca
 * devuelve la métrica ni el conteo exacto de un corte pequeño.
 *
 * Este módulo es la fuente única de la lógica de supresión en el lado TS (lo
 * consume el MODO DEMO). El lado producción la aplica INDEPENDIENTEMENTE en SQL
 * (RPC `security definer`, migración 0010) — defensa en profundidad: dos capas
 * que suprimen cortes < 5, ninguna confía en la otra.
 * =====================================================================
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import { porcentajeAdherencia, redondear } from "@/lib/agregados";
import type { EstadoToma, NivelEscalado } from "@/types/db";

/** Umbral de k-anonimato: ningún corte con menos de estos pacientes se revela. */
export const K_ANONIMATO = 5;

// --- Modelo de entrada (un registro por paciente de la cohorte) --------------

export type MotivoCodificado = { codigo: string; etiqueta: string };

export type PautaAgregado = {
  /** Fecha de inicio de la pauta (yyyy-MM-dd). */
  inicio: string;
  /** Fecha de discontinuación (yyyy-MM-dd) o null si sigue activa. */
  discontinuada: string | null;
  /** Motivo codificado de discontinuación (null si activa o baja por error). */
  motivo: MotivoCodificado | null;
};

export type AlertaAgregado = {
  nivel: NivelEscalado;
  /** ISO de creación de la alerta. */
  creadaEn: string;
  /** ISO de creación del check-in que originó la alerta (señal), si consta. */
  senalEn: string | null;
  /** Disposición asociada, si la alerta ya se cerró. */
  disposicion: { creadaEn: string; desenlace: string } | null;
};

/** Registro agregable de un paciente (ya pseudonimizado: sin nombre ni id real fuera). */
export type RegistroPacienteAgregado = {
  /** Identificador pseudónimo estable para contar pacientes distintos. */
  pseudonimo: string;
  programaClave: string;
  pautas: PautaAgregado[];
  tomas: { fecha: string; estado: EstadoToma }[];
  /** Fechas (yyyy-MM-dd) de check-ins completados. */
  checkinDias: string[];
  alertas: AlertaAgregado[];
};

// --- Utilidades internas -----------------------------------------------------

/** Nº de pacientes distintos de una cohorte. */
export function tamanoCohorte(registros: readonly RegistroPacienteAgregado[]): number {
  return new Set(registros.map((r) => r.pseudonimo)).size;
}

/** ¿La cohorte alcanza el umbral de k-anonimato? */
export function cohorteSuficiente(registros: readonly RegistroPacienteAgregado[]): boolean {
  return tamanoCohorte(registros) >= K_ANONIMATO;
}

function mesesEntre(inicio: string, fin: string): number {
  return differenceInCalendarDays(parseISO(fin), parseISO(inicio)) / 30;
}

/** Percentil (interpolación lineal, estilo percentile_cont) de una lista. */
export function percentil(valores: readonly number[], p: number): number | null {
  const xs = [...valores].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  if (xs.length === 1) return xs[0];
  const idx = p * (xs.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return xs[lo];
  return xs[lo] + (xs[hi] - xs[lo]) * (idx - lo);
}

function todasLasPautas(registros: readonly RegistroPacienteAgregado[]): PautaAgregado[] {
  return registros.flatMap((r) => r.pautas);
}

// --- 1) Resumen de cohorte ---------------------------------------------------

export type ResumenCohorte = { n: number | null; suficiente: boolean };

/** Tamaño de cohorte; `n` es null si < k (no se revela el conteo exacto). */
export function resumenCohorte(
  registros: readonly RegistroPacienteAgregado[],
): ResumenCohorte {
  const n = tamanoCohorte(registros);
  return n >= K_ANONIMATO ? { n, suficiente: true } : { n: null, suficiente: false };
}

// --- 2) Persistencia (curva simple sobre discontinuada) ----------------------

export type PuntoPersistencia = { mes: number; tasa: number };

/**
 * Curva de persistencia: para cada mes 0..maxMes, fracción (%) de pautas que
 * AÚN no se han discontinuado. Cohorte < k => `[]` (suprimida).
 */
export function curvaPersistencia(
  registros: readonly RegistroPacienteAgregado[],
  maxMes = 6,
): PuntoPersistencia[] {
  if (!cohorteSuficiente(registros)) return [];
  const pautas = todasLasPautas(registros);
  if (pautas.length === 0) return [];
  const puntos: PuntoPersistencia[] = [];
  for (let m = 0; m <= maxMes; m++) {
    const persisten = pautas.filter(
      (p) => p.discontinuada === null || mesesEntre(p.inicio, p.discontinuada) >= m,
    ).length;
    puntos.push({ mes: m, tasa: redondear((persisten / pautas.length) * 100, 1) });
  }
  return puntos;
}

// --- 3) Meses en tratamiento -------------------------------------------------

export type MesesTratamiento =
  | { suficiente: true; mediana: number; p25: number; p75: number; n: number }
  | { suficiente: false };

/** Meses en tratamiento por pauta (hasta discontinuación o `hoy`). */
export function mesesTratamiento(
  registros: readonly RegistroPacienteAgregado[],
  hoy: string,
): MesesTratamiento {
  if (!cohorteSuficiente(registros)) return { suficiente: false };
  const meses = todasLasPautas(registros).map((p) =>
    mesesEntre(p.inicio, p.discontinuada ?? hoy),
  );
  const mediana = percentil(meses, 0.5);
  const p25 = percentil(meses, 0.25);
  const p75 = percentil(meses, 0.75);
  if (mediana === null || p25 === null || p75 === null) return { suficiente: false };
  return {
    suficiente: true,
    mediana: redondear(mediana, 1),
    p25: redondear(p25, 1),
    p75: redondear(p75, 1),
    n: tamanoCohorte(registros),
  };
}

// --- 4) Adherencia media mensual ---------------------------------------------

export type PuntoAdherenciaMensual = {
  mes: string;
  adherencia: number;
  nPacientes: number;
};

/**
 * Adherencia media por mes natural. SUPRIME cada mes con < k pacientes
 * distintos (k-anonimato por corte mensual).
 */
export function adherenciaMensual(
  registros: readonly RegistroPacienteAgregado[],
): PuntoAdherenciaMensual[] {
  const porMes = new Map<
    string,
    { tomas: { estado: EstadoToma }[]; pacientes: Set<string> }
  >();
  for (const r of registros) {
    for (const t of r.tomas) {
      if (t.estado !== "tomada" && t.estado !== "omitida") continue;
      const clave = t.fecha.slice(0, 7); // yyyy-MM
      const grupo = porMes.get(clave) ?? { tomas: [], pacientes: new Set() };
      grupo.tomas.push({ estado: t.estado });
      grupo.pacientes.add(r.pseudonimo);
      porMes.set(clave, grupo);
    }
  }
  return [...porMes.entries()]
    .filter(([, g]) => g.pacientes.size >= K_ANONIMATO) // supresión por mes
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, g]) => ({
      mes,
      adherencia: porcentajeAdherencia(g.tomas) ?? 0,
      nPacientes: g.pacientes.size,
    }));
}

// --- 5) Motivos de discontinuación -------------------------------------------

export type ConteoMotivo = { codigo: string; etiqueta: string; conteo: number };

/**
 * Conteos de motivos de discontinuación codificados. La cohorte debe ser >= k
 * (los motivos son atributos de una cohorte ya k-segura). Cohorte < k => `[]`.
 */
export function motivosDiscontinuacion(
  registros: readonly RegistroPacienteAgregado[],
): ConteoMotivo[] {
  if (!cohorteSuficiente(registros)) return [];
  const cuenta = new Map<string, ConteoMotivo>();
  for (const p of todasLasPautas(registros)) {
    if (!p.motivo) continue;
    const prev = cuenta.get(p.motivo.codigo) ?? {
      codigo: p.motivo.codigo,
      etiqueta: p.motivo.etiqueta,
      conteo: 0,
    };
    prev.conteo += 1;
    cuenta.set(p.motivo.codigo, prev);
  }
  return [...cuenta.values()].sort(
    (a, b) => b.conteo - a.conteo || a.codigo.localeCompare(b.codigo),
  );
}

// --- 6) Tasa de check-in (engagement) ----------------------------------------

export type TasaCheckin = { suficiente: true; tasa: number; n: number } | { suficiente: false };

/**
 * Tasa de check-in de los últimos `ventanaDias` días: días con check-in
 * completado / (n pacientes * ventana). Cohorte < k => suprimida.
 */
export function tasaCheckin(
  registros: readonly RegistroPacienteAgregado[],
  hoy: string,
  ventanaDias = 30,
): TasaCheckin {
  if (!cohorteSuficiente(registros)) return { suficiente: false };
  const hoyD = parseISO(hoy);
  let dias = 0;
  for (const r of registros) {
    const enVentana = new Set(
      r.checkinDias.filter((f) => {
        const d = differenceInCalendarDays(hoyD, parseISO(f));
        return d >= 0 && d < ventanaDias;
      }),
    );
    dias += enVentana.size;
  }
  const n = tamanoCohorte(registros);
  const tasa = redondear((dias / (n * ventanaDias)) * 100, 1);
  return { suficiente: true, tasa, n };
}

// --- 7) Alertas por nivel ----------------------------------------------------

export type ConteoNivel = { nivel: NivelEscalado; conteo: number };

/** Conteo de alertas por nivel. Cohorte < k => `[]`. */
export function alertasPorNivel(
  registros: readonly RegistroPacienteAgregado[],
): ConteoNivel[] {
  if (!cohorteSuficiente(registros)) return [];
  const cuenta = new Map<NivelEscalado, number>();
  for (const r of registros) {
    for (const a of r.alertas) {
      cuenta.set(a.nivel, (cuenta.get(a.nivel) ?? 0) + 1);
    }
  }
  const orden: NivelEscalado[] = ["vigilancia", "contactar", "urgencia"];
  return orden
    .filter((nivel) => cuenta.has(nivel))
    .map((nivel) => ({ nivel, conteo: cuenta.get(nivel) ?? 0 }));
}

// --- 8) Tiempo hasta disposición ---------------------------------------------

export type TiempoHastaDisposicion =
  | { suficiente: true; medianaHoras: number; n: number }
  | { suficiente: false };

/**
 * Mediana de horas entre la creación de la alerta y su disposición. Requiere
 * al menos k disposiciones en la cohorte (k-anonimato sobre el corte de eventos).
 */
export function tiempoHastaDisposicion(
  registros: readonly RegistroPacienteAgregado[],
): TiempoHastaDisposicion {
  const horas: number[] = [];
  for (const r of registros) {
    for (const a of r.alertas) {
      if (!a.disposicion) continue;
      const h =
        (parseISO(a.disposicion.creadaEn).getTime() - parseISO(a.creadaEn).getTime()) /
        3_600_000;
      if (Number.isFinite(h)) horas.push(h);
    }
  }
  if (horas.length < K_ANONIMATO) return { suficiente: false };
  const mediana = percentil(horas, 0.5);
  if (mediana === null) return { suficiente: false };
  return { suficiente: true, medianaHoras: redondear(mediana, 1), n: horas.length };
}
