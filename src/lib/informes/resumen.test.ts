/**
 * Tests del resumen ejecutivo del informe (WP-07).
 *
 * Demuestran el criterio de aceptación (a): el resumen NO contiene ninguna cifra
 * que no exista en los datos.
 *  - Al armar el prompt SÓLO se pasan cifras reales (las de `construirHechos`).
 *  - Si el LLM devuelve una cifra inventada, el resumen se DESCARTA (informe sin
 *    resumen).
 *  - Si el LLM falla, el informe sale sin resumen.
 */

import { describe, expect, it, vi } from "vitest";
import type { ClienteOpenAI, EntradaChat, SalidaChat } from "@/lib/ia/openai";
import type { DatosInforme } from "./tipos";
import {
  cifrasPermitidas,
  construirHechos,
  extraerCifras,
  generarResumenEjecutivo,
  validarResumenSinCifrasInventadas,
} from "./resumen";

const MODELO = "gpt-5-mini";

/** Fixture equivalente al seed de Luis (30 días). Todas las cifras son reales. */
function datosLuis(): DatosInforme {
  return {
    paciente: {
      id: "luis",
      nombre: "Luis",
      inicial: "L",
      edad: 68,
      sexo: "masculino",
      vertical: "cardiovascular",
      condiciones: ["Hipertensión", "Fibrilación auricular"],
    },
    periodo: { desde: "2026-06-16", hasta: "2026-07-15", dias: 30 },
    totalCheckins: 14,
    dolor: {
      serie: [
        { fecha: "2026-07-11", valor: 5 },
        { fecha: "2026-07-12", valor: 4 },
        { fecha: "2026-07-13", valor: 3 },
        { fecha: "2026-07-14", valor: 2 },
        { fecha: "2026-07-15", valor: 2 },
      ],
      media: 5,
      pico: 8,
      minimo: 2,
      registros: 14,
    },
    animo: {
      animo: { media: 6.5, registros: 14 },
      ansiedad: { media: null, registros: 0 },
      estres: { media: null, registros: 0 },
    },
    adherencia: {
      global: { porcentaje: 93, tomadas: 26, omitidas: 2 },
      farmacos: [
        {
          farmaco: "Ácido acetilsalicílico",
          dosis: "100 mg",
          critica: false,
          porcentaje: 100,
          tomadas: 14,
          omitidas: 0,
          semana: [],
        },
        {
          farmaco: "Warfarina",
          dosis: "5 mg",
          critica: true,
          porcentaje: 86,
          tomadas: 12,
          omitidas: 2,
          semana: [],
        },
      ],
    },
    alertas: [
      {
        id: "a1",
        nivel: "contactar",
        estado: "nueva",
        motivo: "Fármaco crítico omitido",
        evidencia: {},
        creadoEn: "2026-07-15T09:35:00Z",
        gestionadaEn: null,
        motivoDescarte: null,
      },
    ],
    sintomas: [],
    observaciones: [],
    consentimientos: [
      { tipo: "conversacion", otorgado: true },
      { tipo: "voz_grabacion", otorgado: true },
      { tipo: "voz_biomarcadores", otorgado: false },
    ],
  };
}

function clienteMock(
  responder: (entrada: EntradaChat) => SalidaChat | Promise<SalidaChat>,
): { cliente: ClienteOpenAI; capturas: EntradaChat[] } {
  const capturas: EntradaChat[] = [];
  const cliente: ClienteOpenAI = {
    async crearRespuesta(entrada) {
      capturas.push(entrada);
      return responder(entrada);
    },
  };
  return { cliente, capturas };
}

describe("construirHechos / cifrasPermitidas", () => {
  it("los hechos sólo contienen cifras presentes en los datos", () => {
    const datos = datosLuis();
    const hechos = construirHechos(datos);
    const permitidas = cifrasPermitidas(datos, hechos);

    // Todas las cifras de cada hecho deben estar en el conjunto permitido.
    for (const h of hechos) {
      for (const c of extraerCifras(h.texto)) {
        expect(permitidas.has(c)).toBe(true);
      }
    }
    // Y las cifras clave del seed aparecen.
    for (const esperado of ["30", "14", "93", "86", "100", "8", "2"]) {
      expect(permitidas.has(esperado)).toBe(true);
    }
  });
});

