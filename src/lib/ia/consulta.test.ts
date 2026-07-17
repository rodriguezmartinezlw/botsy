/**
 * Tests de WP-24 — conversaciones a demanda (consultas).
 *
 * Cubre los criterios de la spec §E, sin Supabase real ni red:
 *  1. Migración 0020: índice único PARCIAL (2 consultas el mismo día OK; 2º
 *     check-in del día falla) — a nivel de SQL parseado + simulación semántica.
 *  2. La consulta NO altera la racha (finalizarCheckin con doble de Supabase);
 *     el check-in sí. El cierre de consulta SÍ escribe resumen y completa.
 *  3. Guion de consulta ≠ guion de check-in (construirInstrucciones puro).
 *  4. Iniciar consulta con el check-in de hoy completado → OK (fila nueva);
 *     2º check-in → rechazo con mensaje claro (decidirInicioSesion puro).
 *  5. Señal de alarma en una consulta → riesgo elevado + escalado materializado
 *     (misma maquinaria que el check-in: manejarToolVoz con puerto fake).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos, NivelRiesgo } from "@/types/db";
import {
  construirApertura,
  construirInstrucciones,
  construirResumen,
  type ContextoCheckin,
} from "@/lib/ia/conversacion";
import {
  decidirInicioSesion,
  MENSAJE_CHECKIN_COMPLETADO,
} from "@/lib/ia/iniciar-sesion";
import { esquemaCuerpoIniciar } from "@/lib/ia/schemas";
import { finalizarCheckin } from "@/lib/ia/finalizar";
import { nivelMaximoRiesgo } from "@/lib/escalado/senales";
import type {
  ObservacionEntrada,
  RepositorioCheckin,
  SenalEntrada,
  TomaEntrada,
} from "@/lib/ia/loop";
import type { DominioCheckin } from "@/lib/ia/conversacion";
import {
  manejarToolVoz,
  type CheckinVoz,
  type PuertoToolVoz,
} from "@/lib/ia/voz-tool";

const RAIZ = join(__dirname, "..", "..", "..");
const SQL_0020 = readFileSync(
  join(RAIZ, "supabase", "migrations", "0020_consultas_a_demanda.sql"),
  "utf8",
);
const SEED = readFileSync(join(RAIZ, "supabase", "seed.sql"), "utf8");

// =====================================================================
// 1. Migración 0020 — índice único parcial
// =====================================================================

describe("migración 0020 — esquema de consultas", () => {
  it("añade la columna tipo con check (checkin|consulta) y default 'checkin'", () => {
    expect(SQL_0020).toMatch(
      /add column tipo text not null default 'checkin'\s+check \(tipo in \('checkin', 'consulta'\)\)/,
    );
  });

  it("elimina la UNIQUE (paciente_id, fecha) de 0001 (localizada por columnas)", () => {
    // Robusto: el DROP localiza la restricción por sus columnas, no por nombre.
    expect(SQL_0020).toMatch(/drop constraint/);
    expect(SQL_0020).toMatch(/array\['fecha', 'paciente_id'\]/);
    expect(SQL_0020).toMatch(/contype = 'u'/);
  });

  it("crea el índice único PARCIAL: unique (paciente_id, fecha) where tipo = 'checkin'", () => {
    expect(SQL_0020).toMatch(
      /create unique index if not exists checkins_checkin_diario_unico\s+on public\.checkins \(paciente_id, fecha\)\s+where tipo = 'checkin'/,
    );
  });

  it("NO toca la RLS de checkins (misma tabla, políticas de 0002 intactas)", () => {
    expect(SQL_0020).not.toMatch(/create policy/i);
    expect(SQL_0020).not.toMatch(/drop policy/i);
    expect(SQL_0020).not.toMatch(/disable row level security/i);
  });

  it("semántica del índice parcial: 2 consultas el mismo día OK; 2º check-in falla", () => {
    // Simulación en memoria de la unicidad que expresa el índice de 0020:
    // solo las filas con tipo='checkin' entran en el índice.
    const claves = new Set<string>();
    const insertar = (f: { paciente: string; fecha: string; tipo: string }) => {
      if (f.tipo !== "checkin") return true; // fuera del índice parcial
      const k = `${f.paciente}|${f.fecha}`;
      if (claves.has(k)) return false; // violación de unicidad
      claves.add(k);
      return true;
    };

    const dia = { paciente: "p1", fecha: "2026-07-17" };
    expect(insertar({ ...dia, tipo: "checkin" })).toBe(true); // el check-in del día
    expect(insertar({ ...dia, tipo: "consulta" })).toBe(true); // consulta 1
    expect(insertar({ ...dia, tipo: "consulta" })).toBe(true); // consulta 2 (ilimitadas)
    expect(insertar({ ...dia, tipo: "checkin" })).toBe(false); // 2º check-in: FALLA
    // Otro día u otra persona: sin conflicto.
    expect(insertar({ paciente: "p1", fecha: "2026-07-18", tipo: "checkin" })).toBe(true);
    expect(insertar({ paciente: "p2", fecha: "2026-07-17", tipo: "checkin" })).toBe(true);
  });
});

describe("seed — datos sintéticos hasta AYER (WP-24 §D)", () => {
  it("el generador termina en current_date - 1 y ultimo_checkin = ayer", () => {
    expect(SEED).toContain("v_fecha := current_date - 1 - v_dias_atras");
    expect(SEED).toMatch(/ultimo_checkin\s*=\s*current_date - 1/);
    // La alerta 'nueva' de María también queda en AYER (el día actual, libre).
    expect(SEED).toMatch(/v_fecha := current_date - 1;/);
  });

  it("los ON CONFLICT de checkins apuntan al índice parcial de 0020", () => {
    expect(SEED).not.toMatch(/on conflict \(paciente_id, fecha\) do nothing/);
    expect(SEED).toMatch(
      /on conflict \(paciente_id, fecha\) where tipo = 'checkin' do nothing/,
    );
  });
});

// =====================================================================
// Utilidades de contexto
// =====================================================================

function contextoFake(overrides: Partial<ContextoCheckin> = {}): ContextoCheckin {
  return {
    pacienteId: "p1",
    nombre: "María López",
    edad: 57,
    vertical: "general",
    condiciones: ["Cáncer de mama"],
    zonaHoraria: "Europe/Madrid",
    fechaHoy: "2026-07-17",
    pautasHoy: [],
    resumenUltimoCheckin: null,
    observacionesRecientes: [],
    dominiosCubiertos: [],
    ...overrides,
  };
}

// =====================================================================
// 3. Guion de consulta ≠ guion de check-in
// =====================================================================

describe("construirInstrucciones — modo consulta (WP-24)", () => {
  const consulta = construirInstrucciones(contextoFake({ tipo: "consulta" }));
  const checkin = construirInstrucciones(contextoFake({ tipo: "checkin" }));

  it("el guion de consulta es distinto del de check-in", () => {
    expect(consulta).not.toBe(checkin);
    // Escucha a demanda, sin checklist de dominios.
    expect(consulta).toContain("NO recorras la checklist");
    expect(consulta).toContain("CONVERSACIÓN");
    expect(consulta).not.toContain("## Dominios PENDIENTES");
    expect(consulta).not.toContain("marcar_dominio_cubierto");
    // El check-in estructurado conserva su checklist.
    expect(checkin).toContain("## Dominios PENDIENTES");
    expect(checkin).toContain("marcar_dominio_cubierto");
  });

  it("la consulta registra y evalúa señales con las mismas tools", () => {
    expect(consulta).toContain("registrar_observacion");
    expect(consulta).toContain("registrar_toma");
    expect(consulta).toContain("senal_alarma");
    expect(consulta).toContain("finalizar_checkin");
  });

  it("las reglas clínicas innegociables aparecen ÍNTEGRAS en ambos guiones", () => {
    for (const guion of [consulta, checkin]) {
      expect(guion).toContain("NO diagnosticas");
      expect(guion).toContain("NO recomiendas fármacos");
      expect(guion).toContain('Distingue siempre "señal detectada" de "diagnóstico"');
      expect(guion).toContain("no sustituyes a su médico");
    }
  });

  it("la consulta NO administra el termómetro aunque toque hoy", () => {
    const conInstrumento = construirInstrucciones(
      contextoFake({
        tipo: "consulta",
        instrumento: {
          clave: "termometro_distres_nccn",
          administrar: true,
          frecuencia: "semanal",
          umbralProblemas: 4,
        },
      }),
    );
    expect(conInstrumento).not.toContain("TERMÓMETRO");
  });

  it("sin tipo (o tipo checkin) el guion es el de siempre (F1 intacto)", () => {
    const sinTipo = construirInstrucciones(contextoFake());
    expect(sinTipo).toBe(checkin);
  });

  it("la apertura de consulta invita a contar, la del check-in pregunta por el día", () => {
    const aperturaConsulta = construirApertura(contextoFake({ tipo: "consulta" }));
    const aperturaCheckin = construirApertura(contextoFake());
    expect(aperturaConsulta).not.toBe(aperturaCheckin);
    expect(aperturaConsulta).toContain("cuéntame qué necesitas");
    expect(aperturaCheckin).toContain("¿Cómo te encuentras hoy?");
  });
});

// =====================================================================
// 4. Iniciar sesión: consulta con check-in completado OK; 2º check-in no
// =====================================================================

describe("decidirInicioSesion (WP-24)", () => {
  it("consulta con el check-in de hoy COMPLETADO → crea fila nueva", () => {
    const d = decidirInicioSesion("consulta", { id: "c1", estado: "completado" });
    expect(d).toEqual({ accion: "crear", tipo: "consulta" });
  });

  it("consulta SIEMPRE crea fila nueva (sin check-in previo o en curso)", () => {
    expect(decidirInicioSesion("consulta", null)).toEqual({
      accion: "crear",
      tipo: "consulta",
    });
    expect(
      decidirInicioSesion("consulta", { id: "c1", estado: "en_curso" }),
    ).toEqual({ accion: "crear", tipo: "consulta" });
  });

  it("checkin sin fila hoy → crear; en curso → retomar", () => {
    expect(decidirInicioSesion("checkin", null)).toEqual({
      accion: "crear",
      tipo: "checkin",
    });
    expect(
      decidirInicioSesion("checkin", { id: "c1", estado: "en_curso" }),
    ).toEqual({ accion: "retomar", checkinId: "c1" });
  });

  it("2º checkin con el día completado → 409 con mensaje claro, no críptico", () => {
    const d = decidirInicioSesion("checkin", { id: "c1", estado: "completado" });
    expect(d.accion).toBe("rechazar");
    if (d.accion === "rechazar") {
      expect(d.estado).toBe(409);
      expect(d.error).toBe(MENSAJE_CHECKIN_COMPLETADO);
      expect(d.error).toContain("Puedes abrir una conversación cuando quieras");
    }
  });

  it("el cuerpo Zod acepta tipo consulta, defaultea a checkin y rechaza otros", () => {
    expect(esquemaCuerpoIniciar.parse({})).toEqual({ tipo: "checkin" });
    expect(esquemaCuerpoIniciar.parse({ tipo: "consulta" })).toEqual({
      tipo: "consulta",
    });
    expect(esquemaCuerpoIniciar.safeParse({ tipo: "otro" }).success).toBe(false);
  });
});

// =====================================================================
// 2. La consulta NO altera la racha (cierre compartido)
// =====================================================================

type ConsultaFake = {
  tabla: string;
  op: "select" | "update";
  payload?: Record<string, unknown>;
  filtros: Record<string, unknown>;
};

/**
 * Doble mínimo del cliente de Supabase para `finalizarCheckin`: resuelve las
 * lecturas con filas fijas y REGISTRA los updates. El escalado y la
 * reconciliación reales son best-effort y fallan con gracia sin entorno.
 */
