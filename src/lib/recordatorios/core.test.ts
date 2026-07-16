/**
 * Tests del núcleo de recordatorios (WP-07).
 *
 * Demuestran el criterio de aceptación (b):
 *  - `autorizarCron`: acepta el CRON_SECRET correcto, rechaza el incorrecto o
 *    ausente (base del 401 del handler);
 *  - `procesarRecordatorios`: con dependencias simuladas, envía email y lo
 *    audita para el paciente que corresponde, y NO reenvía si ya se envió hoy.
 */

import { describe, expect, it, vi } from "vitest";
import {
  autorizarCron,
  debeRecordar,
  procesarRecordatorios,
  type EntradaRecordatorio,
} from "./core";

describe("autorizarCron", () => {
  it("acepta el secreto correcto", () => {
    expect(autorizarCron("Bearer s3cr3t", "s3cr3t")).toBe(true);
  });
  it("rechaza un secreto incorrecto", () => {
    expect(autorizarCron("Bearer malo", "s3cr3t")).toBe(false);
  });
  it("rechaza si falta la cabecera", () => {
    expect(autorizarCron(null, "s3cr3t")).toBe(false);
    expect(autorizarCron(undefined, "s3cr3t")).toBe(false);
  });
  it("rechaza si el secreto no está configurado", () => {
    expect(autorizarCron("Bearer s3cr3t", undefined)).toBe(false);
    expect(autorizarCron("Bearer s3cr3t", "")).toBe(false);
  });
});

describe("debeRecordar", () => {
  // 12:00 UTC = 14:00 en Europe/Madrid (verano, UTC+2), fecha 2026-07-16.
  const ahora = new Date("2026-07-16T12:00:00Z");

  it("procede si la hora ya pasó y no hay check-in hoy", () => {
    const e: EntradaRecordatorio = {
      pacienteId: "p1",
      nombre: "Luis",
      zona: "Europe/Madrid",
      horaCheckin: "09:30:00",
      fechasConCheckin: [],
    };
    const r = debeRecordar(e, ahora);
    expect(r.fecha).toBe("2026-07-16");
    expect(r.procede).toBe(true);
  });

  it("no procede si ya tiene check-in hoy", () => {
    const e: EntradaRecordatorio = {
      pacienteId: "p2",
      nombre: "Ana",
      zona: "Europe/Madrid",
      horaCheckin: "09:30:00",
      fechasConCheckin: ["2026-07-16"],
    };
    expect(debeRecordar(e, ahora).procede).toBe(false);
  });

  it("no procede si su hora aún no ha llegado", () => {
    const e: EntradaRecordatorio = {
      pacienteId: "p3",
      nombre: "Marta",
      zona: "Europe/Madrid",
      horaCheckin: "23:00:00",
      fechasConCheckin: [],
    };
    expect(debeRecordar(e, ahora).procede).toBe(false);
  });
});

describe("procesarRecordatorios", () => {
  const ahora = new Date("2026-07-16T12:00:00Z");

  const entradas: EntradaRecordatorio[] = [
    {
      pacienteId: "p1",
      nombre: "Luis",
      zona: "Europe/Madrid",
      horaCheckin: "09:30:00",
      fechasConCheckin: [],
    },
    {
      pacienteId: "p2",
      nombre: "Ana",
      zona: "Europe/Madrid",
      horaCheckin: "09:30:00",
      fechasConCheckin: ["2026-07-16"], // ya hizo check-in
    },
    {
      pacienteId: "p3",
      nombre: "Marta",
      zona: "Europe/Madrid",
      horaCheckin: "23:00:00", // hora no llegada
      fechasConCheckin: [],
    },
  ];

  it("envía y audita sólo al paciente que corresponde", async () => {
    const emails: string[] = [];
    const auditados: string[] = [];
    const resumen = await procesarRecordatorios(entradas, {
      ahora,
      yaEnviadoHoy: async () => false,
      enviarEmail: async ({ pacienteId }) => {
        emails.push(pacienteId);
      },
      registrarEnvio: async (pacienteId) => {
        auditados.push(pacienteId);
      },
    });

    expect(emails).toEqual(["p1"]);
    expect(auditados).toEqual(["p1"]);
    expect(resumen).toEqual({
      candidatos: 3,
      enviados: 1,
      omitidos: 2,
      errores: 0,
    });
  });

  it("no reenvía si ya se envió hoy", async () => {
    const enviarEmail = vi.fn(async () => {});
    const resumen = await procesarRecordatorios([entradas[0]], {
      ahora,
      yaEnviadoHoy: async () => true, // ya enviado
      enviarEmail,
      registrarEnvio: async () => {},
    });
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(resumen.enviados).toBe(0);
    expect(resumen.omitidos).toBe(1);
  });

  it("cuenta como error si el envío falla, sin abortar el resto", async () => {
    const resumen = await procesarRecordatorios([entradas[0]], {
      ahora,
      yaEnviadoHoy: async () => false,
      enviarEmail: async () => {
        throw new Error("Resend caído");
      },
      registrarEnvio: async () => {},
    });
    expect(resumen.errores).toBe(1);
    expect(resumen.enviados).toBe(0);
  });
});
