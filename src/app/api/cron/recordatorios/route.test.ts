/**
 * Test del handler GET /api/cron/recordatorios (WP-07), foco en la AUTORIZACIÓN.
 *
 * - Sin cabecera o con secreto incorrecto → 401.
 * - Con el secreto correcto NO devuelve 401: la autorización pasa (a partir de
 *   ahí necesitaría Supabase/Resend reales, fuera del alcance del test; el envío
 *   real se demuestra con `procesarRecordatorios` en core.test.ts).
 *
 * El handler importa Supabase/Resend DINÁMICAMENTE tras validar el secreto, así
 * que este test corre sin infraestructura ni `server-only` en el grafo de carga.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const URL = "http://localhost/api/cron/recordatorios";

describe("GET /api/cron/recordatorios", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = "secreto-cron";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("401 sin cabecera Authorization", async () => {
    const res = await GET(new Request(URL));
    expect(res.status).toBe(401);
  });

  it("401 con secreto incorrecto", async () => {
    const res = await GET(
      new Request(URL, { headers: { authorization: "Bearer incorrecto" } }),
    );
    expect(res.status).toBe(401);
  });

  it("con el secreto correcto pasa la autorización (no 401)", async () => {
    const res = await GET(
      new Request(URL, { headers: { authorization: "Bearer secreto-cron" } }),
    );
    expect(res.status).not.toBe(401);
  });
});
