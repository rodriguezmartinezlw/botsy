/**
 * Utilidades de agregación para el perfil evolutivo del paciente (WP-05).
 *
 * Módulo PURO: no importa Supabase ni ningún cliente de red. Recibe filas ya
 * leídas (fechadas) y devuelve series listas para pintar. Se usa desde el
 * Server Component del perfil (que lee de Supabase y llama aquí) y desde los
 * tests. Los componentes de gráfico consumen sólo los TIPOS de este módulo.
 *
 * Convención de fechas: cadenas "yyyy-MM-dd" (fecha clínica, sin hora). Se
 * evita `new Date(cadena)` directo (interpretaría UTC y desplazaría el día);
 * se usa `parseISO`, que devuelve medianoche local.
 */

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { es } from "date-fns/locale";
import type { DominioObservacion, EstadoToma } from "@/types/db";

// --- Tipos compartidos (los consumen también los componentes de gráfico) -----

export type Periodo = "semana" | "mes" | "tres_meses";

/** Nº de días que abarca cada período (contando el día de hoy). */
export const DIAS_PERIODO: Record<Periodo, number> = {
  semana: 7,
  mes: 30,
  tres_meses: 90,
};

/** Etiqueta legible del período para la UI. */
export const ETIQUETA_PERIODO: Record<Periodo, string> = {
  semana: "Semana",
  mes: "Mes",
  tres_meses: "3 meses",
};

/** Rango de fechas inclusivo [desde, hasta] en "yyyy-MM-dd". */
export type Rango = { desde: string; hasta: string };

/** Observación con su fecha clínica ya resuelta (la del check-in al que pertenece). */
export type ObservacionFechada = {
  fecha: string;
  dominio: DominioObservacion;
  codigo: string;
  valor_num: number | null;
};

/** Toma de medicación con su fecha y (opcional) la pauta a la que pertenece. */
export type TomaFechada = {
  fecha: string;
  estado: EstadoToma;
  pautaId?: string;
};

/** Un punto de una serie temporal diaria. `valor` es `null` si ese día no hubo dato. */
export type SeriePunto = { fecha: string; valor: number | null };

/** Un punto de la serie de ánimo/ansiedad/estrés (0–10). */
export type PuntoAnimo = {
  fecha: string;
  animo: number | null;
  ansiedad: number | null;
  estres: number | null;
};

/** Barra genérica (evolución mensual, sueño, …). */
export type PuntoBarra = { etiqueta: string; valor: number };

/** Estado de un día en la fila de adherencia: verde / rojo / gris. */
export type EstadoDia = "tomada" | "omitida" | "gris";

/** Un día de la fila semanal de adherencia (L–D). */
export type DiaAdherencia = {
  fecha: string;
  inicial: string; // L, M, X, J, V, S, D
  estado: EstadoDia;
};

/** Recuento de un código de síntoma en los últimos días. */
export type RecuentoSintoma = { codigo: string; recuento: number };

// --- Helpers de fecha --------------------------------------------------------

const INICIALES_SEMANA = ["L", "M", "X", "J", "V", "S", "D"] as const;

/** Formatea una fecha "yyyy-MM-dd" a Date local (medianoche), sin desfase de zona. */
function aDate(fecha: string): Date {
  return parseISO(fecha);
}

