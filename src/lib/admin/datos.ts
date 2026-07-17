/**
 * Carga de datos de la consola de administración (WP-23) — SERVER ONLY.
 *
 * Todas las lecturas usan el cliente de SERVIDOR (cookies): la RLS de 0016 da al
 * admin lectura del catálogo y de las membresías (`es_admin()`), y la de 0002 le
 * da lectura de perfiles y pacientes (`*_admin_todo`). NO se usa service-role
 * para leer: la RLS de admin hace el trabajo. Ninguna función lanza; ante falta
 * de sesión/datos devuelven valores vacíos coherentes.
 */

import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import type {
  InstitucionOpcion,
  InstitucionVista,
  PacienteSinInstitucionVista,
  PaisVista,
  ProfesionalVista,
  ResumenAdmin,
} from "./tipos";
import type { TipoInstitucion } from "@/types/db";

function inicialDe(nombre: string): string {
  const limpio = (nombre ?? "").trim();
  return limpio.length > 0 ? limpio[0].toUpperCase() : "?";
}

// =====================================================================
// Países (catálogo).
// =====================================================================

export async function listarPaises(): Promise<PaisVista[]> {
  try {
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .from("paises")
      .select("codigo, nombre")
      .order("nombre", { ascending: true });
    return (data ?? []).map((p) => ({ codigo: p.codigo, nombre: p.nombre }));
  } catch {
    return [];
  }
}

// =====================================================================
// Instituciones (con país y conteos de profesionales/pacientes).
// =====================================================================

export async function listarInstitucionesAdmin(): Promise<InstitucionVista[]> {
  try {
    const supabase = await crearClienteServidor();
    const [{ data: instituciones }, { data: paises }, { data: membresias }, { data: pacientes }] =
      await Promise.all([
        supabase
          .from("instituciones")
          .select("id, nombre, tipo, pais_codigo, activa")
          .order("nombre", { ascending: true }),
        supabase.from("paises").select("codigo, nombre"),
        supabase
          .from("profesionales_instituciones")
          .select("institucion_id, activa"),
        supabase.from("pacientes").select("id, institucion_id"),
      ]);
    if (!instituciones || instituciones.length === 0) return [];

    const nombrePais = new Map((paises ?? []).map((p) => [p.codigo, p.nombre]));

    const profesionalesPorInst = new Map<string, number>();
    for (const m of membresias ?? []) {
      if (!m.activa) continue;
      profesionalesPorInst.set(
        m.institucion_id,
        (profesionalesPorInst.get(m.institucion_id) ?? 0) + 1,
      );
    }

    const pacientesPorInst = new Map<string, number>();
    for (const p of pacientes ?? []) {
      if (!p.institucion_id) continue;
      pacientesPorInst.set(
        p.institucion_id,
        (pacientesPorInst.get(p.institucion_id) ?? 0) + 1,
      );
    }

    return instituciones.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      tipo: i.tipo as TipoInstitucion,
      paisCodigo: i.pais_codigo,
      paisNombre: nombrePais.get(i.pais_codigo) ?? null,
      activa: i.activa,
      profesionales: profesionalesPorInst.get(i.id) ?? 0,
      pacientes: pacientesPorInst.get(i.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Instituciones ACTIVAS (id + nombre + país) para los desplegables de asignación. */
export async function listarInstitucionesOpciones(): Promise<InstitucionOpcion[]> {
  try {
    const supabase = await crearClienteServidor();
    const { data: instituciones } = await supabase
      .from("instituciones")
      .select("id, nombre, pais_codigo")
      .eq("activa", true)
      .order("nombre", { ascending: true });
    if (!instituciones || instituciones.length === 0) return [];
    const codigos = [...new Set(instituciones.map((i) => i.pais_codigo))];
    const { data: paises } = await supabase
      .from("paises")
      .select("codigo, nombre")
      .in("codigo", codigos);
    const nombrePais = new Map((paises ?? []).map((p) => [p.codigo, p.nombre]));
    return instituciones.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      paisNombre: nombrePais.get(i.pais_codigo) ?? null,
    }));
  } catch {
    return [];
  }
}