function crearSupabaseFake(filas: {
  checkin: Record<string, unknown>;
  paciente: Record<string, unknown>;
}) {
  const updates: ConsultaFake[] = [];

  function resolver(consulta: ConsultaFake, single: boolean): unknown {
    if (consulta.op === "update") {
      updates.push(consulta);
      return { data: null, error: null };
    }
    if (single) {
      if (consulta.tabla === "checkins") return { data: filas.checkin, error: null };
      if (consulta.tabla === "pacientes") return { data: filas.paciente, error: null };
      if (consulta.tabla === "perfiles")
        return { data: { nombre: "María" }, error: null };
      return { data: null, error: null };
    }
    return { data: [], error: null };
  }

  function crearBuilder(tabla: string) {
    const consulta: ConsultaFake = { tabla, op: "select", filtros: {} };
    const builder = {
      select: () => builder,
      update: (payload: Record<string, unknown>) => {
        consulta.op = "update";
        consulta.payload = payload;
        return builder;
      },
      eq: (col: string, valor: unknown) => {
        consulta.filtros[col] = valor;
        return builder;
      },
      maybeSingle: () => Promise.resolve(resolver(consulta, true)),
      then: (
        onFulfilled: (v: unknown) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve(resolver(consulta, false)).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const cliente = { from: (tabla: string) => crearBuilder(tabla) };
  return {
    supabase: cliente as unknown as SupabaseClient<BaseDatos>,
    updates,
  };
}

const PACIENTE_PREVIO = {
  racha_actual: 5,
  racha_maxima: 9,
  ultimo_checkin: "2026-07-16",
  telefono_medico: "+34600111222",
};

function filaCheckin(tipo: "checkin" | "consulta"): Record<string, unknown> {
  return {
    id: "sesion-1",
    tipo,
    estado: "en_curso",
    fecha: "2026-07-17",
    riesgo: null,
    resumen: null,
    dominios_cubiertos: {},
    creado_en: "2026-07-17T10:00:00.000Z",
  };
}

describe("finalizarCheckin — la consulta no altera la racha (WP-24)", () => {
  it("cerrar una CONSULTA completa la fila y NO toca pacientes (racha intacta)", async () => {
    const { supabase, updates } = crearSupabaseFake({
      checkin: filaCheckin("consulta"),
      paciente: PACIENTE_PREVIO,
    });

    const resultado = await finalizarCheckin(supabase, "p1", "sesion-1");
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // La racha devuelta es la PREVIA, sin sumar.
    expect(resultado.datos.tipo).toBe("consulta");
    expect(resultado.datos.racha_actual).toBe(5);
    expect(resultado.datos.racha_maxima).toBe(9);

    // Se completó la sesión (resumen incluido)...
    const updCheckin = updates.find((u) => u.tabla === "checkins");
    expect(updCheckin).toBeDefined();
    expect(updCheckin?.payload).toMatchObject({ estado: "completado" });
    expect(typeof updCheckin?.payload?.resumen).toBe("string");

    // ...pero NO hubo update de pacientes (ni racha ni ultimo_checkin).
    expect(updates.some((u) => u.tabla === "pacientes")).toBe(false);

    // Y el resumen de consulta no habla de racha.
    expect(resultado.datos.resumen).not.toContain("días seguidos");
    expect(resultado.datos.resumen).not.toContain("Mañana seguimos");
  });

  it("cerrar el CHECK-IN del día siguiente SÍ suma la racha (control)", async () => {
    const { supabase, updates } = crearSupabaseFake({
      checkin: filaCheckin("checkin"),
      paciente: PACIENTE_PREVIO,
    });

    const resultado = await finalizarCheckin(supabase, "p1", "sesion-1");
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.datos.tipo).toBe("checkin");
    expect(resultado.datos.racha_actual).toBe(6); // 5 + día consecutivo

    const updPaciente = updates.find((u) => u.tabla === "pacientes");
    expect(updPaciente).toBeDefined();
    expect(updPaciente?.payload).toMatchObject({
      racha_actual: 6,
      ultimo_checkin: "2026-07-17",
    });
  });
});

describe("construirResumen — cierre de consulta", () => {
  it("no menciona la racha y cierra con calidez", () => {
    const resumen = construirResumen({
      nombre: "María",
      dominiosCubiertos: [],
      observaciones: [],
      tomas: [],
      rachaActual: 5,
      riesgo: null,
      tipo: "consulta",
    });
    expect(resumen).toContain("Gracias");
    expect(resumen).toContain("cuando me necesites");
    expect(resumen).not.toContain("días seguidos");
    expect(resumen).not.toContain("Mañana seguimos");
  });

  it("con riesgo 'contactar' la consulta también distingue señal de diagnóstico", () => {
    const resumen = construirResumen({
      nombre: "María",
      dominiosCubiertos: [],
      observaciones: [],
      tomas: [],
      rachaActual: 5,
      riesgo: "contactar",
      tipo: "consulta",
    });
    expect(resumen).toContain("contactar hoy con tu médico");
    expect(resumen).toContain("No es un diagnóstico");
  });
});

// =====================================================================
// 5. Señal de alarma en consulta → riesgo/alerta (misma maquinaria)
// =====================================================================

function crearPuertoFake(checkin: CheckinVoz | null) {
  const observaciones: ObservacionEntrada[] = [];
  const tomas: TomaEntrada[] = [];
  const senales: SenalEntrada[] = [];
  const dominios = new Set<DominioCheckin>(checkin?.dominiosCubiertos ?? []);
  let riesgo: NivelRiesgo | null = checkin?.riesgo ?? null;
  let escaladoLlamado = 0;

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
    async registrarInstrumento() {
      /* la consulta no administra instrumentos */
    },
  };

  const puerto: PuertoToolVoz = {
    async cargarCheckinPropio() {
      return checkin;
    },
    async cargarReglasSenal() {
      return [];
    },
    crearRepositorio() {
      return {
        repositorio,
        obtenerRiesgo: () => riesgo,
        obtenerDominios: () => [...dominios],
      };
    },
    async materializarEscalado() {
      escaladoLlamado += 1;
    },
  };

  return { puerto, senales, observaciones, escaladoLlamado: () => escaladoLlamado };
}

const CONSULTA_VOZ: CheckinVoz = {
  id: "consulta-1",
  pacienteId: "p1",
  estado: "en_curso",
  riesgo: null,
  fecha: "2026-07-17",
  dominiosCubiertos: [],
  vertical: "general",
  instrumentoActivo: false,
  tipo: "consulta",
};

describe("consulta — señal de alarma escala igual que en el check-in", () => {
  it("una fiebre contada en consulta eleva el riesgo y materializa la alerta YA", async () => {
    const fake = crearPuertoFake(CONSULTA_VOZ);
    const res = await manejarToolVoz(
      {
        userId: "p1",
        checkinId: "consulta-1",
        llamada: {
          id: "call-1",
          nombre: "senal_alarma",
          argumentosJson: JSON.stringify({
            tipo: "fiebre",
            descripcion: "Fiebre de 38.2 contada en una conversación nocturna.",
            evidencia_textual: "tengo treinta y ocho y dos de fiebre",
          }),
        },
      },
      fake.puerto,
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      // Sin regla aplicable, el mínimo conservador es 'contactar' (WP-04).
      expect(res.riesgo).toBe("contactar");
    }
    expect(fake.senales).toHaveLength(1);
    // La alerta al profesional se materializa in situ, sin esperar al cierre.
    expect(fake.escaladoLlamado()).toBe(1);
  });

  it("una consulta cerrada responde 409 con mensaje propio de conversación", async () => {
    const fake = crearPuertoFake({ ...CONSULTA_VOZ, estado: "completado" });
    const res = await manejarToolVoz(
      {
        userId: "p1",
        checkinId: "consulta-1",
        llamada: {
          id: "call-2",
          nombre: "registrar_observacion",
          argumentosJson: JSON.stringify({
            dominio: "sintoma_fisico",
            codigo: "fiebre",
            valor_num: 38.2,
            confianza: 0.9,
          }),
        },
      },
      fake.puerto,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.estado).toBe(409);
      expect(res.error).toBe("Esta conversación ya está cerrada.");
    }
  });
});
