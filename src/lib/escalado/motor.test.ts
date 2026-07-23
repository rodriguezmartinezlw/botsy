/**
 * Tests del motor de escalado (WP-04).
 *
 * No requiere Supabase ni OpenAI: `evaluarReglas` es PURO y `aplicarEscalado`
 * trabaja contra un puerto en memoria. Cubre los 5 escenarios de las reglas
 * semilla de `0003_reglas_semilla.sql` (con su JSONB literal), una combinación
 * que NO dispara, el filtro por vertical, la idempotencia de las acciones, la
 * evaluación en vivo de señales y una demostración E2E (dolor torácico + disnea
 * → urgencia + alerta con evidencia + auditoría).
 */

import { describe, expect, it } from "vitest";
import type { Json, NivelRiesgo } from "@/types/db";
import {
  evaluarReglas,
  parsearCondicion,
  type Condicion,
  type DatosEvaluacion,
  type EvaluacionCheckin,
  type ReglaEvaluable,
} from "./motor";
import {
  aplicarEscalado,
  aplicarEscaladoSenalGenerica,
  type AlertaNueva,
  type EventoEscalado,
  type RepositorioAcciones,
} from "./acciones";
import { evaluarSenal, type ReglaSenal } from "./senales";
import { TEXTOS_URGENCIA, TEXTOS_CONTACTAR } from "./textos";

// --- Reglas semilla (JSONB literal de 0003_reglas_semilla.sql) ---------------

function cond(obj: Json): Condicion {
  const c = parsearCondicion(obj);
  if (c === null) throw new Error(`condición inválida: ${JSON.stringify(obj)}`);
  return c;
}

const REGLA_TORACICO_DISNEA: ReglaEvaluable = {
  id: "regla-1",
  nombre: "Dolor torácico con disnea",
  nivel: "urgencia",
  vertical: "cardiovascular",
  condicion: cond({
    tipo: "combinacion",
    todas: [
      {
        tipo: "observacion",
        dominio: "sintoma_fisico",
        codigo: "dolor_toracico",
      },
      { tipo: "observacion", dominio: "sintoma_fisico", codigo: "disnea" },
    ],
  }),
};

const REGLA_IDEACION: ReglaEvaluable = {
  id: "regla-2",
  nombre: "Ideación autolítica",
  nivel: "urgencia",
  vertical: null,
  condicion: cond({ tipo: "senal", codigo: "ideacion_autolitica" }),
};

const REGLA_DOLOR_INTENSO: ReglaEvaluable = {
  id: "regla-3",
  nombre: "Dolor intenso",
  nivel: "contactar",
  vertical: null,
  condicion: cond({ tipo: "observacion", dominio: "dolor", valor_num_gte: 9 }),
};

const REGLA_FARMACO: ReglaEvaluable = {
  id: "regla-4",
  nombre: "Fármaco crítico omitido",
  nivel: "contactar",
  vertical: null,
  condicion: cond({ tipo: "adherencia_critica", dias_consecutivos: 2 }),
};

const REGLA_ANIMO: ReglaEvaluable = {
  id: "regla-5",
  nombre: "Ánimo bajo sostenido",
  nivel: "vigilancia",
  vertical: null,
  condicion: cond({
    tipo: "tendencia",
    dominio: "animo",
    valor_num_lte: 3,
    dias_consecutivos: 3,
  }),
};

const TODAS_LAS_REGLAS = [
  REGLA_TORACICO_DISNEA,
  REGLA_IDEACION,
  REGLA_DOLOR_INTENSO,
  REGLA_FARMACO,
  REGLA_ANIMO,
];

function datos(overrides: Partial<DatosEvaluacion> = {}): DatosEvaluacion {
  return {
    vertical: "cardiovascular",
    observaciones: [],
    senales: [],
    historico: [],
    adherenciaCritica: [],
    ...overrides,
  };
}

// --- Los 5 escenarios de las reglas semilla ----------------------------------

