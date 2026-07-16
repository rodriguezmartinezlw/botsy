import { describe, expect, it } from "vitest";
import { destinoSeguro, rutaPorRol } from "./roles";

describe("rutaPorRol", () => {
  it("profesional/admin → /pacientes, resto → /inicio", () => {
    expect(rutaPorRol("profesional")).toBe("/pacientes");
    expect(rutaPorRol("admin")).toBe("/pacientes");
    expect(rutaPorRol("paciente")).toBe("/inicio");
    expect(rutaPorRol(null)).toBe("/inicio");
  });
});

describe("destinoSeguro (WP-10 ítem 6, anti open-redirect)", () => {
  it("acepta rutas internas relativas", () => {
    expect(destinoSeguro("/pacientes")).toBe("/pacientes");
    expect(destinoSeguro("/pacientes/abc?tab=medicacion")).toBe(
      "/pacientes/abc?tab=medicacion",
    );
  });

  it("rechaza destinos externos o peligrosos", () => {
    expect(destinoSeguro("//evil.com")).toBeNull();
    expect(destinoSeguro("https://evil.com")).toBeNull();
    expect(destinoSeguro("/\\evil.com")).toBeNull();
    expect(destinoSeguro("javascript:alert(1)")).toBeNull();
    expect(destinoSeguro("pacientes")).toBeNull(); // no empieza por /
    expect(destinoSeguro("")).toBeNull();
    expect(destinoSeguro(null)).toBeNull();
    expect(destinoSeguro(42)).toBeNull();
  });
});
