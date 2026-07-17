/**
 * Tests de "Mis datos" del paciente (WP-20 §C): el esquema acepta los campos NO
 * clínicos válidos y RECHAZA cualquier campo clínico (vertical/condiciones/
 * programa/pautas) por ser `.strict()`. Es la garantía, junto con la RLS
 * `..._update_propio`, de que el paciente solo edita lo suyo y solo lo no clínico.
 */

import { describe, expect, it } from "vitest";
import {
  esquemaMisDatos,
  horaAColumna,
  horaDesdeColumna,
} from "./datos-perfil";
import { esZonaHorariaValida } from "./zonas";

const BASE = {
  nombre: "María Pérez",
  telefono: "+51 900 111 222",
  horaCheckin: "09:30",
  zonaHoraria: "America/Lima",
};

describe("esquemaMisDatos", () => {
  it("acepta datos no clínicos válidos", () => {
    expect(esquemaMisDatos.safeParse(BASE).success).toBe(true);
  });

  it("acepta teléfono vacío (opcional)", () => {
    expect(esquemaMisDatos.safeParse({ ...BASE, telefono: "" }).success).toBe(true);
  });

  it("rechaza una hora con formato inválido", () => {
    expect(esquemaMisDatos.safeParse({ ...BASE, horaCheckin: "25:99" }).success).toBe(
      false,
    );
    expect(esquemaMisDatos.safeParse({ ...BASE, horaCheckin: "9am" }).success).toBe(false);
  });

  it("rechaza una zona horaria fuera del catálogo ofrecido", () => {
    expect(
      esquemaMisDatos.safeParse({ ...BASE, zonaHoraria: "Marte/Olympus" }).success,
    ).toBe(false);
  });

  it("RECHAZA campos clínicos (vertical/condiciones/programa/pautas)", () => {
    expect(esquemaMisDatos.safeParse({ ...BASE, vertical: "mental" }).success).toBe(false);
    expect(
      esquemaMisDatos.safeParse({ ...BASE, condiciones: ["x"] }).success,
    ).toBe(false);
    expect(
      esquemaMisDatos.safeParse({ ...BASE, programaClave: "mama_terapia_oral" }).success,
    ).toBe(false);
    expect(esquemaMisDatos.safeParse({ ...BASE, hora_checkin: "10:00" }).success).toBe(
      false,
    );
  });
});

describe("conversión de hora ⇄ columna time", () => {
  it("añade segundos para la columna", () => {
    expect(horaAColumna("09:30")).toBe("09:30:00");
    expect(horaAColumna("09:30:00")).toBe("09:30:00");
  });
  it("recorta la columna a HH:MM para el input", () => {
    expect(horaDesdeColumna("09:30:00")).toBe("09:30");
    expect(horaDesdeColumna("09:30:00+00")).toBe("09:30");
    expect(horaDesdeColumna(null)).toBe("10:00");
  });
});

describe("esZonaHorariaValida", () => {
  it("reconoce zonas ofrecidas y rechaza otras", () => {
    expect(esZonaHorariaValida("Europe/Madrid")).toBe(true);
    expect(esZonaHorariaValida("America/Lima")).toBe(true);
    expect(esZonaHorariaValida("America/Nueva_York")).toBe(false);
  });
});