describe("evaluarReglas — escenarios de las reglas semilla (0003)", () => {
  it("1) dolor torácico + disnea en cardiovascular → urgencia", () => {
    const d = datos({
      vertical: "cardiovascular",
      observaciones: [
        { dominio: "sintoma_fisico", codigo: "dolor_toracico", valorNum: null },
        { dominio: "sintoma_fisico", codigo: "disnea", valorNum: null },
      ],
    });
    const r = evaluarReglas(d, TODAS_LAS_REGLAS);
    expect(r.nivel).toBe("urgencia");
    expect(r.reglasDisparadas).toHaveLength(1);
    expect(r.reglasDisparadas[0].nombre).toBe("Dolor torácico con disnea");
    // La evidencia incluye las dos observaciones implicadas.
    const codigos = r.reglasDisparadas[0].evidencia.observaciones.map(
      (o) => o.codigo,
    );
    expect(codigos).toEqual(
      expect.arrayContaining(["dolor_toracico", "disnea"]),
    );
  });

  it("2) señal de ideación autolítica → urgencia", () => {
    const d = datos({ vertical: "general", senales: ["ideacion_autolitica"] });
    const r = evaluarReglas(d, TODAS_LAS_REGLAS);
    expect(r.nivel).toBe("urgencia");
    expect(r.reglasDisparadas.map((x) => x.nombre)).toContain(
      "Ideación autolítica",
    );
  });

  it("3) dolor con valor_num >= 9 → contactar", () => {
    const d = datos({
      vertical: "general",
      observaciones: [
        { dominio: "dolor", codigo: "dolor_generalizado", valorNum: 9 },
      ],
    });
    const r = evaluarReglas(d, TODAS_LAS_REGLAS);
    expect(r.nivel).toBe("contactar");
    expect(r.reglasDisparadas).toHaveLength(1);
    expect(r.reglasDisparadas[0].nombre).toBe("Dolor intenso");
  });

  it("3b) dolor con valor_num = 8 NO dispara", () => {
    const d = datos({
      vertical: "general",
      observaciones: [
        { dominio: "dolor", codigo: "dolor_generalizado", valorNum: 8 },
      ],
    });
    expect(evaluarReglas(d, TODAS_LAS_REGLAS).nivel).toBe("normal");
  });

  it("4) fármaco crítico omitido 2 días consecutivos → contactar", () => {
    const d = datos({
      vertical: "cardiovascular",
      adherenciaCritica: [
        { fecha: "2026-07-12", omitida: false },
        { fecha: "2026-07-14", omitida: true },
        { fecha: "2026-07-15", omitida: true },
      ],
    });
    const r = evaluarReglas(d, TODAS_LAS_REGLAS);
    expect(r.nivel).toBe("contactar");
    expect(r.reglasDisparadas[0].nombre).toBe("Fármaco crítico omitido");
  });

  it("4b) una sola omisión NO dispara adherencia crítica", () => {
    const d = datos({
      vertical: "cardiovascular",
      adherenciaCritica: [
        { fecha: "2026-07-14", omitida: false },
        { fecha: "2026-07-15", omitida: true },
      ],
    });
    expect(evaluarReglas(d, TODAS_LAS_REGLAS).nivel).toBe("normal");
  });

  it("5) ánimo <= 3 durante 3 días consecutivos → vigilancia", () => {
    const d = datos({
      vertical: "general",
      historico: [
        { fecha: "2026-07-13", dominio: "animo", valorNum: 3 },
        { fecha: "2026-07-14", dominio: "animo", valorNum: 2 },
        { fecha: "2026-07-15", dominio: "animo", valorNum: 3 },
      ],
    });
    const r = evaluarReglas(d, TODAS_LAS_REGLAS);
    expect(r.nivel).toBe("vigilancia");
    expect(r.reglasDisparadas[0].nombre).toBe("Ánimo bajo sostenido");
  });

  it("5b) ánimo bajo con un hueco de días NO dispara tendencia", () => {
    const d = datos({
      vertical: "general",
      historico: [
        { fecha: "2026-07-11", dominio: "animo", valorNum: 2 },
        { fecha: "2026-07-13", dominio: "animo", valorNum: 3 },
        { fecha: "2026-07-15", dominio: "animo", valorNum: 2 },
      ],
    });
    expect(evaluarReglas(d, TODAS_LAS_REGLAS).nivel).toBe("normal");
  });
});

// --- Combinación que NO dispara + filtro por vertical ------------------------

describe("evaluarReglas — casos que NO disparan", () => {
  it("combinación: solo dolor torácico (sin disnea) NO dispara", () => {
    const d = datos({
      vertical: "cardiovascular",
      observaciones: [
        { dominio: "sintoma_fisico", codigo: "dolor_toracico", valorNum: null },
      ],
    });
    expect(evaluarReglas(d, [REGLA_TORACICO_DISNEA]).nivel).toBe("normal");
  });

  it("la regla de vertical cardiovascular NO aplica a otra vertical", () => {
    const d = datos({
      vertical: "geriatrica",
      observaciones: [
        { dominio: "sintoma_fisico", codigo: "dolor_toracico", valorNum: null },
        { dominio: "sintoma_fisico", codigo: "disnea", valorNum: null },
      ],
    });
    expect(evaluarReglas(d, [REGLA_TORACICO_DISNEA]).nivel).toBe("normal");
  });
});

