/**
 * Test de la parte SERVIDOR del check-in por voz (WP-03), sin OPENAI_API_KEY ni
 * Supabase ni navegador: se inyecta un doble en memoria del puerto `PuertoToolVoz`.
 *
 * Demuestra los criterios de aceptación de la parte servidor:
 *  - las tool-calls de voz se validan con los MISMOS schemas Zod de WP-02
 *    (una inválida NO se persiste; una válida sí),
 *  - se verifica la PERTENENCIA del check-in al usuario de la sesión,
 *  - el escalado se MATERIALIZA de inmediato cuando el turno sube el riesgo,
 * reutilizando `ejecutarHerramienta` (misma lógica que el modo texto).
 */

import { describe, expect, it } from "vitest";
import type { NivelRiesgo } from "@/types/db";
import { nivelMaximoRiesgo, type ReglaSenal } from "@/lib/escalado/senales";
import type {
  ObservacionEntrada,
  RepositorioCheckin,
  SenalEntrada,
  TomaEntrada,
} from "@/lib/ia/loop";
import type { DominioCheckin } from "@/lib/ia/conversacion";
import type { LlamadaHerramienta } from "@/lib/ia/openai";
import {
  manejarToolVoz,
  type CheckinVoz,
  type PuertoToolVoz,
} from "@/lib/ia/voz-tool";

const UUID_PAUTA = "550e8400-e29b-41d4-a716-446655440000";

function llamada(nombre: string, args: unknown): LlamadaHerramienta {
  return {
    id: `call-${Math.random().toString(36).slice(2, 8)}`,
    nombre,
    argumentosJson: JSON.stringify(args),
  };
}

function checkinFake(overrides: Partial<CheckinVoz> = {}): CheckinVoz {
  return {
    id: "checkin-1",
    pacienteId: "paciente-1",
    estado: "en_curso",
    riesgo: null,
    fecha: "2026-07-15",
    dominiosCubiertos: [],
    vertical: "cardiovascular",
    ...overrides,
  };
}

