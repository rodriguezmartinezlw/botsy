/**
 * Tests de la disposición estructurada (WP-11 v2 §B) — PUROS.
 *
 * Cubre los criterios de aceptación:
 *  - resolver/descartar SIN disposición completa → RECHAZADO;
 *  - "desenlaces pendientes" listados por vencimiento.
 */

import { describe, expect, it } from "vitest";
import {
  validarDisposicion,
  esquemaRegistrarDesenlace,
  desenlacePendienteVencido,
  filtrarDesenlacesPendientes,
  type DisposicionSeguimiento,
} from "./nucleo";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_MOTIVO = "22222222-2222-4222-8222-222222222222";

describe("validarDisposicion — exige disposición completa", () => {
  it("RECHAZA cerrar una alerta sin disposición (solo alertaId)", () => {
    const r = validarDisposicion({ alertaId: UUID_A });
    expect(r.ok).toBe(false);
  });

  it("RECHAZA si falta la decisión", () => {
    const r = validarDisposicion({
      alertaId: UUID_A,
      motivoCodigo: UUID_MOTIVO,
      diasSeguimiento: 7,
    });
    expect(r.ok).toBe(false);
  });

  it("RECHAZA si falta el motivo del catálogo", () => {
    const r = validarDisposicion({
      alertaId: UUID_A,
      decision: "contactado_paciente",
      diasSeguimiento: 7,
    });
    expect(r.ok).toBe(false);
  });

  it("RECHAZA si faltan los días de seguimiento", () => {
    const r = validarDisposicion({
      alertaId: UUID_A,
      decision: "contactado_paciente",
      motivoCodigo: UUID_MOTIVO,
    });
    expect(r.ok).toBe(false);
  });

  it("RECHAZA una decisión fuera del vocabulario", () => {
    const r = validarDisposicion({
      alertaId: UUID_A,
      decision: "lo_que_sea",
      motivoCodigo: UUID_MOTIVO,
      diasSeguimiento: 7,
    });
    expect(r.ok).toBe(false);
  });

  it("ACEPTA una disposición completa y válida", () => {
    const r = validarDisposicion({
      alertaId: UUID_A,
      decision: "derivado_urgencias",
      motivoCodigo: UUID_MOTIVO,
      diasSeguimiento: 3,
      motivoTexto: "Fiebre alta, derivada a urgencias.",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.decision).toBe("derivado_urgencias");
      expect(r.datos.diasSeguimiento).toBe(3);
    }
  });

  it("RECHAZA campos extra (schema estricto)", () => {
    const r = validarDisposicion({
      alertaId: UUID_A,
      decision: "observacion",
      motivoCodigo: UUID_MOTIVO,
      diasSeguimiento: 7,
      inyeccion: "x",
    });
    expect(r.ok).toBe(false);
  });
});

describe("registrar desenlace — no admite 'pendiente'", () => {
  it("acepta un desenlace real", () => {
    expect(
      esquemaRegistrarDesenlace.safeParse({
        disposicionId: UUID_A,
        desenlace: "resuelto_sin_evento",
      }).success,
    ).toBe(true);
  });

  it("rechaza 'pendiente' como desenlace a registrar", () => {
    expect(
      esquemaRegistrarDesenlace.safeParse({
        disposicionId: UUID_A,
        desenlace: "pendiente",
      }).success,
    ).toBe(false);
  });
});

describe("desenlaces pendientes por vencimiento", () => {
  const hoy = "2026-07-16T12:00:00.000Z";

  function disp(
    id: string,
    creadoEn: string,
    diasSeguimiento: number,
    desenlace: DisposicionSeguimiento["desenlace"] = "pendiente",
  ): DisposicionSeguimiento {
    return { id, creadoEn, diasSeguimiento, desenlace };
  }

  it("una disposición cuyo seguimiento venció y sigue pendiente está vencida", () => {
    // creada hace 10 días, seguimiento 7 → venció hace 3.
    const d = disp("a", "2026-07-06T09:00:00.000Z", 7);
    expect(desenlacePendienteVencido(d, hoy)).toBe(true);
  });

  it("una disposición cuyo seguimiento aún no vence NO está pendiente-vencida", () => {
    // creada ayer, seguimiento 7 → vence dentro de 6 días.
    const d = disp("b", "2026-07-15T09:00:00.000Z", 7);
    expect(desenlacePendienteVencido(d, hoy)).toBe(false);
  });

  it("una disposición con desenlace ya registrado nunca cuenta", () => {
    const d = disp("c", "2026-07-01T09:00:00.000Z", 7, "resuelto_sin_evento");
    expect(desenlacePendienteVencido(d, hoy)).toBe(false);
  });

  it("filtra y ordena por vencimiento ascendente (lo más atrasado primero)", () => {
    const lista = [
      disp("reciente", "2026-07-14T09:00:00.000Z", 1), // venció 15-jul
      disp("antiguo", "2026-06-20T09:00:00.000Z", 5), // venció 25-jun
      disp("futuro", "2026-07-16T09:00:00.000Z", 30), // aún no vence
      disp("resuelto", "2026-06-01T09:00:00.000Z", 3, "urgencias"),
    ];
    const pendientes = filtrarDesenlacesPendientes(lista, hoy);
    expect(pendientes.map((d) => d.id)).toEqual(["antiguo", "reciente"]);
  });
});
