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

  it("reglas_escalado: el SELECT queda gateado a profesional/admin (WP-09 fix 0012)", () => {
    // 0002 dejaba ver las reglas GLOBALES a cualquier autenticado (paciente
    // incluido) por la rama `paciente_id is null`. 0012 lo endurece: el paciente
    // no lee ninguna fila de reglas_escalado. Detectado por acceso_cruzado.sql en vivo.
    const RLS12 = readFileSync(
      join(RAIZ, "supabase", "migrations", "0012_fix_rls_reglas_escalado.sql"),
      "utf8",
    );
    expect(RLS12).toMatch(/reglas_select_profesional/);
    expect(RLS12).toMatch(/es_profesional_o_admin\(\)/);
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

  it("auditoría endurecida (WP-10 ítem 2): el INSERT autenticado exige actor_id = auth.uid()", () => {
    const RLS5 = readFileSync(
      join(RAIZ, "supabase", "migrations", "0005_deuda_tecnica.sql"),
      "utf8",
    );
    // La política se recrea en 0005 con el check estricto (un autenticado solo
    // puede atribuirse eventos a sí mismo; el motor service-role bypasea RLS).
    expect(RLS5).toMatch(/auditoria_insert_autenticado/);
    expect(RLS5).toMatch(/with check \(actor_id = auth\.uid\(\)\)/);
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

  it("ningún componente crea el cliente de navegador durante el render (prerender-safe)", () => {
    // Crear el cliente en el cuerpo/useState de un componente rompe el prerender
    // en build sin variables de entorno (fallo real del deploy a Vercel,
    // 2026-07-17, /restablecer). Debe crearse dentro de useEffect o de un handler.
    const infractores = ficherosProd.filter((p) => {
      const txt = readFileSync(p, "utf8");
      return /useState\(\s*\(\)\s*=>\s*crearClienteNavegador/.test(txt);
    });
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

// =====================================================================
// Patrocinador — privacidad (WP-17). LO MÁS CRÍTICO DEL WP:
//   el rol `patrocinador` NUNCA lee datos identificables ni cortes < 5.
//   Su único acceso a datos clínicos son RPC `security definer` de agregados.
// =====================================================================

const MIG_DIR = join(RAIZ, "supabase", "migrations");
const SQL_TODAS = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(MIG_DIR, f), "utf8"))
  .join("\n");
const SQL_0009 = readFileSync(join(MIG_DIR, "0009_patrocinador.sql"), "utf8");
const SQL_0010 = readFileSync(join(MIG_DIR, "0010_patrocinador_rpc.sql"), "utf8");

/** Tablas con datos de pacientes: el patrocinador NO puede tener acceso a ninguna. */
const TABLAS_PACIENTE = [
  "perfiles",
  "pacientes",
  "pautas_medicacion",
  "checkins",
  "mensajes",
  "observaciones",
  "tomas_medicacion",
  "alertas",
  "consentimientos",
  "informes",
  "disposiciones",
  "programas_paciente",
  "reglas_escalado",
];

describe("Patrocinador — sin acceso a datos de pacientes (WP-17)", () => {
  it("0009 amplía perfiles.rol con 'patrocinador'", () => {
    expect(SQL_0009).toMatch(
      /rol in \('paciente', 'profesional', 'admin', 'patrocinador'\)/,
    );
  });

  it("0009 SOLO crea políticas sobre las tablas del patrocinador (nunca sobre tablas de pacientes)", () => {
    const objetivos = [
      ...SQL_0009.matchAll(/create policy\s+\w+\s+on public\.(\w+)/gi),
    ].map((m) => m[1]);
    expect(objetivos.length).toBeGreaterThan(0);
    for (const t of objetivos) {
      expect(["patrocinadores", "programas_patrocinados"]).toContain(t);
    }
  });

  it("NINGUNA política de una tabla de pacientes menciona 'patrocinador' (sin acceso por diseño)", () => {
    for (const t of TABLAS_PACIENTE) {
      const re = new RegExp(`create policy[^;]*?on public\\.${t}\\b[^;]*;`, "gi");
      const bloques = SQL_TODAS.match(re) ?? [];
      for (const b of bloques) {
        expect(b.toLowerCase()).not.toContain("patrocinador");
      }
    }
  });

  it("patrocinadores y programas_patrocinados tienen RLS habilitada en su migración", () => {
    expect(SQL_0009).toMatch(
      /alter table public\.patrocinadores\s+enable row level security/,
    );
    expect(SQL_0009).toMatch(
      /alter table public\.programas_patrocinados\s+enable row level security/,
    );
  });

  it("las 9 RPC de agregados son security definer, con search_path seguro y guarda de rol", () => {
    const funciones = [...SQL_0010.matchAll(/create or replace function public\.(patro_\w+)/gi)];
    expect(funciones.length).toBe(9);
    // Una guarda de rol por función (patrocinador o admin).
    const guardas = SQL_0010.match(/es_patrocinador\(\) or public\.es_admin\(\)/g) ?? [];
    expect(guardas.length).toBeGreaterThanOrEqual(9);
    // security definer + search_path fijado, uno por función (o más).
    expect((SQL_0010.match(/security definer/g) ?? []).length).toBeGreaterThanOrEqual(9);
    expect((SQL_0010.match(/set search_path = public/g) ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it("las RPC aplican el umbral de k-anonimato (>= 5) en SQL", () => {
    // Cada función suprime cortes < 5; el umbral aparece varias veces en el SQL.
    const umbrales = SQL_0010.match(/>= 5\b/g) ?? [];
    expect(umbrales.length).toBeGreaterThanOrEqual(9);
  });

  it("las RPC quedan revocadas para el rol anon", () => {
    expect((SQL_0010.match(/revoke execute on function[^;]*from anon;/gi) ?? []).length).toBe(9);
  });
});

describe("Patrocinador — route guard del área (WP-17)", () => {
  const LAYOUT = readFileSync(
    join(SRC, "app", "(patrocinador)", "layout.tsx"),
    "utf8",
  );
  const SESION = readFileSync(
    join(SRC, "lib", "patrocinador", "sesion-patrocinador.ts"),
    "utf8",
  );

  it("el layout exige sesión de patrocinador (salvo modo demo) y redirige si no", () => {
    expect(LAYOUT).toMatch(/obtenerSesionPatrocinador/);
    expect(LAYOUT).toMatch(/redirect\(/);
    expect(LAYOUT).toMatch(/modoDemo\(/);
  });

  it("obtenerSesionPatrocinador solo admite rol patrocinador o admin", () => {
    expect(SESION).toMatch(/rol !== "patrocinador"/);
    expect(SESION).toMatch(/rol !== "admin"/);
    expect(SESION).toMatch(/return null/);
  });
});
