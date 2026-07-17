/**
 * Tests del instrumento Termómetro de Distrés NCCN (WP-16). PURO.
 *
 * Cubre: la decisión de FRECUENCIA (cuándo toca preguntar), la SERIE temporal
 * del panel y los PROBLEMAS más frecuentes, más la versión trazada. Umbral y
 * versión [PENDIENTE CLÍNICO].
 */

import { describe, expect, it } from "vitest";
import { rangoPeriodo } from "@/lib/agregados";
import {
  CODIGOS_PROBLEMAS_NCCN,
  etiquetaProblema,
  problemasFrecuentes,
  serieDistres,
  tocaInstrumento,
  UMBRAL_DISTRES_REFERENCIA,
  versionInstrumento,
  VERSION_TERMOMETRO_DISTRES_DEFECTO,
  type RespuestaDistres,
} from "./termometro";

// --- Frecuencia: ¿toca preguntar hoy? ---------------------------------------

describe("tocaInstrumento — la frecuencia decide cuándo preguntar", () => {
  it("frecuencia 'ninguna' nunca toca", () => {
    expect(tocaInstrumento("ninguna", null, "2026-07-16")).toBe(false);
    expect(tocaInstrumento("ninguna", "2026-07-01", "2026-07-16")).toBe(false);
  });

  it("sin registro previo, toca en la primera administración", () => {
    expect(tocaInstrumento("semanal", null, "2026-07-16")).toBe(true);
    expect(tocaInstrumento("quincenal", null, "2026-07-16")).toBe(true);
  });

  it("semanal: no toca antes de 7 días, sí al 7º", () => {
    // último = 10; hoy = 16 → 6 días → aún no.
    expect(tocaInstrumento("semanal", "2026-07-10", "2026-07-16")).toBe(false);
    // hoy = 17 → 7 días → toca.
    expect(tocaInstrumento("semanal", "2026-07-10", "2026-07-17")).toBe(true);
  });

  it("quincenal: no toca antes de 14 días, sí al 14º", () => {
    expect(tocaInstrumento("quincenal", "2026-07-03", "2026-07-16")).toBe(false); // 13
    expect(tocaInstrumento("quincenal", "2026-07-03", "2026-07-17")).toBe(true); // 14
  });
});

// --- Serie temporal del panel ------------------------------------------------

describe("serieDistres — serie densa 0–10 para el panel", () => {
  const hoy = "2026-07-16";
  const rango = rangoPeriodo("semana", hoy); // 7 días [10..16]

  it("un punto por día del rango; null los días sin registro; promedia el día", () => {
    const respuestas: RespuestaDistres[] = [
      { fecha: "2026-07-11", puntuacion: 4, problemas: [] },
      { fecha: "2026-07-16", puntuacion: 8, problemas: [] },
      { fecha: "2026-07-16", puntuacion: 6, problemas: [] }, // mismo día → media 7
    ];
    const serie = serieDistres(respuestas, rango);
    expect(serie).toHaveLength(7);
    expect(serie[0]).toEqual({ fecha: "2026-07-10", valor: null });
    expect(serie.find((p) => p.fecha === "2026-07-11")?.valor).toBe(4);
    expect(serie.find((p) => p.fecha === "2026-07-16")?.valor).toBe(7);
  });

  it("ignora registros fuera del rango", () => {
    const serie = serieDistres(
      [{ fecha: "2026-06-01", puntuacion: 9, problemas: [] }],
      rango,
    );
    expect(serie.every((p) => p.valor === null)).toBe(true);
  });
});

// --- Problemas más frecuentes ------------------------------------------------

describe("problemasFrecuentes — recuento y etiquetas", () => {
  it("cuenta una vez por respuesta y ordena de más a menos frecuente", () => {
    const respuestas: RespuestaDistres[] = [
      { fecha: "2026-07-01", puntuacion: 6, problemas: ["miedo", "preocupacion"] },
      { fecha: "2026-07-08", puntuacion: 7, problemas: ["preocupacion", "preocupacion"] },
      { fecha: "2026-07-15", puntuacion: 5, problemas: ["preocupacion", "fatiga_prob"] },
    ];
    const top = problemasFrecuentes(respuestas);
    expect(top[0].codigo).toBe("preocupacion");
    expect(top[0].recuento).toBe(3); // en las 3 respuestas (dedup dentro de cada una)
    expect(top[0].etiqueta).toBe("Preocupación");
    expect(top.map((p) => p.codigo)).toContain("miedo");
    expect(top.map((p) => p.codigo)).toContain("fatiga_prob");
  });

  it("respeta el límite pedido", () => {
    const respuestas: RespuestaDistres[] = [
      {
        fecha: "2026-07-01",
        puntuacion: 8,
        problemas: [...CODIGOS_PROBLEMAS_NCCN],
      },
    ];
    expect(problemasFrecuentes(respuestas, 3)).toHaveLength(3);
  });
});

// --- Versión trazada + referencias -------------------------------------------

describe("identidad del instrumento", () => {
  it("la versión por defecto está marcada [PENDIENTE CLÍNICO] y es la trazada sin env", () => {
    expect(VERSION_TERMOMETRO_DISTRES_DEFECTO).toContain("PENDIENTE_CLINICO");
    expect(versionInstrumento("termometro_distres_nccn")).toBe(
      process.env.TERMOMETRO_DISTRES_VERSION?.trim() ||
        VERSION_TERMOMETRO_DISTRES_DEFECTO,
    );
  });

  it("umbral de referencia NCCN = 4 y etiquetas legibles", () => {
    expect(UMBRAL_DISTRES_REFERENCIA).toBe(4);
    expect(etiquetaProblema("preocupacion")).toBe("Preocupación");
    expect(etiquetaProblema("codigo_desconocido")).toBe("codigo desconocido");
  });
});
