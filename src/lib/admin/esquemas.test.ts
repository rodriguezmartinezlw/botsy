/**
 * Tests de la validación PURA del admin (WP-23): esquemas Zod estrictos y la
 * lógica de aviso al retirar la última membresía. Sin base de datos.
 */

import { describe, expect, it } from "vitest";
import {
  esquemaCrearInstitucion,
  esquemaEditarInstitucion,
  esquemaEstadoInstitucion,
  esquemaCrearPais,
  esquemaAsignarMembresia,
  esquemaRetirarMembresia,
  esquemaAsignarInstitucionPaciente,
  avisoRetiroMembresia,
} from "./esquemas";

const UUID = "00000000-0000-4000-8000-000000000001";
const UUID2 = "00000000-0000-4000-8000-000000000002";

describe("esquemaCrearInstitucion", () => {
  it("acepta una institución válida y normaliza el país a mayúsculas", () => {
    const r = esquemaCrearInstitucion.safeParse({
      nombre: "  Clínica Nueva  ",
      tipo: "clinica",
      paisCodigo: "co",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.nombre).toBe("Clínica Nueva");
    expect(r.data.paisCodigo).toBe("CO");
  });

  it("rechaza tipo fuera del catálogo y país mal formado", () => {
    expect(
      esquemaCrearInstitucion.safeParse({ nombre: "X", tipo: "spa", paisCodigo: "CO" }).success,
    ).toBe(false);
    expect(
      esquemaCrearInstitucion.safeParse({ nombre: "X", tipo: "clinica", paisCodigo: "COL" })
        .success,
    ).toBe(false);
    expect(
      esquemaCrearInstitucion.safeParse({ nombre: "", tipo: "clinica", paisCodigo: "CO" }).success,
    ).toBe(false);
  });

  it("rechaza campos extra (estricto)", () => {
    expect(
      esquemaCrearInstitucion.safeParse({
        nombre: "X",
        tipo: "clinica",
        paisCodigo: "CO",
        activa: true,
      }).success,
    ).toBe(false);
  });
});

describe("esquemaEditarInstitucion / esquemaEstadoInstitucion", () => {
  it("editar exige un id uuid", () => {
    expect(
      esquemaEditarInstitucion.safeParse({
        id: UUID,
        nombre: "X",
        tipo: "hospital",
        paisCodigo: "PE",
      }).success,
    ).toBe(true);
    expect(
      esquemaEditarInstitucion.safeParse({
        id: "no-uuid",
        nombre: "X",
        tipo: "hospital",
        paisCodigo: "PE",
      }).success,
    ).toBe(false);
  });

  it("estado exige id uuid + boolean", () => {
    expect(esquemaEstadoInstitucion.safeParse({ id: UUID, activa: false }).success).toBe(true);
    expect(esquemaEstadoInstitucion.safeParse({ id: UUID, activa: "no" }).success).toBe(false);
  });
});

describe("esquemaCrearPais", () => {
  it("normaliza el código a mayúsculas de 2 letras", () => {
    const r = esquemaCrearPais.safeParse({ codigo: "br", nombre: "Brasil" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.codigo).toBe("BR");
  });
  it("rechaza códigos que no son 2 letras", () => {
    expect(esquemaCrearPais.safeParse({ codigo: "B", nombre: "X" }).success).toBe(false);
    expect(esquemaCrearPais.safeParse({ codigo: "BR1", nombre: "X" }).success).toBe(false);
  });
});

describe("esquemas de membresías y asignación de paciente", () => {
  it("asignar membresía exige dos uuid", () => {
    expect(
      esquemaAsignarMembresia.safeParse({ profesionalId: UUID, institucionId: UUID2 }).success,
    ).toBe(true);
    expect(
      esquemaAsignarMembresia.safeParse({ profesionalId: "x", institucionId: UUID2 }).success,
    ).toBe(false);
  });

  it("retirar membresía: confirmar por defecto false", () => {
    const r = esquemaRetirarMembresia.safeParse({ membresiaId: UUID });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.confirmar).toBe(false);
  });

  it("asignar institución a paciente exige dos uuid", () => {
    expect(
      esquemaAsignarInstitucionPaciente.safeParse({ pacienteId: UUID, institucionId: UUID2 })
        .success,
    ).toBe(true);
    expect(
      esquemaAsignarInstitucionPaciente.safeParse({ pacienteId: UUID, institucionId: "x" })
        .success,
    ).toBe(false);
  });
});

describe("avisoRetiroMembresia — última institución con pacientes", () => {
  it("avisa cuando NO quedan otras activas y la institución tiene pacientes", () => {
    const aviso = avisoRetiroMembresia({
      otrasMembresiasActivas: 0,
      pacientesEnInstitucion: 3,
      nombreInstitucion: "Clínica Lima",
    });
    expect(aviso).not.toBeNull();
    expect(aviso).toMatch(/Clínica Lima/);
    expect(aviso).toMatch(/3 pacientes/);
  });

  it("usa singular con un único paciente", () => {
    const aviso = avisoRetiroMembresia({
      otrasMembresiasActivas: 0,
      pacientesEnInstitucion: 1,
      nombreInstitucion: "Centro Norte",
    });
    expect(aviso).toMatch(/1 paciente\b/);
  });

  it("NO avisa si el profesional conserva otra institución activa", () => {
    expect(
      avisoRetiroMembresia({
        otrasMembresiasActivas: 1,
        pacientesEnInstitucion: 5,
        nombreInstitucion: "X",
      }),
    ).toBeNull();
  });

  it("NO avisa si la institución no tiene pacientes", () => {
    expect(
      avisoRetiroMembresia({
        otrasMembresiasActivas: 0,
        pacientesEnInstitucion: 0,
        nombreInstitucion: "X",
      }),
    ).toBeNull();
  });
});
