/**
 * Tests ligeros de las agregaciones del perfil (WP-05).
 *
 * Reproducen los datos del seed de WP-01 (Luis: 14 días) SIN Supabase: se
 * construyen fixtures deterministas con la MISMA fórmula del seed
 * (`supabase/seed.sql`) sobre una fecha "hoy" fija, y se comprueban:
 *   - el % de adherencia (coincide con el cálculo manual documentado),
 *   - las medias diarias y el delta de dolor entre períodos,
 *   - la fila semanal L–D,
 *   - los estados vacíos con un paciente sin datos (Carmen).
 */

import { describe, expect, it } from "vitest";
import {
  DIAS_PERIODO,
  deltaPorcentual,
  evolucionMensualAdherencia,
  hayDatosAnimo,
  mediaSerie,
  mediasDiarias,
  picoSerie,
  porcentajeAdherencia,
  rangoAnterior,
  rangoPeriodo,
  recuentoSintomas,
  seriesAnimoEstres,
  semanaAdherencia,
  type ObservacionFechada,
  type TomaFechada,
} from "./agregados";

// --- Reconstrucción del seed de Luis (14 días) -------------------------------
// Fórmula literal de seed.sql, con "hoy" fijo para test determinista.
// d in 0..13; fecha = hoy - (13 - d) => d=13 es hoy.
const HOY = "2026-07-15";

function fechaSeed(d: number): string {
  // 2026-07-15 menos (13 - d) días, calculado a mano para no depender de libs.
  // d=13 -> 2026-07-15 ; d=0 -> 2026-07-02
  const dia = 2 + d; // 2..15 de julio (julio tiene 31 días, sin cruce de mes)
  return `2026-07-${String(dia).padStart(2, "0")}`;
}

/** dolor = round(8 - d*6/13) — igual que el seed. */
function dolorSeed(d: number): number {
  return Math.round(8 - (d * 6.0) / 13);
}

/** animo = 6 + (d % 2) — igual que el seed. */
function animoSeed(d: number): number {
  return 6 + (d % 2);
}

const observacionesLuis: ObservacionFechada[] = [];
const tomasAas: TomaFechada[] = [];
const tomasWarfarina: TomaFechada[] = [];

for (let d = 0; d <= 13; d++) {
  const fecha = fechaSeed(d);
  observacionesLuis.push({
    fecha,
    dominio: "dolor",
    codigo: "dolor_generalizado",
    valor_num: dolorSeed(d),
  });
  observacionesLuis.push({
    fecha,
    dominio: "animo",
    codigo: "animo_estado",
    valor_num: animoSeed(d),
  });
  // AAS mañana: siempre tomada.
  tomasAas.push({ fecha, estado: "tomada", pautaId: "aas" });
  // Warfarina noche: omitida los 2 últimos días (d = 12, 13).
  tomasWarfarina.push({
    fecha,
    estado: d >= 12 ? "omitida" : "tomada",
    pautaId: "warfarina",
  });
}

const todasLasTomas = [...tomasAas, ...tomasWarfarina];

// --- % de adherencia (criterio de aceptación clave) --------------------------

describe("porcentajeAdherencia (seed de Luis)", () => {
  it("AAS: 14 tomadas de 14 = 100%", () => {
    expect(porcentajeAdherencia(tomasAas)).toBe(100);
  });

  it("Warfarina: 12 tomadas de 14 (2 omitidas) = 86%", () => {
    // 12 / (12 + 2) = 0.857142... -> 86 %
    expect(porcentajeAdherencia(tomasWarfarina)).toBe(86);
  });

  it("Global (AAS + Warfarina): 26 tomadas de 28 = 93%", () => {
    // 26 / (26 + 2) = 0.928571... -> 93 %
    expect(porcentajeAdherencia(todasLasTomas)).toBe(93);
  });

  it("ignora las tomas 'desconocido' (no computan en el denominador)", () => {
    const tomas: TomaFechada[] = [
      { fecha: "2026-07-10", estado: "tomada" },
      { fecha: "2026-07-11", estado: "omitida" },
      { fecha: "2026-07-12", estado: "desconocido" },
      { fecha: "2026-07-13", estado: "desconocido" },
    ];
    // 1 / (1 + 1) = 50 %; los dos 'desconocido' no cuentan.
    expect(porcentajeAdherencia(tomas)).toBe(50);
  });

  it("sin tomas con desenlace conocido -> null", () => {
    expect(porcentajeAdherencia([])).toBeNull();
    expect(
      porcentajeAdherencia([{ estado: "desconocido" }, { estado: "desconocido" }]),
    ).toBeNull();
  });
});

