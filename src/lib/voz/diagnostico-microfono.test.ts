/**
 * Tests del diagnóstico de micrófono (feedback móvil 2026-07-18): cada modo de
 * fallo real tiene pasos accionables y la salida de texto siempre existe.
 */

import { describe, expect, it } from "vitest";
import {
  comprobarSoporteMicrofono,
  explicarErrorMicrofono,
} from "./diagnostico-microfono";

function domErr(name: string): DOMException {
  return new DOMException("simulado", name);
}

describe("explicarErrorMicrofono", () => {
  it("permiso denegado / bloqueo por superposiciones (Android) → pasos de permiso", () => {
    const d = explicarErrorMicrofono(domErr("NotAllowedError"));
    expect(d.titulo).toContain("micrófono");
    expect(d.pasos.join(" ")).toContain("se dibujan encima");
    expect(d.pasos.join(" ")).toContain("candado");
    expect(d.reintentable).toBe(true);
  });

  it("micrófono en uso por otra app → cerrar llamadas y reintentar", () => {
    const d = explicarErrorMicrofono(domErr("NotReadableError"));
    expect(d.pasos.join(" ")).toContain("llamadas");
    expect(d.reintentable).toBe(true);
  });

  it("sin micrófono → indica alternativa de texto", () => {
    const d = explicarErrorMicrofono(domErr("NotFoundError"));
    expect(d.pasos.join(" ")).toContain("texto");
  });

  it("error desconocido → genérico reintentable con salida de texto", () => {
    const d = explicarErrorMicrofono(new Error("algo raro"));
    expect(d.reintentable).toBe(true);
    expect(d.pasos.join(" ")).toContain("texto");
  });
});

describe("comprobarSoporteMicrofono (pre-vuelo, sin prompt)", () => {
  it("contexto no seguro → https requerido, no reintentable", async () => {
    const d = await comprobarSoporteMicrofono({
      mediaDevices: { getUserMedia: () => {} },
      esContextoSeguro: false,
    });
    expect(d?.pasos.join(" ")).toContain("https");
    expect(d?.reintentable).toBe(false);
  });

  it("navegador sin getUserMedia (webview de otra app) → abrir en navegador real", async () => {
    const d = await comprobarSoporteMicrofono({
      mediaDevices: {},
      esContextoSeguro: true,
    });
    expect(d?.pasos.join(" ")).toContain("Abrir en el navegador");
  });

  it("permiso ya denegado (Permissions API) → pasos de permiso sin prompt", async () => {
    const d = await comprobarSoporteMicrofono({
      mediaDevices: { getUserMedia: () => {} },
      permissions: { query: async () => ({ state: "denied" }) },
      esContextoSeguro: true,
    });
    expect(d?.titulo).toContain("bloqueado");
  });

  it("todo listo → null (se intenta con normalidad)", async () => {
    const d = await comprobarSoporteMicrofono({
      mediaDevices: { getUserMedia: () => {} },
      permissions: { query: async () => ({ state: "prompt" }) },
      esContextoSeguro: true,
    });
    expect(d).toBeNull();
  });

  it("Permissions API sin soporte de 'microphone' → null (no bloquea el intento)", async () => {
    const d = await comprobarSoporteMicrofono({
      mediaDevices: { getUserMedia: () => {} },
      permissions: {
        query: async () => {
          throw new TypeError("microphone no soportado");
        },
      },
      esContextoSeguro: true,
    });
    expect(d).toBeNull();
  });
});
