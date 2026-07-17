/**
 * Test de la administración conversacional del Termómetro de Distrés (WP-16):
 * la tool `registrar_instrumento` persiste cuando el instrumento está activo y
 * los argumentos VALIDAN (Zod), rechaza los inválidos SIN persistir, y respeta
 * el GATING (si el instrumento no se administra hoy, no se persiste aunque el
 * modelo la invoque). Sin OPENAI_API_KEY ni Supabase (mock + repo en memoria).
 */

import { describe, expect, it } from "vitest";
import type {
  ClienteOpenAI,
  LlamadaHerramienta,
  SalidaChat,
} from "@/lib/ia/openai";
import {
  ejecutarTurno,
  type InstrumentoEntrada,
  type RepositorioCheckin,
} from "@/lib/ia/loop";
import type { DominioCheckin } from "@/lib/ia/conversacion";
import { VERSION_TERMOMETRO_DISTRES_DEFECTO } from "@/lib/instrumentos/termometro";

function llamada(nombre: string, args: unknown): LlamadaHerramienta {
  return {
    id: `call-${Math.random().toString(36).slice(2, 8)}`,
    nombre,
    argumentosJson: JSON.stringify(args),
  };
}

function clienteMock(guion: SalidaChat[]): ClienteOpenAI {
  let i = 0;
  return {
    async crearRespuesta(): Promise<SalidaChat> {
      const salida = i < guion.length ? guion[i] : { contenido: "", llamadas: [] };
      i += 1;
      return salida;
    },
  };
}

function repoMemoria() {
  const instrumentos: InstrumentoEntrada[] = [];
  const repositorio: RepositorioCheckin = {
    async registrarObservacion() {},
    async registrarToma() {},
    async marcarDominioCubierto() {},
    async registrarSenal() {},
    async registrarInstrumento(i) {
      instrumentos.push(i);
    },
  };
  return { repositorio, instrumentos };
}

async function correr(
  guion: SalidaChat[],
  instrumentoActivo: boolean,
): Promise<InstrumentoEntrada[]> {
  const repo = repoMemoria();
  await ejecutarTurno({
    cliente: clienteMock(guion),
    modelo: "modelo-test",
    instrucciones: "x",
    historial: [{ rol: "user", contenido: "he tenido bastante angustia" }],
    repositorio: repo.repositorio,
    contexto: {
      vertical: "general",
      dominiosYaCubiertos: [] as DominioCheckin[],
      instrumentoActivo,
    },
  });
  return repo.instrumentos;
}

describe("registrar_instrumento — persistencia con Zod (instrumento activo)", () => {
  it("persiste puntuación 0–10 y problemas del catálogo; estampa versión y origen", async () => {
    const instrumentos = await correr(
      [
        {
          contenido: null,
          llamadas: [
            llamada("registrar_instrumento", {
              instrumento: "termometro_distres_nccn",
              puntuacion: 8,
              problemas: ["miedo", "preocupacion"],
            }),
          ],
        },
        { contenido: "Gracias por contármelo.", llamadas: [] },
      ],
      true,
    );

    expect(instrumentos).toHaveLength(1);
    expect(instrumentos[0]).toMatchObject({
      instrumento: "termometro_distres_nccn",
      puntuacion: 8,
      problemas: ["miedo", "preocupacion"],
      origen: "conversacional",
      version: VERSION_TERMOMETRO_DISTRES_DEFECTO,
    });
  });

  it("registra solo la puntuación cuando no se aportan problemas", async () => {
    const instrumentos = await correr(
      [
        {
          contenido: null,
          llamadas: [
            llamada("registrar_instrumento", {
              instrumento: "termometro_distres_nccn",
              puntuacion: 2,
            }),
          ],
        },
        { contenido: "Anotado.", llamadas: [] },
      ],
      true,
    );
    expect(instrumentos).toHaveLength(1);
    expect(instrumentos[0].puntuacion).toBe(2);
    expect(instrumentos[0].problemas).toEqual([]);
  });
});

describe("registrar_instrumento — rechaza entradas inválidas (no persiste)", () => {
  it("puntuación fuera de rango (12) no se persiste", async () => {
    const instrumentos = await correr(
      [
        {
          contenido: null,
          llamadas: [
            llamada("registrar_instrumento", {
              instrumento: "termometro_distres_nccn",
              puntuacion: 12,
            }),
          ],
        },
        { contenido: "…", llamadas: [] },
      ],
      true,
    );
    expect(instrumentos).toHaveLength(0);
  });

  it("problema fuera del catálogo NCCN no se persiste", async () => {
    const instrumentos = await correr(
      [
        {
          contenido: null,
          llamadas: [
            llamada("registrar_instrumento", {
              instrumento: "termometro_distres_nccn",
              puntuacion: 6,
              problemas: ["algo_inventado"],
            }),
          ],
        },
        { contenido: "…", llamadas: [] },
      ],
      true,
    );
    expect(instrumentos).toHaveLength(0);
  });
});

describe("registrar_instrumento — gating (instrumento no activo hoy)", () => {
  it("no persiste aunque el modelo la invoque con datos válidos", async () => {
    const instrumentos = await correr(
      [
        {
          contenido: null,
          llamadas: [
            llamada("registrar_instrumento", {
              instrumento: "termometro_distres_nccn",
              puntuacion: 7,
            }),
          ],
        },
        { contenido: "…", llamadas: [] },
      ],
      false, // instrumento NO activo
    );
    expect(instrumentos).toHaveLength(0);
  });
});
