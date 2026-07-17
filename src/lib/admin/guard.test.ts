/**
 * Guardarraíl estático de la consola de administración (WP-23 §1 y §6).
 *
 * Al estilo de `seguridad/auditoria.test.ts`: no reemplaza la verificación EN VIVO
 * (RLS), pero congela invariantes clave del área admin:
 *   - el guard admite SÓLO rol admin (un profesional no entra),
 *   - el layout de /admin aplica el guard con redirect,
 *   - CADA Server Action del admin exige sesión admin (Next 16),
 *   - los pacientes sin institución se listan por `institucion_id is null`,
 *   - el enlace "Administración" sólo se muestra al admin,
 *   - la RLS de 0016 NO se relaja: catálogo y membresías siguen siendo escritura
 *     sólo admin (`es_admin`), y el profesional sólo ve SUS membresías.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const SRC = join(RAIZ, "src");

function leer(...partes: string[]): string {
  return readFileSync(join(RAIZ, ...partes), "utf8");
}

const ACCIONES = [
  join("src", "app", "(panel)", "admin", "instituciones", "acciones.ts"),
  join("src", "app", "(panel)", "admin", "profesionales", "acciones.ts"),
  join("src", "app", "(panel)", "admin", "pacientes", "acciones.ts"),
];

// =====================================================================
// Guard solo-admin
// =====================================================================

describe("guard solo-admin (obtenerSesionAdmin)", () => {
  const SESION = leer("src", "lib", "admin", "sesion-admin.ts");

  it("sólo admite rol admin (cualquier otro rol → null)", () => {
    expect(SESION).toMatch(/rol !== "admin"/);
    expect(SESION).toMatch(/return null/);
  });

  it("es SERVER ONLY (no acaba en un bundle de cliente)", () => {
    expect(SESION).toMatch(/^\s*(\/\*[\s\S]*?\*\/\s*)?import "server-only"/);
  });
});

describe("layout de /admin — route guard con redirect", () => {
  const LAYOUT = leer("src", "app", "(panel)", "admin", "layout.tsx");
  it("exige sesión admin y redirige si no la hay", () => {
    expect(LAYOUT).toMatch(/obtenerSesionAdmin/);
    expect(LAYOUT).toMatch(/redirect\(/);
  });
});

// =====================================================================
// Cada Server Action exige sesión admin
// =====================================================================

describe("cada Server Action del admin exige sesión admin", () => {
  it("todos los ficheros de acciones son \"use server\" y llaman a obtenerSesionAdmin en cada acción", () => {
    for (const rel of ACCIONES) {
      const txt = readFileSync(join(RAIZ, rel), "utf8");
      expect(txt.trimStart().startsWith('"use server"')).toBe(true);
      const exports = (txt.match(/export async function/g) ?? []).length;
      const guards = (txt.match(/obtenerSesionAdmin\(/g) ?? []).length;
      expect(exports).toBeGreaterThan(0);
      // Una comprobación de sesión admin por acción exportada, como mínimo.
      expect(guards).toBeGreaterThanOrEqual(exports);
    }
  });

  it("todas las acciones validan con Zod (safeParse) y auditan", () => {
    for (const rel of ACCIONES) {
      const txt = readFileSync(join(RAIZ, rel), "utf8");
      expect(txt).toMatch(/safeParse/);
      expect(txt).toMatch(/registrarAuditoria|eventos_auditoria/);
    }
  });
});

// =====================================================================
// Pacientes sin institución
// =====================================================================

describe("pacientes sin institución — listado por institucion_id NULL", () => {
  const DATOS = leer("src", "lib", "admin", "datos.ts");
  it("el loader filtra por institucion_id is null", () => {
    expect(DATOS).toMatch(/\.is\("institucion_id",\s*null\)/);
  });
  it("la acción de asignar institución existe y usa el esquema Zod", () => {
    const ACC = leer("src", "app", "(panel)", "admin", "pacientes", "acciones.ts");
    expect(ACC).toMatch(/asignarInstitucionPaciente/);
    expect(ACC).toMatch(/esquemaAsignarInstitucionPaciente/);
  });
});

// =====================================================================
// Enlace "Administración" sólo para admin
// =====================================================================

describe("navegación — 'Administración' condicionada al rol admin", () => {
  const NAV = leer("src", "components", "panel", "NavLateral.tsx");
  const LAYOUT = leer("src", "app", "(panel)", "layout.tsx");
  it("NavLateral añade el ítem admin sólo si esAdmin", () => {
    expect(NAV).toMatch(/esAdmin/);
    expect(NAV).toMatch(/itemAdmin/);
    expect(NAV).toMatch(/esAdmin \? \[\.\.\.itemsBase, itemAdmin\] : itemsBase/);
  });
  it("el layout del panel pasa esAdmin = rol admin", () => {
    expect(LAYOUT).toMatch(/esAdmin=\{rol === "admin"\}/);
  });
});

// =====================================================================
// RLS de 0016 NO relajada
// =====================================================================

describe("RLS de 0016 — catálogo y membresías siguen siendo escritura sólo admin", () => {
  const MIG = readFileSync(
    join(SRC, "..", "supabase", "migrations", "0016_instituciones_pais.sql"),
    "utf8",
  );

  it("instituciones, paises y profesionales_instituciones: escritura gated por es_admin()", () => {
    expect(MIG).toMatch(
      /create policy instituciones_admin_todo on public\.instituciones\s+for all to authenticated using \(public\.es_admin\(\)\)/,
    );
    expect(MIG).toMatch(
      /create policy paises_admin_todo on public\.paises\s+for all to authenticated using \(public\.es_admin\(\)\)/,
    );
    expect(MIG).toMatch(
      /create policy prof_inst_admin_todo on public\.profesionales_instituciones\s+for all to authenticated using \(public\.es_admin\(\)\)/,
    );
  });

  it("el profesional sólo ve SUS membresías (no todas)", () => {
    expect(MIG).toMatch(
      /create policy prof_inst_select_propio on public\.profesionales_instituciones\s+for select to authenticated using \(profesional_id = auth\.uid\(\)\)/,
    );
  });
});
