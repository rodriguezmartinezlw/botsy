/**
 * Tests de la agregación pseudonimizada del patrocinador (WP-17).
 *
 * INVARIANTE CRÍTICA (regla de oro de CLAUDE.md): ningún corte con < 5 pacientes
 * se revela. Estos tests la congelan: con una cohorte de 4 pacientes TODAS las
 * funciones suprimen; con >= 5 devuelven datos. Además, la cohorte demo del
 * programa «Tratamiento activo» (4 pacientes) queda suprimida — la demostración
 * "(a) una función de agregado omite un corte con < 5 pacientes".
 */

import { describe, expect, it } from "vitest";
import {
  K_ANONIMATO,
  adherenciaMensual,
  alertasPorNivel,
  cohorteSuficiente,
  curvaPersistencia,
  mesesTratamiento,
  motivosDiscontinuacion,
  resumenCohorte,
  tamanoCohorte,
  tasaCheckin,
  tiempoHastaDisposicion,
  type RegistroPacienteAgregado,
} from "./agregacion";
import { construirCohorteDemo, PROGRAMA_TERAPIA_ORAL, PROGRAMA_TRATAMIENTO_ACTIVO } from "./demo";

const HOY = "2026-07-16";

/** Registro mínimo con toma diaria y una alerta con disposición. */
function registro(
  pseudonimo: string,
  opts: Partial<RegistroPacienteAgregado> = {},
): RegistroPacienteAgregado {
  return {
    pseudonimo,
    programaClave: "mama_terapia_oral",
    pautas: [{ inicio: "2026-01-01", discontinuada: null, motivo: null }],
    tomas: [
      { fecha: "2026-07-01", estado: "tomada" },
      { fecha: "2026-07-02", estado: "tomada" },
      { fecha: "2026-07-03", estado: "omitida" },
    ],
    checkinDias: ["2026-07-01", "2026-07-02", "2026-07-03"],
    alertas: [
      {
        nivel: "contactar",
        creadaEn: "2026-07-01T09:00:00.000Z",
        senalEn: "2026-07-01T08:00:00.000Z",
        disposicion: { creadaEn: "2026-07-01T13:00:00.000Z", desenlace: "resuelto_sin_evento" },
      },
    ],
    ...opts,
  };
}

function cohorteDe(n: number): RegistroPacienteAgregado[] {
  return Array.from({ length: n }, (_, i) => registro(`P${i + 1}`));
}

describe("k-anonimato: cohorte < 5 suprime TODOS los cortes", () => {
  const pocos = cohorteDe(4); // 4 < 5

  it("el umbral es 5", () => {
    expect(K_ANONIMATO).toBe(5);
  });

  it("cohorteSuficiente es false y tamanoCohorte es 4", () => {
    expect(tamanoCohorte(pocos)).toBe(4);
    expect(cohorteSuficiente(pocos)).toBe(false);
  });

  it("resumenCohorte no revela el conteo exacto (n = null)", () => {
    const r = resumenCohorte(pocos);
    expect(r.suficiente).toBe(false);
    expect(r.n).toBeNull();
  });

  it("curvaPersistencia => []", () => {
    expect(curvaPersistencia(pocos)).toEqual([]);
  });

  it("mesesTratamiento => suficiente:false", () => {
    expect(mesesTratamiento(pocos, HOY)).toEqual({ suficiente: false });
  });

  it("motivosDiscontinuacion => []", () => {
    const conMotivo = cohorteDe(4).map((r) => ({
      ...r,
      pautas: [{ inicio: "2026-01-01", discontinuada: "2026-06-01", motivo: { codigo: "toxicidad", etiqueta: "Toxicidad" } }],
    }));
    expect(motivosDiscontinuacion(conMotivo)).toEqual([]);
  });

  it("tasaCheckin => suficiente:false", () => {
    expect(tasaCheckin(pocos, HOY)).toEqual({ suficiente: false });
  });

  it("alertasPorNivel => []", () => {
    expect(alertasPorNivel(pocos)).toEqual([]);
  });

  it("adherenciaMensual suprime el mes (< 5 pacientes ese mes)", () => {
    expect(adherenciaMensual(pocos)).toEqual([]);
  });

  it("tiempoHastaDisposicion => suficiente:false (< 5 disposiciones)", () => {
    expect(tiempoHastaDisposicion(pocos)).toEqual({ suficiente: false });
  });
});

describe("k-anonimato: cohorte >= 5 sí devuelve agregados", () => {
  const suficientes = cohorteDe(6);

  it("resumenCohorte revela n = 6", () => {
    expect(resumenCohorte(suficientes)).toEqual({ n: 6, suficiente: true });
  });

  it("curvaPersistencia devuelve la curva (mes 0 = 100%)", () => {
    const curva = curvaPersistencia(suficientes);
    expect(curva.length).toBeGreaterThan(0);
    expect(curva[0]).toEqual({ mes: 0, tasa: 100 });
  });

  it("adherenciaMensual devuelve el mes con >= 5 pacientes", () => {
    const filas = adherenciaMensual(suficientes);
    expect(filas.length).toBe(1);
    expect(filas[0].mes).toBe("2026-07");
    expect(filas[0].nPacientes).toBe(6);
    // 12 tomadas / 18 con desenlace = 66.7 -> 67%
    expect(filas[0].adherencia).toBe(67);
  });

  it("alertasPorNivel cuenta las alertas (6 contactar)", () => {
    expect(alertasPorNivel(suficientes)).toEqual([{ nivel: "contactar", conteo: 6 }]);
  });

  it("tiempoHastaDisposicion: mediana 4h sobre 6 disposiciones", () => {
    const r = tiempoHastaDisposicion(suficientes);
    expect(r).toEqual({ suficiente: true, medianaHoras: 4, n: 6 });
  });
});

describe("cohorte demo: por-programa suprime el corte < 5", () => {
  const demo = construirCohorteDemo(HOY);

  it("la demo tiene 10 pacientes", () => {
    expect(tamanoCohorte(demo)).toBe(10);
  });

  it("«Terapia oral» tiene 6 pacientes => se muestra", () => {
    const oral = demo.filter((r) => r.programaClave === PROGRAMA_TERAPIA_ORAL);
    expect(tamanoCohorte(oral)).toBe(6);
    expect(resumenCohorte(oral).suficiente).toBe(true);
    expect(curvaPersistencia(oral).length).toBeGreaterThan(0);
  });

  it("«Tratamiento activo» tiene 4 pacientes => SE OMITE (datos insuficientes)", () => {
    const activo = demo.filter((r) => r.programaClave === PROGRAMA_TRATAMIENTO_ACTIVO);
    expect(tamanoCohorte(activo)).toBe(4);
    expect(resumenCohorte(activo).suficiente).toBe(false);
    expect(curvaPersistencia(activo)).toEqual([]);
    expect(motivosDiscontinuacion(activo)).toEqual([]);
    expect(alertasPorNivel(activo)).toEqual([]);
  });

  it("la cohorte COMBINADA (10) sí muestra motivos de discontinuación", () => {
    const motivos = motivosDiscontinuacion(demo);
    expect(motivos.length).toBe(2); // toxicidad + decision_paciente
    const codigos = motivos.map((m) => m.codigo).sort();
    expect(codigos).toEqual(["decision_paciente", "toxicidad"]);
  });
});