// --- Acciones: idempotencia + demostración E2E -------------------------------

function repoAccionesMemoria() {
  const alertas: AlertaNueva[] = [];
  const audits: EventoEscalado[] = [];
  const riesgos: { checkinId: string; nivel: NivelRiesgo }[] = [];
  const notificaciones: { pacienteId: string; checkinId: string }[] = [];

  const repo: RepositorioAcciones = {
    async alertaExiste(checkinId, reglaId) {
      return alertas.some(
        (a) => a.checkinId === checkinId && a.reglaId === reglaId,
      );
    },
    async alertaSinReglaExiste(checkinId) {
      return alertas.some(
        (a) => a.checkinId === checkinId && a.reglaId === null,
      );
    },
    async crearAlerta(a) {
      alertas.push(a);
    },
    async actualizarRiesgo(checkinId, nivel) {
      riesgos.push({ checkinId, nivel });
    },
    async registrarAuditoria(e) {
      audits.push(e);
    },
    async notificarUrgencia(pacienteId, checkinId) {
      notificaciones.push({ pacienteId, checkinId });
    },
  };

  return { repo, alertas, audits, riesgos, notificaciones };
}

function evaluacionToracicoDisnea(): EvaluacionCheckin {
  const d = datos({
    vertical: "cardiovascular",
    observaciones: [
      { dominio: "sintoma_fisico", codigo: "dolor_toracico", valorNum: null },
      { dominio: "sintoma_fisico", codigo: "disnea", valorNum: null },
    ],
  });
  const { nivel, reglasDisparadas } = evaluarReglas(d, TODAS_LAS_REGLAS);
  return {
    checkinId: "chk-1",
    pacienteId: "pac-1",
    riesgoActual: "contactar", // ya venía elevado en vivo por la señal
    nivel,
    reglasDisparadas,
    mensajesRelevantes: [
      { rol: "asistente", contenido: "¿Cómo te encuentras hoy?" },
      { rol: "paciente", contenido: "me duele el pecho y me falta el aire" },
    ],
    senalesDetectadas: [],
  };
}

describe("aplicarEscalado — E2E dolor torácico + disnea → urgencia", () => {
  it("crea la alerta con evidencia, sube el riesgo y audita (RF-ES-06)", async () => {
    const evaluacion = evaluacionToracicoDisnea();
    expect(evaluacion.nivel).toBe("urgencia");

    const m = repoAccionesMemoria();
    const res = await aplicarEscalado(evaluacion, m.repo);

    // Riesgo elevado a urgencia (subió desde 'contactar').
    expect(res.riesgoFinal).toBe("urgencia");
    expect(m.riesgos).toEqual([{ checkinId: "chk-1", nivel: "urgencia" }]);

    // Una alerta, con motivo = nombre de la regla y evidencia con las
    // observaciones implicadas + los mensajes relevantes.
    expect(m.alertas).toHaveLength(1);
    expect(m.alertas[0].motivo).toBe("Dolor torácico con disnea");
    expect(m.alertas[0].nivel).toBe("urgencia");
    const evidenciaStr = JSON.stringify(m.alertas[0].evidencia);
    expect(evidenciaStr).toContain("dolor_toracico");
    expect(evidenciaStr).toContain("disnea");
    expect(evidenciaStr).toContain("me falta el aire");

    // Un evento de auditoría del escalado.
    expect(m.audits).toHaveLength(1);
    const auditStr = JSON.stringify(m.audits[0].detalle);
    expect(auditStr).toContain("urgencia");

    // WP-10 ítem 5: aviso inmediato al profesional (una vez, con el check-in).
    expect(m.notificaciones).toHaveLength(1);
    expect(m.notificaciones[0].checkinId).toBe("chk-1");
  });

  it("es idempotente: re-evaluar no duplica la alerta, la auditoría ni el aviso", async () => {
    const evaluacion = evaluacionToracicoDisnea();
    const m = repoAccionesMemoria();

    const r1 = await aplicarEscalado(evaluacion, m.repo);
    const r2 = await aplicarEscalado(evaluacion, m.repo);

    expect(r1.alertasCreadas).toBe(1);
    expect(r2.alertasCreadas).toBe(0);
    expect(m.alertas).toHaveLength(1);
    expect(m.audits).toHaveLength(1);
    // El aviso de urgencia también es idempotente (WP-10 ítem 5).
    expect(m.notificaciones).toHaveLength(1);
  });

  it("una escalada de nivel 'contactar' NO avisa al profesional por email", async () => {
    // dolor >= 9 → contactar (no urgencia): se crea alerta pero sin email.
    const d = datos({
      observaciones: [{ dominio: "dolor", codigo: "dolor", valorNum: 9 }],
    });
    const { nivel, reglasDisparadas } = evaluarReglas(d, TODAS_LAS_REGLAS);
    expect(nivel).toBe("contactar");
    const evaluacion: EvaluacionCheckin = {
      checkinId: "chk-2",
      pacienteId: "pac-1",
      riesgoActual: null,
      nivel,
      reglasDisparadas,
      mensajesRelevantes: [],
      senalesDetectadas: [],
    };
    const m = repoAccionesMemoria();
    const res = await aplicarEscalado(evaluacion, m.repo);
    expect(res.riesgoFinal).toBe("contactar");
    expect(m.alertas.length).toBeGreaterThan(0);
    expect(m.notificaciones).toHaveLength(0);
  });

  it("nivel normal no crea alertas ni auditoría", async () => {
    const d = datos({ vertical: "general" });
    const { nivel, reglasDisparadas } = evaluarReglas(d, TODAS_LAS_REGLAS);
    const m = repoAccionesMemoria();
    const res = await aplicarEscalado(
      {
        checkinId: "chk-2",
        pacienteId: "pac-1",
        riesgoActual: null,
        nivel,
        reglasDisparadas,
        mensajesRelevantes: [],
        senalesDetectadas: [],
      },
      m.repo,
    );
    expect(res.alertasCreadas).toBe(0);
    expect(m.alertas).toHaveLength(0);
    expect(m.audits).toHaveLength(0);
  });
});

