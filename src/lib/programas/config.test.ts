/**
 * Tests del módulo de configuración de programas (WP-11 v2 §A.2).
 *
 * PURO: sin Supabase ni red. Cubre el criterio de aceptación "merge de config
 * plantilla+override e inválido→fallback" y la idempotencia de la selección de
 * reglas clave.
 */

import { describe, expect, it } from "vitest";
import {
  CONFIG_POR_DEFECTO,
  configEfectiva,
  deepMerge,
  parsearConfigPrograma,
  reglasClavePendientes,
  clavesReglasPrograma,
  type ConfigPrograma,
} from "./config";

describe("configEfectiva — merge plantilla + override", () => {
  it("sin plantilla ni override devuelve la config por defecto (F1 intacto)", () => {
    const r = configEfectiva({}, {});
    expect(r.origen).toBe("efectiva");
    expect(r.config).toEqual(CONFIG_POR_DEFECTO);
    expect(r.config.checkin.dominios).toHaveLength(7);
  });

  it("aplica una plantilla parcial sobre el default (deep-merge)", () => {
    const plantilla = {
      checkin: {
        frecuencia: "diaria",
        dominios: ["adherencia", "sintomas_fisicos", "animo"],
        preguntas_extra: [
          { clave: "fiebre", texto: "¿Fiebre?", dominio: "sintomas_fisicos" },
        ],
        estilo: { ritmo: "calmado", frases_cortas: true, repeticion: false },
      },
    };
    const r = configEfectiva(plantilla, {});
    expect(r.origen).toBe("efectiva");
    // Lo tocado por la plantilla gana...
    expect(r.config.checkin.dominios).toEqual([
      "adherencia",
      "sintomas_fisicos",
      "animo",
    ]);
    expect(r.config.checkin.preguntas_extra[0].clave).toBe("fiebre");
    // ...y lo NO tocado conserva el default.
    expect(r.config.modulos).toEqual(CONFIG_POR_DEFECTO.modulos);
    expect(r.config.instrumentos).toEqual(CONFIG_POR_DEFECTO.instrumentos);
  });

  it("el override del paciente gana sobre la plantilla (p. ej. apagar voz)", () => {
    const plantilla = { modulos: { voz: true, texto: true, recomendaciones: true } };
    const override = { modulos: { voz: false } };
    const r = configEfectiva(plantilla, override);
    expect(r.origen).toBe("efectiva");
    expect(r.config.modulos.voz).toBe(false);
    expect(r.config.modulos.texto).toBe(true); // no tocado por el override
  });

  it("un override que reemplaza un array lo sustituye entero (no lo fusiona)", () => {
    const plantilla = {
      checkin: {
        frecuencia: "diaria",
        dominios: ["adherencia", "dolor", "animo"],
        preguntas_extra: [],
        estilo: { ritmo: "normal", frases_cortas: true, repeticion: false },
      },
    };
    const override = { checkin: { dominios: ["adherencia"] } };
    const r = configEfectiva(plantilla, override);
    expect(r.config.checkin.dominios).toEqual(["adherencia"]);
  });
});

describe("configEfectiva — fallback seguro ante config inválida", () => {
  it("un override INVÁLIDO se descarta y cae al nivel plantilla", () => {
    const plantilla = {
      checkin: {
        frecuencia: "diaria",
        dominios: ["adherencia", "animo"],
        preguntas_extra: [],
        estilo: { ritmo: "calmado", frases_cortas: true, repeticion: false },
      },
    };
    // frecuencia fuera del enum -> el merge no valida.
    const override = { checkin: { frecuencia: "cada_hora" } };
    const r = configEfectiva(plantilla, override);
    expect(r.origen).toBe("plantilla");
    expect(r.config.checkin.dominios).toEqual(["adherencia", "animo"]); // de la plantilla
    expect(r.config.checkin.frecuencia).toBe("diaria");
  });

  it("una plantilla INVÁLIDA cae a la config por defecto", () => {
    // dominios con un valor que no es de la checklist -> ni plantilla valida.
    const plantilla = { checkin: { dominios: ["no_existe"] } };
    const r = configEfectiva(plantilla, {});
    expect(r.origen).toBe("defecto");
    expect(r.config).toEqual(CONFIG_POR_DEFECTO);
  });

  it("nunca lanza aunque la entrada sea basura (null / string / número)", () => {
    expect(() => configEfectiva(null, "basura")).not.toThrow();
    expect(configEfectiva(null, 42).config).toEqual(CONFIG_POR_DEFECTO);
    expect(configEfectiva("x", ["y"]).origen).toBe("defecto");
  });
});

describe("deepMerge", () => {
  it("fusiona objetos anidados y reemplaza escalares/arrays", () => {
    const base = { a: 1, b: { c: 2, d: 3 }, e: [1, 2] };
    const over = { b: { c: 9 }, e: [7] };
    expect(deepMerge(base, over)).toEqual({ a: 1, b: { c: 9, d: 3 }, e: [7] });
  });

  it("un lado no-objeto reemplaza al otro", () => {
    expect(deepMerge({ a: 1 }, 5)).toBe(5);
    expect(deepMerge(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(deepMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});

describe("reglasClavePendientes — activación idempotente", () => {
  const config: ConfigPrograma = parsearConfigPrograma({
    ...CONFIG_POR_DEFECTO,
    escalado: {
      reglas_clave: [
        {
          clave: "fiebre_activo",
          nombre: "Fiebre",
          nivel: "urgencia",
          condicion: {
            tipo: "observacion",
            dominio: "sintoma_fisico",
            codigo: "fiebre",
            valor_num_gte: 38,
          },
        },
        {
          clave: "diarrea_intensa",
          nombre: "Diarrea",
          nivel: "contactar",
          condicion: {
            tipo: "observacion",
            dominio: "sintoma_fisico",
            codigo: "diarrea",
            valor_num_gte: 7,
          },
        },
      ],
    },
  })!;

  it("con 0 reglas existentes, devuelve TODAS las del programa", () => {
    expect(reglasClavePendientes(config, []).map((r) => r.clave)).toEqual([
      "fiebre_activo",
      "diarrea_intensa",
    ]);
  });

  it("con alguna ya materializada, devuelve solo las que faltan (idempotente)", () => {
    expect(
      reglasClavePendientes(config, ["fiebre_activo"]).map((r) => r.clave),
    ).toEqual(["diarrea_intensa"]);
  });

  it("con todas materializadas, no reinserta nada (idempotente)", () => {
    expect(
      reglasClavePendientes(config, ["fiebre_activo", "diarrea_intensa"]),
    ).toEqual([]);
  });

  it("clavesReglasPrograma lista todas las claves para desactivar al suspender", () => {
    expect(clavesReglasPrograma(config)).toEqual([
      "fiebre_activo",
      "diarrea_intensa",
    ]);
  });
});
