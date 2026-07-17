/**
 * Tests del enrolamiento de pacientes (WP-20 §A) — alta y vinculación con MOCK
 * del Auth Admin API (puerto falso), sin red ni Supabase. Cubre:
 *   - alta nueva por invitación (camino feliz) → invitado + auditoría,
 *   - email ya existente sin confirmar → se OFRECE vincular (no duplica),
 *   - vinculación de un huérfano → asigna profesional + programa,
 *   - protección: no roba pacientes de otro profesional ni vincula no-pacientes,
 *   - validación Zod (email, campos estrictos, programa requerido).
 * Más una aserción de la RLS que garantiza la visibilidad tras el alta.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  enrolarPaciente,
  esquemaEnrolamiento,
  type PuertoEnrolamiento,
  type PacienteExistente,
} from "./nucleo";

const PROFESIONAL = "prof-1";

type Registro = {
  invitados: string[];
  vinculados: { userId: string; profesionalId: string; institucionId: string }[];
  programas: { userId: string; clave: string }[];
  auditorias: { accion: string; entidadId: string }[];
};

function crearPuerto(opts: {
  existe?: { id: string } | null;
  paciente?: PacienteExistente | null;
  invitarOk?: boolean;
  vincularOk?: boolean;
  programaOk?: boolean;
}): { puerto: PuertoEnrolamiento; reg: Registro } {
  const reg: Registro = {
    invitados: [],
    vinculados: [],
    programas: [],
    auditorias: [],
  };
  const puerto: PuertoEnrolamiento = {
    async buscarUsuarioPorEmail() {
      return opts.existe ?? null;
    },
    async invitar(email) {
      reg.invitados.push(email);
      return opts.invitarOk === false
        ? { ok: false, error: "fallo invitación" }
        : { ok: true, userId: "nuevo-user" };
    },
    async obtenerPaciente() {
      return opts.paciente ?? null;
    },
    async vincularProfesional(userId, profesionalId, extra) {
      reg.vinculados.push({ userId, profesionalId, institucionId: extra.institucionId });
      return opts.vincularOk !== false;
    },
    async asignarPrograma(userId, clave) {
      reg.programas.push({ userId, clave });
      return opts.programaOk === false
        ? { ok: false, error: "sin programa" }
        : { ok: true };
    },
    async auditar(accion, entidadId) {
      reg.auditorias.push({ accion, entidadId });
    },
  };
  return { puerto, reg };
}

const INSTITUCION_A = "00000000-0000-4000-8000-000000000b01";

const ENTRADA_BASE = {
  nombre: "María Pérez",
  email: "maria@ejemplo.com",
  telefono: "+51 900 111 222",
  fechaNacimiento: "1962-03-04",
  programaClave: "mama_terapia_oral",
  institucionId: INSTITUCION_A,
};

function validar(entrada: Record<string, unknown>) {
  const r = esquemaEnrolamiento.safeParse(entrada);
  if (!r.success) throw new Error("entrada de test inválida: " + r.error.message);
  return r.data;
}

describe("enrolarPaciente — alta nueva por invitación", () => {
  it("invita, asigna profesional y programa, y audita como 'paciente_enrolado'", async () => {
    const { puerto, reg } = crearPuerto({ existe: null });
    const r = await enrolarPaciente(puerto, PROFESIONAL, validar(ENTRADA_BASE));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado).toBe("invitado");
    expect(reg.invitados).toEqual(["maria@ejemplo.com"]);
    expect(reg.vinculados).toEqual([
      { userId: "nuevo-user", profesionalId: PROFESIONAL, institucionId: INSTITUCION_A },
    ]);
    expect(reg.programas).toEqual([
      { userId: "nuevo-user", clave: "mama_terapia_oral" },
    ]);
    expect(reg.auditorias).toEqual([
      { accion: "paciente_enrolado", entidadId: "nuevo-user" },
    ]);
  });

  it("si la invitación falla, no continúa y devuelve error", async () => {
    const { puerto, reg } = crearPuerto({ existe: null, invitarOk: false });
    const r = await enrolarPaciente(puerto, PROFESIONAL, validar(ENTRADA_BASE));
    expect(r.ok).toBe(false);
    expect(reg.programas).toHaveLength(0);
    expect(reg.auditorias).toHaveLength(0);
  });

  it("si el programa no se puede asignar tras crear el usuario, devuelve error", async () => {
    const { puerto } = crearPuerto({ existe: null, programaOk: false });
    const r = await enrolarPaciente(puerto, PROFESIONAL, validar(ENTRADA_BASE));
    expect(r.ok).toBe(false);
  });
});

describe("enrolarPaciente — email ya existente: se ofrece vincular, no se duplica", () => {
  it("sin confirmar vinculación, marca emailExiste y NO invita", async () => {
    const { puerto, reg } = crearPuerto({ existe: { id: "u-2" } });
    const r = await enrolarPaciente(puerto, PROFESIONAL, validar(ENTRADA_BASE));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.emailExiste).toBe(true);
    expect(reg.invitados).toHaveLength(0);
    expect(reg.vinculados).toHaveLength(0);
  });

  it("confirmando la vinculación de un huérfano, asigna profesional + programa", async () => {
    const { puerto, reg } = crearPuerto({
      existe: { id: "u-2" },
      paciente: { profesionalId: null, esPaciente: true },
    });
    const r = await enrolarPaciente(
      puerto,
      PROFESIONAL,
      validar({ ...ENTRADA_BASE, vincularExistente: true }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado).toBe("vinculado");
    expect(reg.vinculados).toEqual([
      { userId: "u-2", profesionalId: PROFESIONAL, institucionId: INSTITUCION_A },
    ]);
    expect(reg.programas).toEqual([{ userId: "u-2", clave: "mama_terapia_oral" }]);
    expect(reg.auditorias[0]?.accion).toBe("paciente_vinculado");
  });

  it("no vincula un paciente que ya es de OTRO profesional", async () => {
    const { puerto, reg } = crearPuerto({
      existe: { id: "u-2" },
      paciente: { profesionalId: "otro-prof", esPaciente: true },
    });
    const r = await enrolarPaciente(
      puerto,
      PROFESIONAL,
      validar({ ...ENTRADA_BASE, vincularExistente: true }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/otro profesional/i);
    expect(reg.vinculados).toHaveLength(0);
  });

  it("re-vincular un paciente ya propio es válido (idempotente en el profesional)", async () => {
    const { puerto } = crearPuerto({
      existe: { id: "u-2" },
      paciente: { profesionalId: PROFESIONAL, esPaciente: true },
    });
    const r = await enrolarPaciente(
      puerto,
      PROFESIONAL,
      validar({ ...ENTRADA_BASE, vincularExistente: true }),
    );
    expect(r.ok).toBe(true);
  });

  it("no vincula una cuenta que no es de paciente", async () => {
    const { puerto, reg } = crearPuerto({
      existe: { id: "u-2" },
      paciente: { profesionalId: null, esPaciente: false },
    });
    const r = await enrolarPaciente(
      puerto,
      PROFESIONAL,
      validar({ ...ENTRADA_BASE, vincularExistente: true }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/no es de paciente/i);
    expect(reg.vinculados).toHaveLength(0);
  });
});

describe("esquemaEnrolamiento — validación de la entrada", () => {
  it("normaliza el email a minúsculas y recorta espacios", () => {
    const d = validar({ ...ENTRADA_BASE, email: "  MARIA@Ejemplo.COM " });
    expect(d.email).toBe("maria@ejemplo.com");
  });

  it("rechaza email no válido", () => {
    expect(esquemaEnrolamiento.safeParse({ ...ENTRADA_BASE, email: "no-es-email" }).success).toBe(
      false,
    );
  });

  it("exige un programa", () => {
    const sinPrograma = { ...ENTRADA_BASE, programaClave: "" };
    expect(esquemaEnrolamiento.safeParse(sinPrograma).success).toBe(false);
  });

  it("exige una institución (uuid válido) — WP-22", () => {
    expect(esquemaEnrolamiento.safeParse({ ...ENTRADA_BASE, institucionId: "" }).success).toBe(
      false,
    );
    expect(
      esquemaEnrolamiento.safeParse({ ...ENTRADA_BASE, institucionId: "no-es-uuid" }).success,
    ).toBe(false);
    const sinInstitucion = {
      nombre: ENTRADA_BASE.nombre,
      email: ENTRADA_BASE.email,
      telefono: ENTRADA_BASE.telefono,
      fechaNacimiento: ENTRADA_BASE.fechaNacimiento,
      programaClave: ENTRADA_BASE.programaClave,
    };
    expect(esquemaEnrolamiento.safeParse(sinInstitucion).success).toBe(false);
  });

  it("rechaza campos extra (esquema estricto: no cuela nada clínico)", () => {
    const conExtra = { ...ENTRADA_BASE, vertical: "mental" };
    expect(esquemaEnrolamiento.safeParse(conExtra).success).toBe(false);
  });
});

describe("RLS — el paciente recién enrolado ve lo suyo y el profesional lo ve en su lista", () => {
  const RLS = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0002_rls.sql"),
    "utf8",
  );
  it("existen las políticas de visibilidad de pacientes (propio + profesional)", () => {
    expect(RLS).toMatch(/pacientes_select_propio/);
    expect(RLS).toMatch(/pacientes_select_profesional/);
    // La visibilidad del profesional se decide en el helper es_profesional_de.
    expect(RLS).toMatch(/es_profesional_de/);
  });

  it("WP-22: es_profesional_de se reescribe a visibilidad POR INSTITUCIÓN (0016)", () => {
    const MIG = readFileSync(
      join(process.cwd(), "supabase", "migrations", "0016_instituciones_pais.sql"),
      "utf8",
    );
    // Reescritura del MISMO helper (nombre/firma) para heredar el modelo en todas las políticas.
    expect(MIG).toMatch(/create or replace function public\.es_profesional_de\(p_paciente uuid\)/);
    // El cuerpo decide por membresía activa en profesionales_instituciones + institución del paciente.
    expect(MIG).toMatch(/profesionales_instituciones/);
    expect(MIG).toMatch(/pac\.institucion_id = pi\.institucion_id/);
    expect(MIG).toMatch(/pi\.activa/);
  });
});
