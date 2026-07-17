/**
 * Tests del check-in DIRIGIDO POR PROGRAMA (WP-11 v2 §A.4).
 *
 * PURO: `construirInstrucciones` es una función pura. Verifica que un programa
 * activo inyecta la sección `# PROGRAMA` (estilo + preguntas extra + vocabulario)
 * y acota los dominios de la checklist a su subconjunto; y que SIN programa el
 * comportamiento es el de F1 (los 7 dominios, sin sección de programa).
 */

import { describe, expect, it } from "vitest";
import {
  construirInstrucciones,
  type ContextoCheckin,
  type ProgramaContexto,
} from "./conversacion";

function contextoBase(programa: ProgramaContexto | null): ContextoCheckin {
  return {
    pacienteId: "p1",
    nombre: "Ana",
    edad: 54,
    vertical: "general",
    condiciones: ["Cáncer de mama"],
    zonaHoraria: "Europe/Madrid",
    fechaHoy: "2026-07-16",
    pautasHoy: [],
    resumenUltimoCheckin: null,
    observacionesRecientes: [],
    dominiosCubiertos: [],
    programa,
  };
}

const PROGRAMA_ORAL: ProgramaContexto = {
  clave: "mama_terapia_oral",
  nombre: "Mama · Terapia oral",
  dominios: ["adherencia", "sintomas_fisicos", "animo"],
  preguntasExtra: [
    { clave: "fiebre", texto: "¿Te has tomado la temperatura? ¿Has tenido fiebre?", dominio: "sintomas_fisicos" },
    { clave: "diarrea", texto: "¿Has tenido diarrea?", dominio: "sintomas_fisicos" },
  ],
  estilo: { ritmo: "calmado", frases_cortas: true, repeticion: false },
  guiaVocabulario: "Usa el código fiebre en grados Celsius.",
};

describe("construirInstrucciones — dirigido por programa", () => {
  it("incluye la sección # PROGRAMA con nombre, estilo y preguntas extra", () => {
    const prompt = construirInstrucciones(contextoBase(PROGRAMA_ORAL));
    expect(prompt).toContain("# PROGRAMA de seguimiento: Mama · Terapia oral");
    expect(prompt).toContain("ritmo pausado");
    expect(prompt).toContain("¿Te has tomado la temperatura?");
    expect(prompt).toContain("¿Has tenido diarrea?");
    expect(prompt).toContain("grados Celsius");
  });

  it("acota los dominios PENDIENTES al subconjunto del programa", () => {
    const prompt = construirInstrucciones(contextoBase(PROGRAMA_ORAL));
    // Los del programa aparecen como pendientes...
    expect(prompt).toContain("adherencia:");
    expect(prompt).toContain("sintomas_fisicos:");
    expect(prompt).toContain("animo:");
    // ...y los que el programa NO activa, no (p. ej. cognicion, habitos, dolor).
    expect(prompt).not.toContain("cognicion:");
    expect(prompt).not.toContain("habitos:");
    expect(prompt).not.toContain("tratamiento:");
  });

  it("respeta los dominios ya cubiertos dentro del subconjunto", () => {
    const ctx = contextoBase(PROGRAMA_ORAL);
    ctx.dominiosCubiertos = ["adherencia"];
    const prompt = construirInstrucciones(ctx);
    // 'adherencia' pasa a "ya cubiertos" (no se vuelve a preguntar).
    const idxPendientes = prompt.indexOf("Dominios PENDIENTES");
    const idxHechos = prompt.indexOf("Dominios YA cubiertos");
    const seccionPendientes = prompt.slice(idxPendientes, idxHechos);
    expect(seccionPendientes).not.toContain("adherencia:");
    expect(prompt.slice(idxHechos)).toContain("adherencia");
  });
});

describe("construirInstrucciones — sin programa (F1 intacto)", () => {
  it("no añade la sección # PROGRAMA y recorre los 7 dominios", () => {
    const prompt = construirInstrucciones(contextoBase(null));
    expect(prompt).not.toContain("# PROGRAMA");
    for (const d of [
      "adherencia:",
      "dolor:",
      "sintomas_fisicos:",
      "animo:",
      "cognicion:",
      "tratamiento:",
      "habitos:",
    ]) {
      expect(prompt).toContain(d);
    }
  });

  it("comportamiento idéntico con programa ausente (undefined) que con null", () => {
    const conNull = construirInstrucciones(contextoBase(null));
    const ctxSinCampo = contextoBase(null);
    delete ctxSinCampo.programa;
    const sinCampo = construirInstrucciones(ctxSinCampo);
    expect(sinCampo).toBe(conNull);
  });
});
