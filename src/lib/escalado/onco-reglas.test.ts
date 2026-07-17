/**
 * Tests de las reglas de escalado ONCOLÓGICAS (WP-11 v2 §C.3) en el motor
 * determinista de WP-04. PURO (`evaluarReglas`).
 *
 * Las condiciones replican EXACTAMENTE el JSONB de `escalado.reglas_clave` del
 * seed de programas (`0006_programas.sql`). Cuando el programa se asigna a un
 * paciente, esas condiciones se materializan como filas de `reglas_escalado`;
 * aquí se evalúan tal cual para demostrar que disparan el nivel correcto.
 *
 * Umbrales [PENDIENTE CLÍNICO] (revisables tras la llamada 1).
 */

import { describe, expect, it } from "vitest";
import {
  evaluarReglas,
  parsearCondicion,
  type DatosEvaluacion,
  type ReglaEvaluable,
} from "./motor";

function regla(
  nombre: string,
  nivel: ReglaEvaluable["nivel"],
  condicion: unknown,
): ReglaEvaluable {
  const c = parsearCondicion(condicion as never);
  if (!c) throw new Error(`condición inválida: ${JSON.stringify(condicion)}`);
  return { id: nombre, nombre, nivel, vertical: null, condicion: c };
}

// Reglas materializadas por el programa mama_tratamiento_activo.
const FIEBRE_ACTIVO = regla("Fiebre en tratamiento activo", "urgencia", {
  tipo: "observacion",
  dominio: "sintoma_fisico",
  codigo: "fiebre",
  valor_num_gte: 38,
});
// Reglas materializadas por el programa mama_terapia_oral (misma condición, nivel menor).
const FIEBRE_ORAL = regla("Fiebre en terapia oral", "contactar", {
  tipo: "observacion",
  dominio: "sintoma_fisico",
  codigo: "fiebre",
  valor_num_gte: 38,
});
const DIARREA = regla("Diarrea intensa", "contactar", {
  tipo: "observacion",
  dominio: "sintoma_fisico",
  codigo: "diarrea",
  valor_num_gte: 7,
});
const DOLOR_SOSTENIDO = regla("Dolor alto sostenido", "contactar", {
  tipo: "tendencia",
  dominio: "dolor",
  valor_num_gte: 7,
  dias_consecutivos: 2,
});

function datos(
  observaciones: DatosEvaluacion["observaciones"],
  historico: DatosEvaluacion["historico"] = [],
): DatosEvaluacion {
  return {
    vertical: null,
    observaciones,
    senales: [],
    historico,
    adherenciaCritica: [],
  };
}

describe("Fiebre en tratamiento activo → URGENCIA", () => {
  it("fiebre 38.5 → urgencia", () => {
    const r = evaluarReglas(
      datos([{ dominio: "sintoma_fisico", codigo: "fiebre", valorNum: 38.5 }]),
      [FIEBRE_ACTIVO],
    );
    expect(r.nivel).toBe("urgencia");
    expect(r.reglasDisparadas).toHaveLength(1);
  });

  it("fiebre 37.5 → nada (por debajo del umbral 38)", () => {
    const r = evaluarReglas(
      datos([{ dominio: "sintoma_fisico", codigo: "fiebre", valorNum: 37.5 }]),
      [FIEBRE_ACTIVO],
    );
    expect(r.nivel).toBe("normal");
    expect(r.reglasDisparadas).toHaveLength(0);
  });

  it("fiebre exactamente 38 → urgencia (umbral inclusivo)", () => {
    const r = evaluarReglas(
      datos([{ dominio: "sintoma_fisico", codigo: "fiebre", valorNum: 38 }]),
      [FIEBRE_ACTIVO],
    );
    expect(r.nivel).toBe("urgencia");
  });
});

describe("Fiebre en terapia oral → CONTACTAR (mismo umbral, menor nivel)", () => {
  it("fiebre 38.4 → contactar", () => {
    const r = evaluarReglas(
      datos([{ dominio: "sintoma_fisico", codigo: "fiebre", valorNum: 38.4 }]),
      [FIEBRE_ORAL],
    );
    expect(r.nivel).toBe("contactar");
  });
});

describe("Otras reglas oncológicas", () => {
  it("diarrea intensa (>=7) → contactar", () => {
    const r = evaluarReglas(
      datos([{ dominio: "sintoma_fisico", codigo: "diarrea", valorNum: 8 }]),
      [DIARREA],
    );
    expect(r.nivel).toBe("contactar");
  });

  it("diarrea leve (3) → nada", () => {
    const r = evaluarReglas(
      datos([{ dominio: "sintoma_fisico", codigo: "diarrea", valorNum: 3 }]),
      [DIARREA],
    );
    expect(r.nivel).toBe("normal");
  });

  it("dolor >=7 sostenido 2 días → contactar", () => {
    const r = evaluarReglas(
      datos(
        [{ dominio: "dolor", codigo: "dolor", valorNum: 8 }],
        [
          { fecha: "2026-07-15", dominio: "dolor", valorNum: 8 },
          { fecha: "2026-07-16", dominio: "dolor", valorNum: 7 },
        ],
      ),
      [DOLOR_SOSTENIDO],
    );
    expect(r.nivel).toBe("contactar");
  });

  it("dolor alto un solo día → aún no dispara la tendencia", () => {
    const r = evaluarReglas(
      datos(
        [{ dominio: "dolor", codigo: "dolor", valorNum: 8 }],
        [{ fecha: "2026-07-16", dominio: "dolor", valorNum: 8 }],
      ),
      [DOLOR_SOSTENIDO],
    );
    expect(r.nivel).toBe("normal");
  });
});
