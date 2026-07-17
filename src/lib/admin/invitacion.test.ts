/**
 * Tests de la invitación de PROFESIONALES (WP-23 §3) — con MOCK del Auth Admin API
 * (puerto falso), sin red ni Supabase. Cubre:
 *   - alta nueva por invitación (camino feliz) → invitado + auditoría 'profesional_invitado',
 *   - email ya existente → NO se duplica (mensaje distinto si ya es profesional),
 *   - fallo de la invitación → no audita,
 *   - validación Zod (email, nombre, esquema estricto).
 */

import { describe, expect, it } from "vitest";
import {
  invitarProfesional,
  esquemaInvitarProfesional,
  type PuertoInvitacionProfesional,
} from "./invitacion";

const ADMIN = "admin-1";

type Registro = {
  invitados: string[];
  auditorias: { accion: string; entidadId: string }[];
};

function crearPuerto(opts: {
  existe?: { id: string } | null;
  rolExistente?: string | null;
  invitarOk?: boolean;
}): { puerto: PuertoInvitacionProfesional; reg: Registro } {
  const reg: Registro = { invitados: [], auditorias: [] };
  const puerto: PuertoInvitacionProfesional = {
    async buscarUsuarioPorEmail() {
      return opts.existe ?? null;
    },
    async invitar(email) {
      reg.invitados.push(email);
      return opts.invitarOk === false
        ? { ok: false, error: "fallo invitación" }
        : { ok: true, userId: "nuevo-prof" };
    },
    async obtenerRol() {
      return opts.rolExistente ?? null;
    },
    async auditar(accion, entidadId) {
      reg.auditorias.push({ accion, entidadId });
    },
  };
  return { puerto, reg };
}

const ENTRADA_BASE = { nombre: "Dra. Ana García", email: "ana@clinica.com" };

function validar(entrada: Record<string, unknown>) {
  const r = esquemaInvitarProfesional.safeParse(entrada);
  if (!r.success) throw new Error("entrada de test inválida: " + r.error.message);
  return r.data;
}

describe("invitarProfesional — alta nueva por invitación", () => {
  it("invita y audita como 'profesional_invitado'", async () => {
    const { puerto, reg } = crearPuerto({ existe: null });
    const r = await invitarProfesional(puerto, ADMIN, validar(ENTRADA_BASE));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.userId).toBe("nuevo-prof");
    expect(reg.invitados).toEqual(["ana@clinica.com"]);
    expect(reg.auditorias).toEqual([
      { accion: "profesional_invitado", entidadId: "nuevo-prof" },
    ]);
  });

  it("si la invitación falla, devuelve error y NO audita", async () => {
    const { puerto, reg } = crearPuerto({ existe: null, invitarOk: false });
    const r = await invitarProfesional(puerto, ADMIN, validar(ENTRADA_BASE));
    expect(r.ok).toBe(false);
    expect(reg.auditorias).toHaveLength(0);
  });
});

describe("invitarProfesional — email ya existente: NO se duplica", () => {
  it("si ya hay un profesional con ese correo, no invita y avisa", async () => {
    const { puerto, reg } = crearPuerto({
      existe: { id: "u-2" },
      rolExistente: "profesional",
    });
    const r = await invitarProfesional(puerto, ADMIN, validar(ENTRADA_BASE));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/ya hay un profesional/i);
    expect(reg.invitados).toHaveLength(0);
    expect(reg.auditorias).toHaveLength(0);
  });

  it("si el correo pertenece a otra cuenta (no profesional), no lo reutiliza", async () => {
    const { puerto, reg } = crearPuerto({
      existe: { id: "u-3" },
      rolExistente: "paciente",
    });
    const r = await invitarProfesional(puerto, ADMIN, validar(ENTRADA_BASE));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/ya existe una cuenta/i);
    expect(reg.invitados).toHaveLength(0);
  });
});

describe("esquemaInvitarProfesional — validación", () => {
  it("normaliza el email a minúsculas y recorta espacios", () => {
    const d = validar({ nombre: " Ana ", email: "  ANA@Clinica.COM " });
    expect(d.email).toBe("ana@clinica.com");
    expect(d.nombre).toBe("Ana");
  });

  it("rechaza email no válido y nombre vacío", () => {
    expect(
      esquemaInvitarProfesional.safeParse({ ...ENTRADA_BASE, email: "no-es-email" }).success,
    ).toBe(false);
    expect(
      esquemaInvitarProfesional.safeParse({ ...ENTRADA_BASE, nombre: "" }).success,
    ).toBe(false);
  });

  it("rechaza campos extra (esquema estricto)", () => {
    expect(
      esquemaInvitarProfesional.safeParse({ ...ENTRADA_BASE, rol: "admin" }).success,
    ).toBe(false);
  });
});