// --- Señales genéricas SIN regla: materialización de alerta (WP-08, punto b) --

/** Check-in cuyo riesgo se elevó en vivo por una señal que NINGUNA regla cubre. */
function evaluacionSenalGenerica(
  riesgoActual: NivelRiesgo | null,
): EvaluacionCheckin {
  return {
    checkinId: "chk-gen",
    pacienteId: "pac-9",
    riesgoActual,
    nivel: "normal", // ninguna regla disparó
    reglasDisparadas: [],
    mensajesRelevantes: [
      { rol: "paciente", contenido: "me noto raro y con mareos fuertes" },
    ],
    senalesDetectadas: ["mareo_intenso"],
  };
}

describe("aplicarEscaladoSenalGenerica — señal sin regla configurada", () => {
  it("crea UNA alerta sin regla (regla_id null) cuando el riesgo llegó a contactar", async () => {
    const m = repoAccionesMemoria();
    const res = await aplicarEscaladoSenalGenerica(
      evaluacionSenalGenerica("contactar"),
      m.repo,
    );
    expect(res.alertasCreadas).toBe(1);
    expect(m.alertas).toHaveLength(1);
    expect(m.alertas[0].reglaId).toBeNull();
    expect(m.alertas[0].nivel).toBe("contactar");
    expect(m.alertas[0].motivo).toBe("Señal de alarma sin regla configurada");
    // La evidencia incluye la señal detectada y el mensaje del paciente.
    const evidenciaStr = JSON.stringify(m.alertas[0].evidencia);
    expect(evidenciaStr).toContain("mareo_intenso");
    expect(evidenciaStr).toContain("mareos fuertes");
    // Un evento de auditoría del escalado genérico.
    expect(m.audits).toHaveLength(1);
    expect(JSON.stringify(m.audits[0].detalle)).toContain("senal_generica");
  });

  it("incluye el código de la señal en el motivo y en la evidencia", async () => {
    const m = repoAccionesMemoria();
    const res = await aplicarEscaladoSenalGenerica(
      {
        ...evaluacionSenalGenerica("contactar"),
        senalesContexto: [
          {
            codigo: "herida_enrojecida",
            descripcion: "Herida enrojecida",
            evidenciaTextual: "Tengo una herida enrojecida en la pierna.",
          },
        ],
      },
      m.repo,
    );
    expect(res.alertasCreadas).toBe(1);
    expect(m.alertas[0].motivo).toBe(
      "Señal de alarma sin regla configurada (herida_enrojecida)",
    );
    const evidencia = m.alertas[0].evidencia as Record<string, unknown>;
    expect(evidencia.senales_sin_regla).toEqual([
      expect.objectContaining({
        codigo: "herida_enrojecida",
        evidenciaTextual: "Tengo una herida enrojecida en la pierna.",
      }),
    ]);
  });

  it("es idempotente: no crea una segunda alerta genérica en el mismo check-in", async () => {
    const m = repoAccionesMemoria();
    await aplicarEscaladoSenalGenerica(
      evaluacionSenalGenerica("contactar"),
      m.repo,
    );
    const r2 = await aplicarEscaladoSenalGenerica(
      evaluacionSenalGenerica("urgencia"),
      m.repo,
    );
    expect(r2.alertasCreadas).toBe(0);
    expect(m.alertas).toHaveLength(1);
    expect(m.audits).toHaveLength(1);
  });

  it("NO actúa si alguna regla ya disparó (esas las gestiona aplicarEscalado)", async () => {
    const m = repoAccionesMemoria();
    const evaluacion = evaluacionToracicoDisnea(); // reglasDisparadas.length > 0
    const res = await aplicarEscaladoSenalGenerica(evaluacion, m.repo);
    expect(res.alertasCreadas).toBe(0);
    expect(m.alertas).toHaveLength(0);
  });

  it("NO actúa si el riesgo no llegó a contactar/urgencia", async () => {
    const m = repoAccionesMemoria();
    const res = await aplicarEscaladoSenalGenerica(
      evaluacionSenalGenerica("vigilancia"),
      m.repo,
    );
    expect(res.alertasCreadas).toBe(0);
    expect(m.alertas).toHaveLength(0);
  });
});