/** Vuelve a "yyyy-MM-dd". */
function aFecha(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** ¿La fecha (yyyy-MM-dd) cae dentro del rango inclusivo? */
export function enRango(fecha: string, rango: Rango): boolean {
  return fecha >= rango.desde && fecha <= rango.hasta;
}

// --- Rangos de período -------------------------------------------------------

/**
 * Rango del período actual que termina hoy (inclusive). Ej.: "semana" =>
 * los 7 días [hoy-6 … hoy].
 */
export function rangoPeriodo(periodo: Periodo, hoy: string): Rango {
  const dias = DIAS_PERIODO[periodo];
  const hasta = aDate(hoy);
  const desde = subDays(hasta, dias - 1);
  return { desde: aFecha(desde), hasta: aFecha(hasta) };
}

/**
 * Rango del período inmediatamente anterior (misma longitud, justo antes del
 * actual). Ej.: "semana" => [hoy-13 … hoy-7]. Se usa para el delta.
 */
export function rangoAnterior(periodo: Periodo, hoy: string): Rango {
  const dias = DIAS_PERIODO[periodo];
  const actual = rangoPeriodo(periodo, hoy);
  const hasta = subDays(aDate(actual.desde), 1);
  const desde = subDays(hasta, dias - 1);
  return { desde: aFecha(desde), hasta: aFecha(hasta) };
}

// --- Medias diarias ----------------------------------------------------------

/**
 * Media diaria de `valor_num` de un conjunto de observaciones dentro de un
 * rango. Devuelve un punto por CADA día del rango (serie densa; `valor` es
 * `null` cuando ese día no hay datos). Ignora observaciones con `valor_num`
 * nulo. El llamador filtra por dominio antes de llamar (o se filtra aquí si se
 * pasa `dominio`).
 */
export function mediasDiarias(
  observaciones: ObservacionFechada[],
  rango: Rango,
  dominio?: DominioObservacion,
): SeriePunto[] {
  const acum = new Map<string, { suma: number; n: number }>();
  for (const obs of observaciones) {
    if (dominio && obs.dominio !== dominio) continue;
    if (obs.valor_num === null || obs.valor_num === undefined) continue;
    if (!enRango(obs.fecha, rango)) continue;
    const prev = acum.get(obs.fecha) ?? { suma: 0, n: 0 };
    prev.suma += obs.valor_num;
    prev.n += 1;
    acum.set(obs.fecha, prev);
  }

  const dias = eachDayOfInterval({
    start: aDate(rango.desde),
    end: aDate(rango.hasta),
  });
  return dias.map((d) => {
    const fecha = aFecha(d);
    const registro = acum.get(fecha);
    return {
      fecha,
      valor: registro ? redondear(registro.suma / registro.n, 2) : null,
    };
  });
}

/** Media de los valores no nulos de una serie. `null` si no hay ninguno. */
export function mediaSerie(serie: SeriePunto[]): number | null {
  const valores = serie
    .map((p) => p.valor)
    .filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  const suma = valores.reduce((a, b) => a + b, 0);
  return redondear(suma / valores.length, 2);
}

/** Valor máximo (pico) de una serie. `null` si está vacía. */
export function picoSerie(serie: SeriePunto[]): number | null {
  const valores = serie
    .map((p) => p.valor)
    .filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  return Math.max(...valores);
}

/**
 * Delta porcentual entre la media actual y la anterior, redondeado a entero.
 * Positivo = subida; negativo = bajada. `null` si falta alguno o el anterior es 0.
 */
export function deltaPorcentual(
  actual: number | null,
  anterior: number | null,
): number | null {
  if (actual === null || anterior === null || anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

// --- Ánimo / ansiedad / estrés ----------------------------------------------

/**
 * Serie combinada de ánimo, ansiedad y estrés (una línea por dominio). Cada día
 * lleva la media de ese día por dominio (o `null`).
 */
export function seriesAnimoEstres(
  observaciones: ObservacionFechada[],
  rango: Rango,
): PuntoAnimo[] {
  const animo = mediasDiarias(observaciones, rango, "animo");
  const ansiedad = mediasDiarias(observaciones, rango, "ansiedad");
  const estres = mediasDiarias(observaciones, rango, "estres");
  return animo.map((p, i) => ({
    fecha: p.fecha,
    animo: p.valor,
    ansiedad: ansiedad[i]?.valor ?? null,
    estres: estres[i]?.valor ?? null,
  }));
}

/** ¿Alguna de las tres series de ánimo/ansiedad/estrés tiene algún dato? */
export function hayDatosAnimo(puntos: PuntoAnimo[]): boolean {
  return puntos.some(
    (p) => p.animo !== null || p.ansiedad !== null || p.estres !== null,
  );
}

// --- Adherencia --------------------------------------------------------------

/**
 * Porcentaje de adherencia de un conjunto de tomas.
 *
 * DEFINICIÓN: `tomadas / (tomadas + omitidas) * 100`, redondeado a entero. Sólo
 * cuentan las tomas con desenlace conocido: las de estado `desconocido` (gris)
 * NO computan ni a favor ni en contra (no sabemos si se tomaron). Si no hay
 * ninguna toma con desenlace conocido, devuelve `null` (sin dato).
 */
export function porcentajeAdherencia(
  tomas: { estado: EstadoToma }[],
): number | null {
  let tomadas = 0;
  let omitidas = 0;
  for (const t of tomas) {
    if (t.estado === "tomada") tomadas += 1;
    else if (t.estado === "omitida") omitidas += 1;
  }
  const denom = tomadas + omitidas;
  if (denom === 0) return null;
  return Math.round((tomadas / denom) * 100);
}

/**
 * Fila semanal L–D (lunes a domingo de la semana que contiene `hoy`) para las
 * tomas de una pauta. Estado por día: rojo si hubo alguna omitida, verde si
 * hubo alguna tomada (y ninguna omitida), gris en cualquier otro caso
 * (sin registro, desconocido, o día futuro).
 */
export function semanaAdherencia(
  tomas: TomaFechada[],
  hoy: string,
): DiaAdherencia[] {
  const lunes = startOfWeek(aDate(hoy), { weekStartsOn: 1 });
  const hoyDate = aDate(hoy);
  const porFecha = new Map<string, EstadoToma[]>();
  for (const t of tomas) {
    const lista = porFecha.get(t.fecha) ?? [];
    lista.push(t.estado);
    porFecha.set(t.fecha, lista);
  }

  return INICIALES_SEMANA.map((inicial, i) => {
    const d = addDays(lunes, i);
    const fecha = aFecha(d);
    let estado: EstadoDia = "gris";
    if (differenceInCalendarDays(d, hoyDate) <= 0) {
      const estados = porFecha.get(fecha);
      if (estados && estados.length > 0) {
        if (estados.includes("omitida")) estado = "omitida";
        else if (estados.includes("tomada")) estado = "tomada";
        else estado = "gris"; // desconocido
      }
    }
    return { fecha, inicial, estado };
  });
}

/**
 * Evolución mensual de la adherencia: un punto por mes natural presente en las
 * tomas, con el % de adherencia de ese mes. Orden cronológico. Vacío si no hay
 * tomas con desenlace conocido.
 */
export function evolucionMensualAdherencia(tomas: TomaFechada[]): PuntoBarra[] {
  const porMes = new Map<string, { estado: EstadoToma }[]>();
  for (const t of tomas) {
    const clave = t.fecha.slice(0, 7); // "yyyy-MM"
    const lista = porMes.get(clave) ?? [];
    lista.push({ estado: t.estado });
    porMes.set(clave, lista);
  }

  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, lista]) => {
      const pct = porcentajeAdherencia(lista);
      return {
        etiqueta: format(parseISO(`${clave}-01`), "MMM", { locale: es }),
        valor: pct ?? 0,
      };
    });
}

// --- Síntomas físicos --------------------------------------------------------

/**
 * Recuento de códigos de síntoma físico dentro del rango, ordenados de más
 * frecuente a menos. Un mismo código puede aparecer en varios check-ins.
 */
export function recuentoSintomas(
  observaciones: ObservacionFechada[],
  rango: Rango,
): RecuentoSintoma[] {
  const cuenta = new Map<string, number>();
  for (const obs of observaciones) {
    if (obs.dominio !== "sintoma_fisico") continue;
    if (!enRango(obs.fecha, rango)) continue;
    cuenta.set(obs.codigo, (cuenta.get(obs.codigo) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([codigo, recuento]) => ({ codigo, recuento }))
    .sort((a, b) => b.recuento - a.recuento || a.codigo.localeCompare(b.codigo));
}

// --- Utilidad numérica -------------------------------------------------------

/** Redondea a `decimales` cifras (evita floats largos en el payload al cliente). */
export function redondear(n: number, decimales = 0): number {
  const factor = 10 ** decimales;
  return Math.round(n * factor) / factor;
}