// --- Adherencia del período "Semana" -----------------------------------------

describe("adherencia por período (Semana de Luis)", () => {
  it("Warfarina en los últimos 7 días: 5 tomadas de 7 = 71%", () => {
    const rango = rangoPeriodo("semana", HOY);
    const enSemana = tomasWarfarina.filter(
      (t) => t.fecha >= rango.desde && t.fecha <= rango.hasta,
    );
    // 7 días (09..15 jul); omitidas 14 y 15 jul -> 5 tomadas.
    expect(enSemana).toHaveLength(7);
    expect(porcentajeAdherencia(enSemana)).toBe(71);
  });
});

// --- Medias diarias y delta de dolor -----------------------------------------

describe("dolor: medias diarias y delta de período", () => {
  it("serie de dolor de la semana = 5,4,4,3,3,2,2 (últimos 7 días)", () => {
    const rango = rangoPeriodo("semana", HOY);
    const serie = mediasDiarias(observacionesLuis, rango, "dolor");
    expect(serie).toHaveLength(7);
    expect(serie.map((p) => p.valor)).toEqual([5, 4, 4, 3, 3, 2, 2]);
  });

  it("media semana ≈ 3.29 y pico = 5", () => {
    const rango = rangoPeriodo("semana", HOY);
    const serie = mediasDiarias(observacionesLuis, rango, "dolor");
    expect(mediaSerie(serie)).toBeCloseTo(23 / 7, 2);
    expect(picoSerie(serie)).toBe(5);
  });

  it("delta semanal de dolor ≈ -51% (baja respecto a la semana anterior)", () => {
    const actual = rangoPeriodo("semana", HOY);
    const anterior = rangoAnterior("semana", HOY);
    const serieActual = mediasDiarias(observacionesLuis, actual, "dolor");
    const serieAnterior = mediasDiarias(observacionesLuis, anterior, "dolor");
    // actual = 23/7 = 3.286 ; anterior = 47/7 = 6.714 ; delta = -51%
    expect(mediaSerie(serieAnterior)).toBeCloseTo(47 / 7, 2);
    expect(deltaPorcentual(mediaSerie(serieActual), mediaSerie(serieAnterior))).toBe(
      -51,
    );
  });

  it("serie densa: un punto por día del rango aunque falten datos", () => {
    const rango = rangoPeriodo("mes", HOY);
    const serie = mediasDiarias(observacionesLuis, rango, "dolor");
    expect(serie).toHaveLength(DIAS_PERIODO.mes); // 30 puntos
    // Sólo 14 días tienen dato; el resto es null.
    expect(serie.filter((p) => p.valor !== null)).toHaveLength(14);
  });
});

// --- Ánimo / ansiedad / estrés (Luis sólo tiene ánimo) -----------------------

describe("ánimo/ansiedad/estrés", () => {
  it("Luis tiene ánimo pero no ansiedad ni estrés", () => {
    const rango = rangoPeriodo("mes", HOY);
    const puntos = seriesAnimoEstres(observacionesLuis, rango);
    expect(hayDatosAnimo(puntos)).toBe(true);
    const conAnimo = puntos.filter((p) => p.animo !== null);
    expect(conAnimo).toHaveLength(14);
    expect(puntos.every((p) => p.ansiedad === null)).toBe(true);
    expect(puntos.every((p) => p.estres === null)).toBe(true);
  });
});

// --- Fila semanal L–D --------------------------------------------------------

