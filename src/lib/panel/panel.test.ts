/**
 * Tests de la lógica PURA del panel profesional (WP-06).
 *
 * Sin Supabase: cubre la ordenación de la lista de pacientes (riesgo primero,
 * luego días sin check-in), la priorización de la bandeja de alertas
 * (urgencia > contactar > vigilancia, luego por fecha) y la generación del JSONB
 * de `reglas_escalado.condicion` desde las plantillas amigables, incluida la
 * comprobación de que el motor de WP-04 acepta y evalúa exactamente lo generado.
 */

import { describe, expect, it } from "vitest";
import {
  calcularEdad,
  diasSinCheckin,
  filtrarPacientes,
  nivelSemaforo,
  ordenarPacientes,
  type PacienteLista,
} from "./lista";
import {
  filtrarBandeja,
  ordenarBandeja,
  type AlertaBandeja,
} from "./bandeja";
import {
  construirReglaDesdePlantilla,
  describirCondicion,
} from "./reglas-plantillas";
import { evaluarReglas, parsearCondicion } from "@/lib/escalado/motor";

// --- Lista de pacientes ------------------------------------------------------

function pac(over: Partial<PacienteLista>): PacienteLista {
  return {
    id: over.id ?? "p",
    nombre: over.nombre ?? "Paciente",
    inicial: (over.nombre ?? "P")[0],
    avatarUrl: null,
    edad: over.edad ?? null,
    vertical: over.vertical ?? "general",
    adherencia7: over.adherencia7 ?? null,
    ultimoCheckin: over.ultimoCheckin ?? null,
    diasSinCheckin: over.diasSinCheckin ?? null,
    semaforo: over.semaforo ?? null,
  };
}

describe("lista — cálculos por paciente", () => {
  it("calcula la edad a partir de la fecha de nacimiento", () => {
    expect(calcularEdad("1958-04-12", "2026-07-16")).toBe(68);
    // Aún no ha cumplido este año.
    expect(calcularEdad("1958-08-01", "2026-07-16")).toBe(67);
    expect(calcularEdad(null, "2026-07-16")).toBeNull();
  });

  it("cuenta los días desde el último check-in", () => {
    expect(diasSinCheckin("2026-07-16", "2026-07-16")).toBe(0);
    expect(diasSinCheckin("2026-07-13", "2026-07-16")).toBe(3);
    expect(diasSinCheckin(null, "2026-07-16")).toBeNull();
  });

  it("el semáforo es el nivel de la alerta abierta más grave", () => {
    expect(
      nivelSemaforo([{ nivel: "vigilancia" }, { nivel: "urgencia" }, { nivel: "contactar" }]),
    ).toBe("urgencia");
    expect(nivelSemaforo([{ nivel: "vigilancia" }])).toBe("vigilancia");
    expect(nivelSemaforo([])).toBeNull();
  });
});

describe("ordenarPacientes — mayor riesgo primero, luego más días sin check-in", () => {
  it("ordena por gravedad del semáforo antes que por días", () => {
    const verdeMuchosDias = pac({ id: "a", nombre: "Ana", semaforo: null, diasSinCheckin: 30 });
    const urgencia1Dia = pac({ id: "b", nombre: "Beto", semaforo: "urgencia", diasSinCheckin: 1 });
    const contactar5 = pac({ id: "c", nombre: "Cira", semaforo: "contactar", diasSinCheckin: 5 });

    const orden = ordenarPacientes([verdeMuchosDias, urgencia1Dia, contactar5]).map((p) => p.id);
    expect(orden).toEqual(["b", "c", "a"]);
  });

  it("a igual semáforo, primero quien lleva más días sin check-in (nunca = máximo)", () => {
    const dias2 = pac({ id: "x", nombre: "X", semaforo: "vigilancia", diasSinCheckin: 2 });
    const dias9 = pac({ id: "y", nombre: "Y", semaforo: "vigilancia", diasSinCheckin: 9 });
    const nunca = pac({ id: "z", nombre: "Z", semaforo: "vigilancia", diasSinCheckin: null });

    const orden = ordenarPacientes([dias2, dias9, nunca]).map((p) => p.id);
    expect(orden).toEqual(["z", "y", "x"]);
  });

  it("no muta el array de entrada", () => {
    const entrada = [pac({ id: "a", semaforo: null }), pac({ id: "b", semaforo: "urgencia" })];
    const copia = [...entrada];
    ordenarPacientes(entrada);
    expect(entrada).toEqual(copia);
  });
});

describe("filtrarPacientes — búsqueda por nombre insensible a acentos", () => {
  const lista = [
    pac({ id: "1", nombre: "Luis" }),
    pac({ id: "2", nombre: "Carmen" }),
    pac({ id: "3", nombre: "José Ángel" }),
  ];
  it("encuentra ignorando mayúsculas y acentos", () => {
    expect(filtrarPacientes(lista, "jose angel").map((p) => p.id)).toEqual(["3"]);
    expect(filtrarPacientes(lista, "LU").map((p) => p.id)).toEqual(["1"]);
  });
  it("con consulta vacía devuelve todo", () => {
    expect(filtrarPacientes(lista, "  ")).toHaveLength(3);
  });
});

// --- Bandeja de alertas ------------------------------------------------------

function al(over: Partial<AlertaBandeja>): AlertaBandeja {
  return {
    id: over.id ?? "a",
    pacienteId: over.pacienteId ?? "p",
    nivel: over.nivel ?? "vigilancia",
    estado: over.estado ?? "nueva",
    motivo: over.motivo ?? "motivo",
    creadoEn: over.creadoEn ?? "2026-07-16T10:00:00Z",
  };
}

