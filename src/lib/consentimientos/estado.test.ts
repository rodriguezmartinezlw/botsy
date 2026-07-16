/**
 * Tests del estado vigente de consentimientos (WP-07).
 *
 * Demuestran los criterios de aceptación (c):
 *  - un paciente NUEVO (sin filas) NO puede conversar (iniciar check-in);
 *  - al OTORGAR `conversacion`, sí puede;
 *  - al REVOCAR `conversacion`, deja de poder;
 *  - REVOCAR `voz_grabacion` hace que la siguiente sesión de voz NO grabe
 *    (integración con WP-03: la ruta de voz recalcula el vigente en cada sesión).
 */

import { describe, expect, it } from "vitest";
import {
  debeGrabarVoz,
  estadoVigenteConsentimientos,
  puedeConversar,
  type FilaConsentimiento,
} from "./estado";

const T = (n: number) => `2026-07-15T10:0${n}:00Z`;

describe("estadoVigenteConsentimientos", () => {
  it("paciente nuevo (sin filas) tiene todo a false", () => {
    const estado = estadoVigenteConsentimientos([]);
    expect(estado).toEqual({
      conversacion: false,
      voz_grabacion: false,
      voz_biomarcadores: false,
    });
  });

  it("el último registro por tipo gana, aunque el orden de entrada sea arbitrario", () => {
    const filas: FilaConsentimiento[] = [
      { tipo: "conversacion", otorgado: false, registrado_en: T(2) },
      { tipo: "conversacion", otorgado: true, registrado_en: T(1) },
      { tipo: "voz_grabacion", otorgado: true, registrado_en: T(1) },
    ];
    const estado = estadoVigenteConsentimientos(filas);
    // conversacion: la más reciente (T2) es false.
    expect(estado.conversacion).toBe(false);
    expect(estado.voz_grabacion).toBe(true);
  });
});

describe("puedeConversar (gating del check-in)", () => {
  it("paciente nuevo sin consentimiento NO puede iniciar check-in", () => {
    expect(puedeConversar(estadoVigenteConsentimientos([]))).toBe(false);
  });

  it("al otorgar `conversacion`, SÍ puede", () => {
    const filas: FilaConsentimiento[] = [
      { tipo: "conversacion", otorgado: true, registrado_en: T(1) },
    ];
    expect(puedeConversar(estadoVigenteConsentimientos(filas))).toBe(true);
  });

  it("al revocar `conversacion`, deja de poder", () => {
    const filas: FilaConsentimiento[] = [
      { tipo: "conversacion", otorgado: true, registrado_en: T(1) },
      { tipo: "conversacion", otorgado: false, registrado_en: T(2) },
    ];
    expect(puedeConversar(estadoVigenteConsentimientos(filas))).toBe(false);
  });
});

describe("debeGrabarVoz (integración con WP-03)", () => {
  it("no graba sin consentimiento de grabación", () => {
    const filas: FilaConsentimiento[] = [
      { tipo: "conversacion", otorgado: true, registrado_en: T(1) },
    ];
    expect(debeGrabarVoz(estadoVigenteConsentimientos(filas))).toBe(false);
  });

  it("graba con `voz_grabacion` otorgado", () => {
    const filas: FilaConsentimiento[] = [
      { tipo: "conversacion", otorgado: true, registrado_en: T(1) },
      { tipo: "voz_grabacion", otorgado: true, registrado_en: T(1) },
    ];
    expect(debeGrabarVoz(estadoVigenteConsentimientos(filas))).toBe(true);
  });

  it("revocar `voz_grabacion` impide grabar en la siguiente sesión de voz", () => {
    const filas: FilaConsentimiento[] = [
      { tipo: "conversacion", otorgado: true, registrado_en: T(1) },
      { tipo: "voz_grabacion", otorgado: true, registrado_en: T(1) },
      { tipo: "voz_grabacion", otorgado: false, registrado_en: T(3) },
    ];
    const estado = estadoVigenteConsentimientos(filas);
    // Puede seguir conversando por voz, pero YA NO se graba.
    expect(puedeConversar(estado)).toBe(true);
    expect(debeGrabarVoz(estado)).toBe(false);
  });
});