// =====================================================================
// Profesionales (con sus membresías).
// =====================================================================

export async function listarProfesionalesAdmin(): Promise<ProfesionalVista[]> {
  try {
    const supabase = await crearClienteServidor();
    const { data: perfiles } = await supabase
      .from("perfiles")
      .select("id, nombre, telefono")
      .eq("rol", "profesional")
      .order("nombre", { ascending: true });
    if (!perfiles || perfiles.length === 0) return [];

    const ids = perfiles.map((p) => p.id);
    const [{ data: membresias }, { data: instituciones }] = await Promise.all([
      supabase
        .from("profesionales_instituciones")
        .select("id, profesional_id, institucion_id, activa")
        .in("profesional_id", ids),
      supabase.from("instituciones").select("id, nombre"),
    ]);
    const nombreInst = new Map(
      (instituciones ?? []).map((i) => [i.id, i.nombre]),
    );

    const membresiasPorProf = new Map<
      string,
      ProfesionalVista["membresias"]
    >();
    for (const m of membresias ?? []) {
      const lista = membresiasPorProf.get(m.profesional_id) ?? [];
      lista.push({
        id: m.id,
        institucionId: m.institucion_id,
        institucionNombre: nombreInst.get(m.institucion_id) ?? "Institución",
        activa: m.activa,
      });
      membresiasPorProf.set(m.profesional_id, lista);
    }

    return perfiles.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      telefono: p.telefono,
      membresias: (membresiasPorProf.get(p.id) ?? []).sort((a, b) =>
        a.institucionNombre.localeCompare(b.institucionNombre, "es"),
      ),
    }));
  } catch {
    return [];
  }
}

// =====================================================================
// Pacientes sin institución (riesgo operativo de WP-22).
// =====================================================================

export async function listarPacientesSinInstitucion(): Promise<
  PacienteSinInstitucionVista[]
> {
  try {
    const supabase = await crearClienteServidor();
    // RLS admin_todo: el admin ve todos los pacientes, incluidos los que no son
    // visibles para ningún profesional por no tener institución.
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, creado_en")
      .is("institucion_id", null);
    if (!pacientes || pacientes.length === 0) return [];

    const ids = pacientes.map((p) => p.id);
    const { data: perfiles } = await supabase
      .from("perfiles")
      .select("id, nombre")
      .in("id", ids);
    const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

    return pacientes
      .map((p) => {
        const nombre = nombrePorId.get(p.id) ?? "Paciente";
        return {
          id: p.id,
          nombre,
          inicial: inicialDe(nombre),
          creadoEn: p.creado_en,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  } catch {
    return [];
  }
}

// =====================================================================
// Resumen de cabecera.
// =====================================================================

export async function cargarResumenAdmin(): Promise<ResumenAdmin> {
  const vacio: ResumenAdmin = {
    instituciones: 0,
    institucionesActivas: 0,
    profesionales: 0,
    pacientesSinInstitucion: 0,
  };
  try {
    const supabase = await crearClienteServidor();
    const [inst, instActivas, profs, sinInst] = await Promise.all([
      supabase
        .from("instituciones")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("instituciones")
        .select("id", { count: "exact", head: true })
        .eq("activa", true),
      supabase
        .from("perfiles")
        .select("id", { count: "exact", head: true })
        .eq("rol", "profesional"),
      supabase
        .from("pacientes")
        .select("id", { count: "exact", head: true })
        .is("institucion_id", null),
    ]);
    return {
      instituciones: inst.count ?? 0,
      institucionesActivas: instActivas.count ?? 0,
      profesionales: profs.count ?? 0,
      pacientesSinInstitucion: sinInst.count ?? 0,
    };
  } catch {
    return vacio;
  }
}