describe("semanaAdherencia (Warfarina de Luis)", () => {
  it("marca en rojo los 2 últimos días (omitidos) y verde el resto de la semana", () => {
    // HOY = 2026-07-15 es miércoles -> semana L(13) .. D(19).
    const dias = semanaAdherencia(tomasWarfarina, HOY);
    expect(dias).toHaveLength(7);
    expect(dias.map((d) => d.inicial)).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
    // Lunes 13 (tomada) verde, Martes 14 (omitida) rojo, Miércoles 15 (omitida) rojo.
    const porFecha = Object.fromEntries(dias.map((d) => [d.fecha, d.estado]));
    expect(porFecha["2026-07-13"]).toBe("tomada");
    expect(porFecha["2026-07-14"]).toBe("omitida");
    expect(porFecha["2026-07-15"]).toBe("omitida");
    // Jueves 16 en adelante: futuro sin registro -> gris.
    expect(porFecha["2026-07-16"]).toBe("gris");
    expect(porFecha["2026-07-19"]).toBe("gris");
  });
});

// --- Evolución mensual -------------------------------------------------------

describe("evolucionMensualAdherencia", () => {
  it("un punto por mes con el % del mes (Luis, todo en julio)", () => {
    const barras = evolucionMensualAdherencia(todasLasTomas);
    expect(barras).toHaveLength(1);
    expect(barras[0].valor).toBe(93); // 26/28 en julio
  });

  it("agrupa por mes natural y ordena cronológicamente", () => {
    const tomas: TomaFechada[] = [
      { fecha: "2026-06-30", estado: "tomada" },
      { fecha: "2026-06-29", estado: "omitida" },
      { fecha: "2026-07-01", estado: "tomada" },
    ];
    const barras = evolucionMensualAdherencia(tomas);
    expect(barras).toHaveLength(2);
    expect(barras[0].valor).toBe(50); // junio: 1/2
    expect(barras[1].valor).toBe(100); // julio: 1/1
  });
});

// --- Síntomas físicos --------------------------------------------------------

describe("recuentoSintomas", () => {
  it("cuenta y ordena por frecuencia dentro del rango", () => {
    const obs: ObservacionFechada[] = [
      { fecha: "2026-07-10", dominio: "sintoma_fisico", codigo: "cefalea", valor_num: null },
      { fecha: "2026-07-11", dominio: "sintoma_fisico", codigo: "cefalea", valor_num: null },
      { fecha: "2026-07-12", dominio: "sintoma_fisico", codigo: "nauseas", valor_num: null },
      { fecha: "2026-07-13", dominio: "dolor", codigo: "dolor_generalizado", valor_num: 3 },
    ];
    const rango = rangoPeriodo("mes", HOY);
    const chips = recuentoSintomas(obs, rango);
    expect(chips).toEqual([
      { codigo: "cefalea", recuento: 2 },
      { codigo: "nauseas", recuento: 1 },
    ]);
  });
});

// --- Estados vacíos (Carmen, paciente sin datos) -----------------------------

describe("estados vacíos (Carmen: sin observaciones ni tomas)", () => {
  const rango = rangoPeriodo("mes", HOY);

  it("dolor: serie densa toda a null; media/pico/delta = null", () => {
    const serie = mediasDiarias([], rango, "dolor");
    expect(serie).toHaveLength(DIAS_PERIODO.mes);
    expect(serie.every((p) => p.valor === null)).toBe(true);
    expect(mediaSerie(serie)).toBeNull();
    expect(picoSerie(serie)).toBeNull();
    expect(deltaPorcentual(null, null)).toBeNull();
  });

  it("ánimo: sin datos", () => {
    expect(hayDatosAnimo(seriesAnimoEstres([], rango))).toBe(false);
  });

  it("adherencia: sin tomas -> null y evolución vacía", () => {
    expect(porcentajeAdherencia([])).toBeNull();
    expect(evolucionMensualAdherencia([])).toEqual([]);
    // La fila L–D existe pero todos los días en gris.
    const dias = semanaAdherencia([], HOY);
    expect(dias).toHaveLength(7);
    expect(dias.every((d) => d.estado === "gris")).toBe(true);
  });

  it("síntomas: sin chips", () => {
    expect(recuentoSintomas([], rango)).toEqual([]);
  });
});
