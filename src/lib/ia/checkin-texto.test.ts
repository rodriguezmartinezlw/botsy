/**
 * Test del motor conversacional del check-in por texto (WP-02).
 *
 * No requiere OPENAI_API_KEY ni Supabase: se inyecta un MOCK del cliente
 * OpenAI (guionizado) y un RepositorioCheckin en memoria. Demuestra los dos
 * escenarios del criterio de aceptación del WP + la validación Zod (nunca se
 * persiste una salida del LLM que no valida) + la reconciliación con dedup.
 */

import { describe, expect, it } from "vitest";
import type { NivelRiesgo } from "@/types/db";
import type {
  ClienteOpenAI,
  EntradaChat,
  LlamadaHerramienta,
  SalidaChat,
} from "@/lib/ia/openai";
import {
  ejecutarTurno,
  type ObservacionEntrada,
  type RepositorioCheckin,
  type SenalEntrada,
  type TomaEntrada,
} from "@/lib/ia/loop";
import {
  calcularRacha,
  construirInstrucciones,
  type ContextoCheckin,
  type DominioCheckin,
} from "@/lib/ia/conversacion";
import { nivelMaximoRiesgo } from "@/lib/escalado/senales";
import { reconciliarNucleo } from "@/lib/ia/extraccion";

const UUID_PAUTA = "550e8400-e29b-41d4-a716-446655440000";

// --- Utilidades de test ------------------------------------------------------

function llamada(nombre: string, args: unknown, id = nombre): LlamadaHerramienta {
  return { id: `${id}-${Math.random().toString(36).slice(2, 8)}`, nombre, argumentosJson: JSON.stringify(args) };
}

/** Cliente OpenAI mock: devuelve un guion de respuestas en secuencia. */
function clienteMock(guion: SalidaChat[]): {
  cliente: ClienteOpenAI;
  recibidas: EntradaChat[];
} {
  let i = 0;
  const recibidas: EntradaChat[] = [];
  const cliente: ClienteOpenAI = {
    async crearRespuesta(entrada: EntradaChat): Promise<SalidaChat> {
      recibidas.push(entrada);
      const salida = i < guion.length ? guion[i] : { contenido: "", llamadas: [] };
      i += 1;
      return salida;
    },
  };
  return { cliente, recibidas };
}

function repoMemoria(riesgoInicial: NivelRiesgo | null = null) {
  const observaciones: ObservacionEntrada[] = [];
  const tomas: TomaEntrada[] = [];
  const dominios = new Set<DominioCheckin>();
  const senales: SenalEntrada[] = [];
  let riesgo = riesgoInicial;

  const repositorio: RepositorioCheckin = {
    async registrarObservacion(o) {
      observaciones.push(o);
    },
    async registrarToma(t) {
      tomas.push(t);
    },
    async marcarDominioCubierto(d) {
      dominios.add(d);
    },
    async registrarSenal(s) {
      senales.push(s);
      riesgo = nivelMaximoRiesgo(riesgo, s.nivel);
    },
  };

  return {
    repositorio,
    observaciones,
    tomas,
    dominios,
    senales,
    obtenerRiesgo: () => riesgo,
  };
}

function contextoFake(overrides: Partial<ContextoCheckin> = {}): ContextoCheckin {
  return {
    pacienteId: "paciente-1",
    nombre: "Luis García",
    edad: 68,
    vertical: "cardiovascular",
    condiciones: ["cardiopatía isquémica"],
    zonaHoraria: "Europe/Madrid",
    fechaHoy: "2026-07-15",
    pautasHoy: [
      {
        id: UUID_PAUTA,
        farmaco: "Aspirina (AAS)",
        dosis: "100 mg",
        momentos: ["mañana"],
        critica: false,
      },
    ],
    resumenUltimoCheckin: "Ayer el dolor de cabeza estaba en 6/10.",
    observacionesRecientes: [],
    dominiosCubiertos: [],
    ...overrides,
  };
}

// --- Escenario A: extracción espontánea sin repreguntar ----------------------