describe("validarResumenSinCifrasInventadas", () => {
  it("acepta un texto cuyas cifras están todas permitidas", () => {
    const permitidas = new Set(["30", "14", "93"]);
    const r = validarResumenSinCifrasInventadas(
      "En 30 días hubo 14 check-ins y 93% de adherencia.",
      permitidas,
    );
    expect(r.ok).toBe(true);
  });

  it("rechaza un texto con una cifra ajena y la reporta", () => {
    const permitidas = new Set(["30", "14"]);
    const r = validarResumenSinCifrasInventadas(
      "En 30 días el dolor bajó un 42%.",
      permitidas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.intrusas).toContain("42");
  });
});

describe("generarResumenEjecutivo", () => {
  it("al armar el prompt SÓLO pasa cifras reales (las de los datos)", async () => {
    const datos = datosLuis();
    const { cliente, capturas } = clienteMock(() => ({
      contenido: "Resumen breve sin cifras.",
      llamadas: [],
    }));
    await generarResumenEjecutivo(cliente, datos, MODELO);

    expect(capturas).toHaveLength(1);
    const permitidas = cifrasPermitidas(datos, construirHechos(datos));
    const mensajeUsuario = capturas[0].mensajes
      .filter((m) => m.rol === "user")
      .map((m) => (m.rol === "user" ? m.contenido : ""))
      .join("\n");
    for (const c of extraerCifras(mensajeUsuario)) {
      expect(permitidas.has(c)).toBe(true);
    }
  });

  it("acepta un resumen que sólo usa cifras existentes", async () => {
    const datos = datosLuis();
    const { cliente } = clienteMock(() => ({
      contenido:
        "Durante los 30 días se registraron 14 check-ins. El dolor tuvo una media de 5 sobre 10, con máximo de 8 y mínimo de 2. La adherencia global fue del 93%, con la warfarina en 86%. Se registró 1 alerta de contactar.",
      llamadas: [],
    }));
    const r = await generarResumenEjecutivo(cliente, datos, MODELO);
    expect(r.estado).toBe("ok");
  });

  it("DESCARTA el resumen si el LLM introduce una cifra inventada", async () => {
    const datos = datosLuis();
    const { cliente } = clienteMock(() => ({
      // 42 no existe en los datos: alucinación.
      contenido: "El dolor mejoró un 42% respecto al periodo anterior.",
      llamadas: [],
    }));
    const r = await generarResumenEjecutivo(cliente, datos, MODELO);
    expect(r.estado).toBe("sin_resumen");
    if (r.estado === "sin_resumen") expect(r.motivo).toBe("cifras_invalidas");
  });

  it("sale sin resumen si el proveedor (OpenAI) falla", async () => {
    const datos = datosLuis();
    const { cliente } = clienteMock(() => {
      throw new Error("503 del proveedor");
    });
    const r = await generarResumenEjecutivo(cliente, datos, MODELO);
    expect(r.estado).toBe("sin_resumen");
    if (r.estado === "sin_resumen") expect(r.motivo).toBe("error_proveedor");
  });

  it("no llama al LLM si no hay datos (0 check-ins)", async () => {
    const datos = { ...datosLuis(), totalCheckins: 0 };
    const spy = vi.fn();
    const cliente: ClienteOpenAI = {
      async crearRespuesta(e) {
        spy(e);
        return { contenido: "x", llamadas: [] };
      },
    };
    const r = await generarResumenEjecutivo(cliente, datos, MODELO);
    expect(r.estado).toBe("sin_resumen");
    if (r.estado === "sin_resumen") expect(r.motivo).toBe("sin_datos");
    expect(spy).not.toHaveBeenCalled();
  });
});
