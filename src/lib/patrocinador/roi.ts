/**
 * Informe ROI pagador (WP-15) — módulo PURO. Calcula, SOLO a partir de datos ya
 * capturados (sin ML, sin proyecciones — regla de oro 4), las métricas del
 * informe ROI por cohorte, y provee un validador anti-cifras-inventadas
 * (reutiliza el de `@/lib/informes/resumen`) para garantizar que ningún texto
 * del informe contenga una cifra que no salga de los datos.
 *
 * Todas las métricas se documentan con su definición metodológica al pie del
 * informe. "urgencias_evitadas" es un PROXY HONESTO explícito: disposiciones con
 * desenlace `resuelto_sin_evento` sobre alertas de nivel contactar/urgencia.
 *
 * Respeta el k-anonimato: si la cohorte tiene < 5 pacientes, devuelve
 * `{ suficiente: false }` y el informe no muestra cifras.
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import { redondear } from "@/lib/agregados";
import {
  extraerCifras,
  extraerCifrasEnLetras,
  validarResumenSinCifrasInventadas,
} from "@/lib/informes/resumen";
import {
  K_ANONIMATO,
  cohorteSuficiente,
  percentil,
  tamanoCohorte,
  tasaCheckin,
  type RegistroPacienteAgregado,
} from "./agregacion";

export type MetricasRoi =
  | { suficiente: false }
  | {
      suficiente: true;
      /** Nº de pacientes de la cohorte (>= k). */
      n: number;
      /** Pacientes-mes observados (suma de días observados / 30). */
      pacientesMes: number;
      /** Urgencias evitadas (proxy): resueltas sin evento sobre alertas contactar/urgencia. */
      urgenciasEvitadas: number;
      /** Urgencias evitadas por 100 pacientes-mes. */
      urgenciasEvitadas100: number;
      /** Mediana de horas señal→alerta (check-in → alerta). null si sin eventos. */
      horasSenalAlerta: number | null;
      /** Mediana de horas alerta→disposición. null si sin eventos. */
      horasAlertaDisposicion: number | null;
      /** Tasa de respuesta al check-in (%) últimos 30 días. Benchmark Noona 90%. */
      tasaCheckin: number;
      /** Persistencia: % de pautas aún activas al cierre del período. */
      persistenciaPct: number;
    };

/** Pacientes-mes observados = suma por paciente de (días observados + 1)/30. */
function pacientesMesObservados(registros: readonly RegistroPacienteAgregado[]): number {
  let total = 0;
  for (const r of registros) {
    if (r.checkinDias.length === 0) continue;
    const fechas = [...r.checkinDias].sort();
    const dias =
      differenceInCalendarDays(
        parseISO(fechas[fechas.length - 1]),
        parseISO(fechas[0]),
      ) + 1;
    total += dias / 30;
  }
  return total;
}

/**
 * Calcula las métricas ROI de una cohorte. Cohorte < k => `{ suficiente: false }`.
 * Función PURA; no inventa nada: cada cifra sale de una operación sobre los datos.
 */
export function calcularRoi(
  registros: readonly RegistroPacienteAgregado[],
  hoy: string,
): MetricasRoi {
  if (!cohorteSuficiente(registros)) return { suficiente: false };

  const pacientesMes = pacientesMesObservados(registros);

  let urgenciasEvitadas = 0;
  const horasSenal: number[] = [];
  const horasDisp: number[] = [];
  let pautasTotal = 0;
  let pautasActivas = 0;

  for (const r of registros) {
    for (const p of r.pautas) {
      pautasTotal += 1;
      if (p.discontinuada === null) pautasActivas += 1;
    }
    for (const a of r.alertas) {
      if (
        a.disposicion &&
        a.disposicion.desenlace === "resuelto_sin_evento" &&
        (a.nivel === "contactar" || a.nivel === "urgencia")
      ) {
        urgenciasEvitadas += 1;
      }
      if (a.senalEn) {
        const h =
          (parseISO(a.creadaEn).getTime() - parseISO(a.senalEn).getTime()) / 3_600_000;
        if (Number.isFinite(h) && h >= 0) horasSenal.push(h);
      }
      if (a.disposicion) {
        const h =
          (parseISO(a.disposicion.creadaEn).getTime() - parseISO(a.creadaEn).getTime()) /
          3_600_000;
        if (Number.isFinite(h) && h >= 0) horasDisp.push(h);
      }
    }
  }

  const tc = tasaCheckin(registros, hoy);

  const medSenal = percentil(horasSenal, 0.5);
  const medDisp = percentil(horasDisp, 0.5);

  return {
    suficiente: true,
    n: tamanoCohorte(registros),
    pacientesMes: redondear(pacientesMes, 1),
    urgenciasEvitadas,
    urgenciasEvitadas100:
      pacientesMes > 0 ? redondear((urgenciasEvitadas / pacientesMes) * 100, 1) : 0,
    horasSenalAlerta: medSenal === null ? null : redondear(medSenal, 1),
    horasAlertaDisposicion: medDisp === null ? null : redondear(medDisp, 1),
    tasaCheckin: tc.suficiente ? tc.tasa : 0,
    persistenciaPct: pautasTotal > 0 ? redondear((pautasActivas / pautasTotal) * 100, 1) : 0,
  };
}

// --- Anti-cifras-inventadas ---------------------------------------------------

/** Conjunto de cifras (canónicas) que el texto del informe ROI PUEDE contener. */
export function cifrasPermitidasRoi(m: MetricasRoi): Set<string> {
  const set = new Set<string>();
  const add = (n: number | null) => {
    if (n === null) return;
    set.add(String(n));
    set.add(String(Math.round(n)));
  };
  set.add(String(K_ANONIMATO)); // el "5" del k-anonimato aparece en la metodología
  set.add("100"); // "por 100 pacientes-mes" y "%/10"
  set.add("90"); // benchmark Noona citado en la metodología
  if (m.suficiente) {
    add(m.n);
    add(m.pacientesMes);
    add(m.urgenciasEvitadas);
    add(m.urgenciasEvitadas100);
    add(m.horasSenalAlerta);
    add(m.horasAlertaDisposicion);
    add(m.tasaCheckin);
    add(m.persistenciaPct);
  }
  return set;
}

/**
 * Verifica que un texto del informe ROI no contenga ninguna cifra ajena a las
 * permitidas (defensa anti-alucinación, aunque el informe no usa LLM: cierra la
 * puerta a cualquier cifra que no salga de `calcularRoi`). Reutiliza el
 * extractor de dígitos y de números en letras de WP-07/WP-10.
 */
export function validarTextoRoi(
  texto: string,
  m: MetricasRoi,
): { ok: true } | { ok: false; intrusas: string[] } {
  return validarResumenSinCifrasInventadas(texto, cifrasPermitidasRoi(m));
}

/** Reexport de comodidad (los tests comprueban el extractor combinado). */
export function cifrasDeTexto(texto: string): string[] {
  return [...extraerCifras(texto), ...extraerCifrasEnLetras(texto)];
}