describe("check-in por texto — escenario A (dolor 4/10 + aspirina espontáneos)", () => {
  it("extrae lo dicho, marca dominios y no queda pendiente lo ya cubierto", async () => {
    const { cliente } = clienteMock([
      // Turno 1: el modelo extrae lo que el paciente dijo espontáneamente.
      {
        contenido: null,
        llamadas: [
          llamada("registrar_observacion", {
            dominio: "dolor",
            codigo: "dolor_cabeza",
            valor_num: 4,
            confianza: 0.9,
          }),
          llamada("registrar_toma", {
            pauta_id: UUID_PAUTA,
            momento: "mañana",
            estado: "tomada",
          }),
          llamada("marcar_dominio_cubierto", { dominio: "dolor" }),
          llamada("marcar_dominio_cubierto", { dominio: "adherencia" }),
        ],
      },
      // Turno 2: pregunta por algo PENDIENTE, sin repreguntar dolor/aspirina.
      {
        contenido:
          "Gracias, Luis. He anotado tu dolor de cabeza en 4 sobre 10 y que ya tomaste la aspirina de la mañana. ¿Has notado hoy algún síntoma nuevo?",
        llamadas: [],
      },
    ]);

    const repo = repoMemoria();
    const resultado = await ejecutarTurno({
      cliente,
      modelo: "modelo-test",
      instrucciones: "instrucciones-de-prueba",
      historial: [
        { rol: "assistant", contenido: "Hola Luis, ¿cómo te encuentras hoy?" },
        {
          rol: "user",
          contenido:
            "Me duele un poco la cabeza, un 4 de 10, y ya me tomé la aspirina de esta mañana.",
        },
      ],
      repositorio: repo.repositorio,
      contexto: { vertical: "cardiovascular", dominiosYaCubiertos: [] },
    });

    // Se extrajo y persistió lo dicho espontáneamente.
    expect(repo.observaciones).toHaveLength(1);
    expect(repo.observaciones[0]).toMatchObject({
      dominio: "dolor",
      codigo: "dolor_cabeza",
      valorNum: 4,
    });
    expect(repo.tomas).toHaveLength(1);
    expect(repo.tomas[0]).toMatchObject({ momento: "mañana", estado: "tomada" });

    // Dolor y adherencia quedan cubiertos.
    expect(resultado.dominiosCubiertos).toEqual(
      expect.arrayContaining(["dolor", "adherencia"]),
    );

    // El texto final pregunta por lo pendiente y NO repregunta la aspirina.
    expect(resultado.texto).toContain("síntoma");
    expect(resultado.texto.toLowerCase()).not.toContain("¿tomaste");

    // Mecanismo por el que no se repregunta: al reconstruir instrucciones con
    // los dominios ya cubiertos, dolor/adherencia salen de la lista PENDIENTE.
    const instr = construirInstrucciones(
      contextoFake({ dominiosCubiertos: resultado.dominiosCubiertos }),
    );
    const idxPend = instr.indexOf("## Dominios PENDIENTES");
    const idxHechos = instr.indexOf("## Dominios YA cubiertos");
    const seccionPendientes = instr.slice(idxPend, idxHechos);
    const seccionHechos = instr.slice(idxHechos);
    expect(seccionPendientes).not.toContain("- dolor:");
    expect(seccionPendientes).not.toContain("- adherencia:");
    expect(seccionHechos).toContain("- dolor");
    expect(seccionHechos).toContain("- adherencia");
  });

  it("actualiza la racha con lógica de días consecutivos", () => {
    // Último check-in ayer (14) → hoy (15) suma un día a la racha.
    const nueva = calcularRacha(
      { racha_actual: 4, racha_maxima: 5, ultimo_checkin: "2026-07-14" },
      "2026-07-15",
    );
    expect(nueva.racha_actual).toBe(5);
    expect(nueva.racha_maxima).toBe(5);
    expect(nueva.ultimo_checkin).toBe("2026-07-15");
  });
});

// --- Escenario B: señal de alarma --------------------------------------------

describe("check-in por texto — escenario B (dolor torácico + disnea → señal)", () => {
  it("marca riesgo 'contactar' como mínimo y responde con calma", async () => {
    const { cliente } = clienteMock([
      {
        contenido: null,
        llamadas: [
          llamada("registrar_observacion", {
            dominio: "sintoma_fisico",
            codigo: "dolor_toracico",
            confianza: 0.95,
          }),
          llamada("registrar_observacion", {
            dominio: "sintoma_fisico",
            codigo: "disnea",
            confianza: 0.95,
          }),
          llamada("senal_alarma", {
            tipo: "dolor_toracico_disnea",
            descripcion: "Dolor en el pecho y falta de aire referidos a la vez.",
            evidencia_textual: "me duele el pecho y me falta el aire",
          }),
        ],
      },
      {
        contenido:
          "Entiendo, y siento que te sientas así. Es importante que contactes hoy con tu médico. Mantén la calma, estoy aquí contigo.",
        llamadas: [],
      },
    ]);

    const repo = repoMemoria();
    const resultado = await ejecutarTurno({
      cliente,
      modelo: "modelo-test",
      instrucciones: "instrucciones-de-prueba",
      historial: [
        { rol: "assistant", contenido: "¿Cómo te encuentras hoy?" },
        { rol: "user", contenido: "me duele el pecho y me falta el aire" },
      ],
      repositorio: repo.repositorio,
      contexto: { vertical: "cardiovascular", dominiosYaCubiertos: [] },
    });

    // Riesgo elevado a 'contactar' como mínimo.
    expect(repo.senales).toHaveLength(1);
    expect(repo.senales[0].nivel).toBe("contactar");
    expect(repo.obtenerRiesgo()).toBe("contactar");
    expect(resultado.riesgo).toBe("contactar");

    // Respuesta calmada que sugiere contactar al médico, sin dramatizar.
    expect(resultado.texto.toLowerCase()).toContain("médico");
    expect(resultado.texto.toLowerCase()).toMatch(/calma|contigo|tranquil/);
  });
});