describe("ordenarBandeja — urgencia > contactar > vigilancia, luego por fecha", () => {
  it("prioriza por nivel y desempata por fecha (más reciente primero)", () => {
    const vig = al({ id: "vig", nivel: "vigilancia", creadoEn: "2026-07-16T12:00:00Z" });
    const urgVieja = al({ id: "urgV", nivel: "urgencia", creadoEn: "2026-07-10T09:00:00Z" });
    const urgNueva = al({ id: "urgN", nivel: "urgencia", creadoEn: "2026-07-16T09:00:00Z" });
    const cont = al({ id: "cont", nivel: "contactar", creadoEn: "2026-07-15T09:00:00Z" });

    const orden = ordenarBandeja([vig, urgVieja, urgNueva, cont]).map((a) => a.id);
    expect(orden).toEqual(["urgN", "urgV", "cont", "vig"]);
  });
});

describe("filtrarBandeja — por estado, nivel y paciente", () => {
  const base = [
    al({ id: "1", nivel: "urgencia", estado: "nueva", pacienteId: "luis" }),
    al({ id: "2", nivel: "contactar", estado: "resuelta", pacienteId: "luis" }),
    al({ id: "3", nivel: "contactar", estado: "nueva", pacienteId: "carmen" }),
  ];
  it("combina filtros", () => {
    expect(filtrarBandeja(base, { estado: "nueva" }).map((a) => a.id)).toEqual(["1", "3"]);
    expect(filtrarBandeja(base, { nivel: "contactar", pacienteId: "carmen" }).map((a) => a.id)).toEqual(["3"]);
    expect(filtrarBandeja(base, {})).toHaveLength(3);
  });
});

// --- Plantillas de reglas → JSONB de WP-04 -----------------------------------

describe("construirReglaDesdePlantilla — genera el JSONB de condición de WP-04", () => {
  it("dolor elevado → observacion dolor valor_num_gte", () => {
    const r = construirReglaDesdePlantilla({ plantilla: "dolor_alto", nivel: "contactar", umbral: 8 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regla.condicion).toEqual({ tipo: "observacion", dominio: "dolor", valor_num_gte: 8 });
    expect(r.regla.nivel).toBe("contactar");
    // El motor de WP-04 acepta la condición generada (round-trip por su validador Zod).
    expect(parsearCondicion(r.regla.condicion)).toEqual(r.regla.condicion);
  });

  it("omisión de medicación importante → adherencia_critica", () => {
    const r = construirReglaDesdePlantilla({ plantilla: "omision_critico", nivel: "contactar", dias: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regla.condicion).toEqual({ tipo: "adherencia_critica", dias_consecutivos: 2 });
    expect(parsearCondicion(r.regla.condicion)).not.toBeNull();
  });

  it("ánimo bajo sostenido → tendencia animo valor_num_lte + dias", () => {
    const r = construirReglaDesdePlantilla({ plantilla: "animo_bajo", nivel: "vigilancia", umbral: 3, dias: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.regla.condicion).toEqual({
      tipo: "tendencia",
      dominio: "animo",
      valor_num_lte: 3,
      dias_consecutivos: 3,
    });
    expect(parsearCondicion(r.regla.condicion)).not.toBeNull();
  });

  it("rechaza entradas inválidas sin lanzar", () => {
    expect(construirReglaDesdePlantilla({ plantilla: "inexistente" }).ok).toBe(false);
    expect(construirReglaDesdePlantilla({ plantilla: "dolor_alto", nivel: "contactar" }).ok).toBe(false);
    expect(
      construirReglaDesdePlantilla({ plantilla: "dolor_alto", nivel: "contactar", umbral: 99 }).ok,
    ).toBe(false);
  });

  it('la regla "dolor > 7" generada dispara con 8 pero no con 7 (semántica ≥ 8)', () => {
    const r = construirReglaDesdePlantilla({ plantilla: "dolor_alto", nivel: "contactar", umbral: 8 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cond = parsearCondicion(r.regla.condicion);
    expect(cond).not.toBeNull();
    if (cond === null) return;
    const regla = {
      id: "regla-luis-dolor",
      nombre: r.regla.nombre,
      nivel: r.regla.nivel,
      vertical: null,
      condicion: cond,
    };
    const base = { vertical: "cardiovascular", senales: [], historico: [], adherenciaCritica: [] };
    const con8 = evaluarReglas(
      { ...base, observaciones: [{ dominio: "dolor", codigo: "dolor_generalizado", valorNum: 8 }] },
      [regla],
    );
    const con7 = evaluarReglas(
      { ...base, observaciones: [{ dominio: "dolor", codigo: "dolor_generalizado", valorNum: 7 }] },
      [regla],
    );
    expect(con8.nivel).toBe("contactar");
    expect(con7.nivel).toBe("normal");
  });
});

describe("describirCondicion — camino inverso a lenguaje llano", () => {
  it("describe cada tipo de condición de WP-04", () => {
    expect(
      describirCondicion({ tipo: "observacion", dominio: "dolor", valor_num_gte: 9 }),
    ).toContain("dolor");
    expect(describirCondicion({ tipo: "adherencia_critica", dias_consecutivos: 2 })).toContain(
      "medicación importante",
    );
    expect(
      describirCondicion({ tipo: "tendencia", dominio: "animo", valor_num_lte: 3, dias_consecutivos: 3 }),
    ).toContain("ánimo");
    const combo = describirCondicion({
      tipo: "combinacion",
      todas: [
        { tipo: "observacion", dominio: "sintoma_fisico", codigo: "dolor_toracico" },
        { tipo: "observacion", dominio: "sintoma_fisico", codigo: "disnea" },
      ],
    });
    expect(combo).toContain("y");
  });
});
