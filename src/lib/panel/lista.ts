/**
 * Lógica PURA de la lista de pacientes del panel profesional (WP-06).
 *
 * Módulo sin IO: recibe filas ya leídas de Supabase (por el loader de servidor,
 * que se apoya en la RLS de profesional de WP-01) y produce la lista lista para
 * pintar: cálculo de edad, días sin check-in, semáforo de riesgo, orden y
 * búsqueda por nombre. Se testea sin base de datos.
 *
 * Convención de fechas clínicas: cadenas "yyyy-MM-dd" (sin hora).
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import type { NivelEscalado, VerticalPaciente } from "@/types/db";

/** Nivel del semáforo de un paciente: el de su alerta abierta más grave, o `null` (verde). */
export type NivelSemaforo = NivelEscalado | null;

/** Un paciente tal como se muestra en la lista del panel. */
export type PacienteLista = {
  id: string;
  nombre: string;
  inicial: string;
  avatarUrl: string | null;
  /** Edad en años, o `null` si no consta la fecha de nacimiento. */
  edad: number | null;
  vertical: VerticalPaciente;
  /** Adherencia de los últimos 7 días (0–100) o `null` si no hay tomas con desenlace. */
  adherencia7: number | null;
  /** Fecha del último check-in ("yyyy-MM-dd") o `null` si nunca hizo uno. */
  ultimoCheckin: string | null;
  /** Días transcurridos desde el último check-in; `null` si nunca hizo uno. */
  diasSinCheckin: number | null;
  /** Nivel de la alerta abierta más grave; `null` = sin alertas abiertas (verde). */
  semaforo: NivelSemaforo;
  /** Institución del paciente (WP-22); `null` si aún no tiene. */
  institucionId: string | null;
  /** Nombre de la institución (para el filtro y la etiqueta); `null` si no consta. */
  institucionNombre: string | null;
};

/** Peso de cada nivel para ordenar por gravedad (mayor = más grave). */
export const PESO_NIVEL: Record<NivelEscalado, number> = {
  vigilancia: 1,
  contactar: 2,
  urgencia: 3,
};

/** Peso del semáforo (sin alerta = 0, por debajo de cualquier nivel). */
export function pesoSemaforo(nivel: NivelSemaforo): number {
  return nivel === null ? 0 : PESO_NIVEL[nivel];
}

/** Edad en años cumplidos a fecha `hoy` (ambas "yyyy-MM-dd"). `null` si falta el nacimiento. */
export function calcularEdad(
  fechaNacimiento: string | null,
  hoy: string,
): number | null {
  if (!fechaNacimiento) return null;
  const nac = parseISO(fechaNacimiento);
  const ref = parseISO(hoy);
  let edad = ref.getFullYear() - nac.getFullYear();
  const cumpleEsteAno =
    ref.getMonth() > nac.getMonth() ||
    (ref.getMonth() === nac.getMonth() && ref.getDate() >= nac.getDate());
  if (!cumpleEsteAno) edad -= 1;
  return edad >= 0 ? edad : null;
}

/** Días de calendario transcurridos desde `ultimoCheckin` hasta `hoy`. `null` si nunca. */
export function diasSinCheckin(
  ultimoCheckin: string | null,
  hoy: string,
): number | null {
  if (!ultimoCheckin) return null;
  const dias = differenceInCalendarDays(parseISO(hoy), parseISO(ultimoCheckin));
  return dias < 0 ? 0 : dias;
}

/**
 * Nivel del semáforo a partir de las alertas ABIERTAS de un paciente (estado
 * `nueva` o `vista`): el nivel más grave. `null` si no hay ninguna abierta.
 */
export function nivelSemaforo(
  alertasAbiertas: { nivel: NivelEscalado }[],
): NivelSemaforo {
  let mejor: NivelSemaforo = null;
  for (const a of alertasAbiertas) {
    if (mejor === null || PESO_NIVEL[a.nivel] > PESO_NIVEL[mejor]) {
      mejor = a.nivel;
    }
  }
  return mejor;
}

/**
 * Orden por defecto de la lista (WP-06): mayor riesgo primero (semáforo más
 * grave), luego más días sin check-in (los que llevan más tiempo sin registrar,
 * y "nunca" cuenta como el máximo), y por último el nombre (desempate estable).
 *
 * No muta el array de entrada.
 */
export function ordenarPacientes(pacientes: PacienteLista[]): PacienteLista[] {
  // "Nunca hizo check-in" pesa como el máximo de días sin registrar.
  const dias = (p: PacienteLista): number =>
    p.diasSinCheckin === null ? Number.POSITIVE_INFINITY : p.diasSinCheckin;

  return [...pacientes].sort((a, b) => {
    const gravedad = pesoSemaforo(b.semaforo) - pesoSemaforo(a.semaforo);
    if (gravedad !== 0) return gravedad;
    const porDias = dias(b) - dias(a);
    if (porDias !== 0) return porDias;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

/** Normaliza para búsqueda: minúsculas y sin acentos. */
function normalizar(texto: string): string {
  // Marcas diacríticas combinantes U+0300–U+036F (para búsqueda sin acentos).
  const DIACRITICOS = new RegExp(String.fromCharCode(91,0x300,45,0x36f,93), "g");
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim();
}

/**
 * Filtra por nombre (búsqueda parcial, insensible a mayúsculas y acentos).
 * Con consulta vacía devuelve la lista tal cual.
 */
export function filtrarPacientes(
  pacientes: PacienteLista[],
  consulta: string,
): PacienteLista[] {
  const q = normalizar(consulta);
  if (q.length === 0) return pacientes;
  return pacientes.filter((p) => normalizar(p.nombre).includes(q));
}

/**
 * Filtra por institución (WP-22). `institucionId` vacío/`null` = todas. Sólo tiene
 * sentido cuando el profesional trabaja en varias instituciones; con una sola, la
 * lista ya viene acotada por RLS y el filtro es un no-op.
 */
export function filtrarPorInstitucion(
  pacientes: PacienteLista[],
  institucionId: string | null,
): PacienteLista[] {
  if (!institucionId) return pacientes;
  return pacientes.filter((p) => p.institucionId === institucionId);
}

/** Instituciones distintas presentes en la lista (para el selector de filtro). */
export function institucionesDeLista(
  pacientes: PacienteLista[],
): { id: string; nombre: string }[] {
  const vistas = new Map<string, string>();
  for (const p of pacientes) {
    if (p.institucionId && !vistas.has(p.institucionId)) {
      vistas.set(p.institucionId, p.institucionNombre ?? "Institución");
    }
  }
  return [...vistas.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
