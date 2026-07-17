/**
 * Tests de la recuperación de contraseña (WP-20 §B), lógica pura:
 *   - el mensaje tras pedir el enlace NO revela si el email existe,
 *   - la contraseña nueva se valida (longitud + coincidencia),
 *   - la URL de redirección del enlace se construye bien desde el origin.
 */

import { describe, expect, it } from "vitest";
import {
  MENSAJE_NEUTRO_RECUPERACION,
  MIN_LONGITUD_PASSWORD,
  urlRedireccionRestablecer,
  validarPasswordNueva,
} from "./recuperacion";

describe("mensaje neutro de recuperación", () => {
  it("no menciona si el correo existe o no (condicional 'si')", () => {
    expect(MENSAJE_NEUTRO_RECUPERACION.toLowerCase()).toContain("si tu correo");
    expect(MENSAJE_NEUTRO_RECUPERACION.toLowerCase()).not.toContain("no existe");
    expect(MENSAJE_NEUTRO_RECUPERACION.toLowerCase()).not.toContain("no está registrado");
  });
});

describe("validarPasswordNueva", () => {
  it("acepta una contraseña válida que coincide", () => {
    expect(validarPasswordNueva("contrasena1", "contrasena1")).toEqual({ ok: true });
  });

  it("rechaza si es demasiado corta", () => {
    const r = validarPasswordNueva("corta", "corta");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain(String(MIN_LONGITUD_PASSWORD));
  });

  it("rechaza si las dos no coinciden", () => {
    const r = validarPasswordNueva("contrasena1", "contrasena2");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/no coinciden/i);
  });
});

describe("urlRedireccionRestablecer", () => {
  it("apunta a /restablecer y respeta el origin", () => {
    expect(urlRedireccionRestablecer("https://botsy.app")).toBe(
      "https://botsy.app/restablecer",
    );
  });
  it("no duplica la barra final del origin", () => {
    expect(urlRedireccionRestablecer("http://localhost:3000/")).toBe(
      "http://localhost:3000/restablecer",
    );
  });
});