// --- Validación Zod: nunca se persiste una salida que no valida --------------

describe("validación Zod de argumentos de tools", () => {
  it("descarta el argumento inválido y persiste solo el válido", async () => {
    const { cliente } = clienteMock([
      {
        contenido: null,
        // confianza 5 es inválida (>1): NO debe persistirse.
        llamadas: [
          llamada("registrar_observacion", {
            dominio: "animo",
            codigo: "animo_bajo",
            valor_num: 2,
            confianza: 5,
          }),
        ],
      },
      {
        contenido: null,
        // Reintento válido.
        llamadas: [
          llamada("registrar_observacion", {
            dominio: "animo",
            codigo: "animo_bajo",
            valor_num: 2,
            confianza: 0.8,
          }),
        ],
      },
      { contenido: "Gracias por contármelo.", llamadas: [] },
    ]);

    const repo = repoMemoria();
    await ejecutarTurno({
      cliente,
      modelo: "modelo-test",
      instrucciones: "x",
      historial: [{ rol: "user", contenido: "estoy un poco bajo de ánimo" }],
      repositorio: repo.repositorio,
      contexto: { vertical: "general", dominiosYaCubiertos: [] },
    });

    // Solo se persistió la observación válida (confianza 0.8).
    expect(repo.observaciones).toHaveLength(1);
    expect(repo.observaciones[0].confianza).toBe(0.8);
  });
});

// --- Reconciliación: dedup contra lo ya presente -----------------------------

describe("reconciliación (segunda pasada)", () => {
  it("inserta solo observaciones nuevas, sin duplicar códigos existentes", async () => {
    const { cliente } = clienteMock([
      {
        contenido: null,
        llamadas: [
          llamada("registrar_lote_observaciones", {
            observaciones: [
              // Duplicado de algo ya registrado en vivo → se descarta.
              { dominio: "dolor", codigo: "dolor_cabeza", valor_num: 4, confianza: 0.9 },
              // Nuevo → se conserva.
              { dominio: "sueno", codigo: "sueno_malo", valor_texto: "durmió mal", confianza: 0.7 },
            ],
          }),
        ],
      },
    ]);

    const nuevas = await reconciliarNucleo({
      cliente,
      modelo: "modelo-test",
      transcript: "Botsy: ...\nPaciente: ...",
      codigosExistentes: new Set(["dolor:dolor_cabeza"]),
    });

    expect(nuevas).toHaveLength(1);
    expect(nuevas[0]).toMatchObject({ dominio: "sueno", codigo: "sueno_malo" });
  });
});

// --- Racha: casos de borde ---------------------------------------------------

describe("calcularRacha", () => {
  it("no cambia si es el mismo día (idempotente)", () => {
    const r = calcularRacha(
      { racha_actual: 3, racha_maxima: 7, ultimo_checkin: "2026-07-15" },
      "2026-07-15",
    );
    expect(r.racha_actual).toBe(3);
    expect(r.racha_maxima).toBe(7);
  });

  it("se reinicia a 1 tras un hueco de 2+ días", () => {
    const r = calcularRacha(
      { racha_actual: 9, racha_maxima: 9, ultimo_checkin: "2026-07-10" },
      "2026-07-15",
    );
    expect(r.racha_actual).toBe(1);
    expect(r.racha_maxima).toBe(9);
  });

  it("empieza en 1 en el primer check-in", () => {
    const r = calcularRacha(
      { racha_actual: 0, racha_maxima: 0, ultimo_checkin: null },
      "2026-07-15",
    );
    expect(r.racha_actual).toBe(1);
    expect(r.racha_maxima).toBe(1);
  });
});