function crearPuertoFake(config: {
  checkin: CheckinVoz | null;
  reglas?: readonly ReglaSenal[];
}) {
  const observaciones: ObservacionEntrada[] = [];
  const tomas: TomaEntrada[] = [];
  const senales: SenalEntrada[] = [];
  const dominios = new Set<DominioCheckin>(config.checkin?.dominiosCubiertos ?? []);
  let riesgo: NivelRiesgo | null = config.checkin?.riesgo ?? null;
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
  };

  const puerto: PuertoToolVoz = {
    async cargarCheckinPropio() {
      return config.checkin;
    },
    async cargarReglasSenal() {
      return config.reglas ?? [];
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

  return {
    puerto,
    observaciones,
    tomas,
    senales,
    escaladoLlamado: () => escaladoLlamado,
  };
}

// --- Pertenencia -------------------------------------------------------------

describe("voz/tool — pertenencia del check-in", () => {
  it("devuelve 404 si el check-in no es del usuario de la sesión", async () => {
    const fake = crearPuertoFake({ checkin: null });
    const res = await manejarToolVoz(
      {
        userId: "otro",
        checkinId: "ajeno",
        llamada: llamada("marcar_dominio_cubierto", { dominio: "dolor" }),
      },
      fake.puerto,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.estado).toBe(404);
    expect(fake.escaladoLlamado()).toBe(0);
  });

  it("devuelve 409 si el check-in ya está cerrado", async () => {
    const fake = crearPuertoFake({
      checkin: checkinFake({ estado: "completado" }),
    });
    const res = await manejarToolVoz(
      {
        userId: "paciente-1",
        checkinId: "checkin-1",
        llamada: llamada("marcar_dominio_cubierto", { dominio: "dolor" }),
      },
      fake.puerto,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.estado).toBe(409);
  });
});

// --- Validación Zod (mismos schemas de WP-02) --------------------------------

describe("voz/tool — validación de argumentos", () => {
  it("persiste una observación válida y la marca de dominio", async () => {
    const fake = crearPuertoFake({ checkin: checkinFake() });
    const res = await manejarToolVoz(
      {
        userId: "paciente-1",
        checkinId: "checkin-1",
        llamada: llamada("registrar_observacion", {
          dominio: "dolor",
          codigo: "dolor_cabeza",
          valor_num: 4,
          confianza: 0.9,
        }),
      },
      fake.puerto,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output).toContain("Observación registrada");
    expect(fake.observaciones).toHaveLength(1);
    expect(fake.observaciones[0]).toMatchObject({
      dominio: "dolor",
      codigo: "dolor_cabeza",
      valorNum: 4,
    });
    // Sin señal: no se materializa escalado.
    expect(fake.escaladoLlamado()).toBe(0);
  });

  it("NO persiste una observación inválida (confianza fuera de rango)", async () => {
    const fake = crearPuertoFake({ checkin: checkinFake() });
    const res = await manejarToolVoz(
      {
        userId: "paciente-1",
        checkinId: "checkin-1",
        llamada: llamada("registrar_observacion", {
          dominio: "animo",
          codigo: "animo_bajo",
          valor_num: 2,
          confianza: 5, // inválido (>1)
        }),
      },
      fake.puerto,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.toLowerCase()).toContain("error de validación");
    expect(fake.observaciones).toHaveLength(0);
    expect(fake.escaladoLlamado()).toBe(0);
  });

  it("registra la toma con pauta válida", async () => {
    const fake = crearPuertoFake({ checkin: checkinFake() });
    const res = await manejarToolVoz(
      {
        userId: "paciente-1",
        checkinId: "checkin-1",
        llamada: llamada("registrar_toma", {
          pauta_id: UUID_PAUTA,
          momento: "mañana",
          estado: "tomada",
        }),
      },
      fake.puerto,
    );
    expect(res.ok).toBe(true);
    expect(fake.tomas).toHaveLength(1);
    expect(fake.tomas[0]).toMatchObject({ momento: "mañana", estado: "tomada" });
  });
});

// --- Escalado inmediato ------------------------------------------------------

describe("voz/tool — escalado inmediato", () => {
  it("una señal sin regla eleva a 'contactar' y materializa el escalado ya", async () => {
    const fake = crearPuertoFake({ checkin: checkinFake() });
    const res = await manejarToolVoz(
      {
        userId: "paciente-1",
        checkinId: "checkin-1",
        llamada: llamada("senal_alarma", {
          tipo: "dolor_toracico_disnea",
          descripcion: "Dolor en el pecho y falta de aire a la vez.",
          evidencia_textual: "me duele el pecho y me falta el aire",
        }),
      },
      fake.puerto,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.riesgo).toBe("contactar");
    expect(fake.senales).toHaveLength(1);
    // Materialización inmediata (no espera al cierre).
    expect(fake.escaladoLlamado()).toBe(1);
  });

  it("una señal con regla de urgencia eleva a 'urgencia' y materializa el escalado", async () => {
    const reglas: ReglaSenal[] = [
      {
        codigo: "dolor_toracico_disnea",
        nivel: "urgencia",
        nombre: "Dolor torácico con disnea (cardiovascular)",
      },
    ];
    const fake = crearPuertoFake({ checkin: checkinFake(), reglas });
    const res = await manejarToolVoz(
      {
        userId: "paciente-1",
        checkinId: "checkin-1",
        llamada: llamada("senal_alarma", {
          tipo: "dolor_toracico_disnea",
          descripcion: "Dolor en el pecho y falta de aire.",
          evidencia_textual: "pecho y aire",
        }),
      },
      fake.puerto,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.riesgo).toBe("urgencia");
    expect(fake.escaladoLlamado()).toBe(1);
  });
});
