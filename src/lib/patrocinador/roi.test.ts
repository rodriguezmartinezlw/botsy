/**
 * Tests del informe ROI pagador (WP-15).
 *
 * Demuestra "(c) el informe ROI solo usa cifras reales": el validador
 * `validarTextoRoi` acepta una narrativa cuyas cifras salen de `calcularRoi` y
 * RECHAZA cualquier cifra inventada. Y respeta el k-anonimato (< 5 => sin cifras).
 */

import { describe, expect, it } from "vitest";
import { calcularRoi, cifrasPermitidasRoi, validarTextoRoi } from "./roi";
import { construirCohorteDemo } from "./demo";
import type { RegistroPacienteAgregado } from "./agregacion";

const HOY = "2026-07-16";

describe("ROI: k-anonimato", () => {
  it("cohorte < 5 => suficiente:false (sin cifras)", () => {
    const pocos: RegistroPacienteAgregado[] = Array.from({ length: 4 }, (_, i) => ({
      pseudonimo: `P${i}`,
      programaClave: "mama_terapia_oral",
      pautas: [{ inicio: "2026-01-01", discontinuada: null, motivo: null }],
      tomas: [],
      checkinDias: ["2026-07-01"],
      alertas: [],
    }));
    expect(calcularRoi(pocos, HOY)).toEqual({ suficiente: false });
  });
});

describe("ROI: cálculo sobre la cohorte demo (10 pacientes)", () => {
  const demo = construirCohorteDemo(HOY);
  const m = calcularRoi(demo, HOY);

  it("es suficiente y cuenta 4 urgencias evitadas (proxy honesto)", () => {
    expect(m.suficiente).toBe(true);
    if (!m.suficiente) return;
    // resuelto_sin_evento sobre alertas contactar/urgencia: ONC-02, ONC-04, ONC-07, ONC-09.
    expect(m.urgenciasEvitadas).toBe(4);
    expect(m.n).toBe(10);
    expect(m.pacientesMes).toBeGreaterThan(0);
    expect(m.persistenciaPct).toBeGreaterThan(0);
    expect(m.persistenciaPct).toBeLessThanOrEqual(100);
  });
});

describe("ROI: el informe NO inventa cifras", () => {
  const demo = construirCohorteDemo(HOY);
  const m = calcularRoi(demo, HOY);

  it("una narrativa con SOLO cifras reales valida OK", () => {
    if (!m.suficiente) throw new Error("cohorte demo debería ser suficiente");
    const texto = [
      `Cohorte de ${m.n} pacientes (${m.pacientesMes} pacientes-mes observados).`,
      `Se registran ${m.urgenciasEvitadas} eventos resueltos sin evento clínico,`,
      `equivalentes a ${m.urgenciasEvitadas100} por 100 pacientes-mes.`,
      `Tasa de respuesta al check-in del ${m.tasaCheckin}% (benchmark 90%).`,
      `Persistencia del ${m.persistenciaPct}% al cierre del período.`,
    ].join(" ");
    expect(validarTextoRoi(texto, m)).toEqual({ ok: true });
  });

  it("una cifra inventada es DETECTADA y rechazada", () => {
    const texto = "Reducción del 73% en hospitalizaciones (cifra inventada).";
    const r = validarTextoRoi(texto, m);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.intrusas).toContain("73");
  });

  it("el conjunto de cifras permitidas incluye 5 (k), 90 (benchmark) y 100", () => {
    const permitidas = cifrasPermitidasRoi(m);
    expect(permitidas.has("5")).toBe(true);
    expect(permitidas.has("90")).toBe(true);
    expect(permitidas.has("100")).toBe(true);
  });
});
