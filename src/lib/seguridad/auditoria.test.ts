/**
 * Auditoría de seguridad AUTOMATIZADA (WP-08, punto a).
 *
 * Estos tests son un guardarraíl estático que corre en CI (`npm test`) y
 * bloquea regresiones de las invariantes de seguridad revisadas a mano en cada
 * WP. NO reemplazan la verificación de acceso cruzado EN VIVO (que exige un
 * proyecto Supabase; ver `supabase/tests/acceso_cruzado.sql`), pero sí congelan:
 *
 *  - la matriz de RLS de WP-01 (RLS activa en las 11 tablas; el paciente no se
 *    auto-prescribe; no crea/edita alertas; sin acceso a reglas_escalado),
 *  - que ninguna clave/secreto ni el cliente service-role llega al cliente,
 *  - que todos los Route Handlers comprueban autorización DENTRO (regla Next 16).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const SRC = join(RAIZ, "src");
const RLS = readFileSync(
  join(RAIZ, "supabase", "migrations", "0002_rls.sql"),
  "utf8",
);

/** Recorre `dir` y devuelve todos los ficheros que cumplan `filtro`. */
function listar(dir: string, filtro: (p: string) => boolean): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) salida.push(...listar(p, filtro));
    else if (filtro(p)) salida.push(p);
  }
  return salida;
}

const ficherosTs = listar(
  SRC,
  (p) => (p.endsWith(".ts") || p.endsWith(".tsx")) && !p.endsWith(".d.ts"),
);

/** Código de producción (excluye tests, que no se empaquetan al cliente). */
const ficherosProd = ficherosTs.filter(
  (p) => !p.endsWith(".test.ts") && !p.endsWith(".test.tsx"),
);

// =====================================================================
// RLS — matriz de WP-01, política por política
// =====================================================================

describe("RLS — invariantes de la matriz de acceso (WP-01)", () => {
  const TABLAS = [
    "perfiles",
    "pacientes",
    "pautas_medicacion",
    "checkins",
    "mensajes",
    "observaciones",
    "tomas_medicacion",
    "reglas_escalado",
    "alertas",
    "consentimientos",
    "eventos_auditoria",
  ];

  it("las 11 tablas tienen RLS habilitada", () => {
    for (const t of TABLAS) {
      // Robusto e independiente del espaciado del SQL.
      const re = new RegExp(`alter table public\\.${t}\\s+enable row level security`);
      expect(RLS).toMatch(re);
    }
  });

  it("el paciente NO se auto-prescribe: pautas_medicacion sin políticas de escritura del paciente", () => {
    // Solo debe existir lectura propia; nada de insert/update 'propio'.
    expect(RLS).toContain("pautas_select_propio");
    expect(RLS).not.toContain("pautas_insert_propio");
    expect(RLS).not.toContain("pautas_update_propio");
  });

  it("el paciente NO crea ni edita alertas: solo SELECT de las suyas", () => {
    expect(RLS).toContain("alertas_select_propio");
    expect(RLS).not.toContain("alertas_insert_propio");
    expect(RLS).not.toContain("alertas_update_propio");
    expect(RLS).not.toContain("alertas_delete_propio");
  });

  it("reglas_escalado no tiene ninguna política de paciente (sin acceso)", () => {
    // Las políticas de reglas son solo profesional/admin.
    expect(RLS).toContain("reglas_select_profesional");
    expect(RLS).not.toMatch(/reglas_\w*_propio/);
  });

  it("consentimientos y eventos_auditoria son append-only (sin UPDATE/DELETE)", () => {
    // No debe haber políticas 'for update'/'for delete' sobre estas tablas.
    expect(RLS).not.toMatch(/on public\.consentimientos\s+for (update|delete)/);
    expect(RLS).not.toMatch(/on public\.eventos_auditoria\s+for (update|delete)/);
  });

  it("todas las políticas se restringen a 'authenticated' (anon sin acceso)", () => {
    // Ninguna política concede acceso al rol anon.
    expect(RLS).not.toMatch(/create policy[\s\S]*?\sto anon\b/);
  });
});

// =====================================================================
// Secretos / service-role — nada llega al cliente
// =====================================================================

describe("Secretos y service-role", () => {
  it("service_role/SERVICE_ROLE solo aparece en admin.ts (código de producción)", () => {
    const infractores = ficherosProd.filter((p) => {
      if (p.endsWith(join("lib", "supabase", "admin.ts"))) return false;
      const txt = readFileSync(p, "utf8");
      return /service_role|SERVICE_ROLE/.test(txt);
    });
    expect(infractores.map((p) => relative(RAIZ, p))).toEqual([]);
  });

  it("admin.ts empieza con import \"server-only\"", () => {
    const admin = readFileSync(join(SRC, "lib", "supabase", "admin.ts"), "utf8");
    expect(admin.trimStart().startsWith('import "server-only"')).toBe(true);
  });

  it("no hay claves de OpenAI (sk-...) hardcodeadas en el código de producción", () => {
    const infractores = ficherosProd.filter((p) =>
      /\bsk-[A-Za-z0-9]{16,}\b/.test(readFileSync(p, "utf8")),
    );
    expect(infractores.map((p) => relative(RAIZ, p))).toEqual([]);
  });

  it("ningún componente de cliente importa admin.ts ni el transporte de voz", () => {
    const infractores = ficherosTs.filter((p) => {
      const txt = readFileSync(p, "utf8");
      const esCliente = /^\s*["']use client["']/.test(txt);
      if (!esCliente) return false;
      return (
        /@\/lib\/supabase\/admin/.test(txt) ||
        /openai-realtime/.test(txt) ||
        /server-only/.test(txt)
      );
    });
    expect(infractores.map((p) => relative(RAIZ, p))).toEqual([]);
  });
});

// =====================================================================
// Route Handlers — autorización DENTRO del handler (regla Next 16)
// =====================================================================

describe("Route Handlers — autorización dentro del handler", () => {
  const rutas = ficherosTs.filter(
    (p) =>
      p.includes(join("app", "api")) &&
      p.endsWith(join("route.ts")) &&
      !p.endsWith(".test.ts"),
  );

  it("hay Route Handlers detectados", () => {
    expect(rutas.length).toBeGreaterThan(0);
  });

  it("cada Route Handler comprueba sesión (getUser) o el secreto del cron", () => {
    const sinAuth = rutas.filter((p) => {
      const txt = readFileSync(p, "utf8");
      const compruebaSesion = /auth\.getUser\s*\(/.test(txt);
      const esCron = /autorizarCron|CRON_SECRET/.test(txt);
      return !compruebaSesion && !esCron;
    });
    expect(sinAuth.map((p) => relative(RAIZ, p))).toEqual([]);
  });

  it("cada Route Handler valida el cuerpo con Zod o no recibe cuerpo", () => {
    // Handlers con cuerpo (POST con request.json) deben usar un esquema Zod.
    const sinZod = rutas.filter((p) => {
      const txt = readFileSync(p, "utf8");
      const leeCuerpo = /request\.json\s*\(/.test(txt);
      if (!leeCuerpo) return false;
      return !/safeParse|z\.object|esquema/.test(txt);
    });
    expect(sinZod.map((p) => relative(RAIZ, p))).toEqual([]);
  });
});
