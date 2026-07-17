/**
 * Test de la regla de escalado por DISTRÉS (WP-16) en el motor determinista.
 *
 * La condición replica EXACTAMENTE el JSONB de `escalado.reglas_clave` que la
 * migración 0011 añade a los programas de mama: cuando el programa se asigna, se
 * materializa como una fila de `reglas_escalado`. Aquí se evalúa tal cual para
 * demostrar que la puntuación del termómetro dispara `contactar` a partir del
 * umbral y no por debajo. Umbral >= 4 [PENDIENTE CLÍNICO].
 */

import { describe, expect, it } from "vitest";
import {
  evaluarReglas,
  parsearCondicion,
  type DatosEvaluacion,
  type ReglaEvaluable,
} from "./motor";

const CONDICION_DISTRES = {
  tipo: "instrumento",
  instrumento: "termometro_distres_nccn",
  puntuacion_gte: 4,
};

function reglaDistres(): ReglaEvaluable {
  const c = parsearCondicion(CONDICION_DISTRES as never);
  if (!c) throw new Error("condición de distrés inválida");
  return {
    id: "distres_termometro",
    nombre: "Distrés elevado (Termómetro NCCN)",
    nivel: "contactar",
    vertical: null,
    condicion: c,
  };
}

function datos(puntuacion: number | null): DatosEvaluacion {
  return {
    vertical: null,
    observaciones: [],
    senales: [],
    historico: [],
    adherenciaCritica: [],
    instrumentos:
      puntuacion === null
        ? []
        : [{ instrumento: "termometro_distres_nccn", puntuacion }],
  };
}

describe("la condición `instrumento` valida contra el esquema del motor", () => {
  it("parsea la condición del seed 0011", () => {
    expect(parsearCondicion(CONDICION_DISTRES as never)).not.toBeNull();
  });
});

describe("umbral de distrés → contactar", () => {
  it("puntuación 4 (umbral inclusivo) → contactar", () => {
    const r = evaluarReglas(datos(4), [reglaDistres()]);
    expect(r.nivel).toBe("contactar");
    expect(r.reglasDisparadas).toHaveLength(1);
  });

  it("puntuación 8 → contactar", () => {
    expect(evaluarReglas(datos(8), [reglaDistres()]).nivel).toBe("contactar");
  });

  it("puntuación 3 (por debajo del umbral) → normal, no dispara", () => {
    const r = evaluarReglas(datos(3), [reglaDistres()]);
    expect(r.nivel).toBe("normal");
    expect(r.reglasDisparadas).toHaveLength(0);
  });

  it("sin respuesta del termómetro → normal", () => {
    expect(evaluarReglas(datos(null), [reglaDistres()]).nivel).toBe("normal");
  });

  it("otro instrumento con la misma puntuación no cuenta", () => {
    const r = evaluarReglas(
      {
        ...datos(null),
        instrumentos: [{ instrumento: "otro_instrumento", puntuacion: 9 }],
      },
      [reglaDistres()],
    );
    expect(r.nivel).toBe("normal");
  });
});