// --- evaluarSenal: clasificación en vivo -------------------------------------

describe("evaluarSenal — clasificación en vivo con reglas", () => {
  const REGLAS_SENAL: ReglaSenal[] = [
    {
      codigo: "ideacion_autolitica",
      nivel: "urgencia",
      nombre: "Ideación autolítica",
    },
  ];

  it("una señal que casa una regla urgencia se eleva en vivo", () => {
    const r = evaluarSenal({
      tipo: "ideacion_autolitica",
      descripcion: "La persona expresa ideas de hacerse daño.",
      evidenciaTextual: "...",
      reglas: REGLAS_SENAL,
    });
    expect(r.nivel).toBe("urgencia");
    expect(r.motivo).toBe("Ideación autolítica");
  });

  it("una señal sin regla que case se trata como contactar (conservador)", () => {
    const r = evaluarSenal({
      tipo: "dolor_toracico_disnea",
      descripcion: "Dolor en el pecho y falta de aire.",
      evidenciaTextual: "...",
      reglas: REGLAS_SENAL,
    });
    expect(r.nivel).toBe("contactar");
  });

  it("sin reglas, cualquier señal es contactar como mínimo", () => {
    const r = evaluarSenal({
      tipo: "sintoma_raro",
      descripcion: "x",
      evidenciaTextual: "y",
    });
    expect(r.nivel).toBe("contactar");
  });
});

// --- Reglas clínicas: los textos no diagnostican ni alarman ------------------

describe("textos al paciente — reglas clínicas de CLAUDE.md", () => {
  it("ningún texto de urgencia/contactar contiene diagnósticos ni alarmismo", () => {
    // Diagnósticos concretos y alarmismo explícito (PROHIBIDOS por CLAUDE.md).
    // Nota: "grave" NO se incluye porque el texto empático del WP lo usa en
    // sentido tranquilizador ("no tiene por qué ser nada grave").
    const prohibidas = [
      "infarto",
      "ictus",
      "cáncer",
      "trombo",
      "vas a morir",
      "peligro de muerte",
      "puede ser un",
    ];
    const textos = [
      TEXTOS_URGENCIA.titulo,
      TEXTOS_URGENCIA.cuerpo,
      TEXTOS_URGENCIA.instruccion,
      TEXTOS_CONTACTAR.titulo,
      TEXTOS_CONTACTAR.cuerpo,
    ]
      .join(" ")
      .toLowerCase();
    for (const p of prohibidas) expect(textos).not.toContain(p);
    // Y distinguen explícitamente señal de diagnóstico.
    expect(TEXTOS_URGENCIA.aclaracionSenal.toLowerCase()).toContain(
      "no es un diagnóstico",
    );
    expect(TEXTOS_CONTACTAR.aclaracionSenal.toLowerCase()).toContain(
      "no un diagnóstico",
    );
  });
});
