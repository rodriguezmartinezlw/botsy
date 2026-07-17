/**
 * Validación PURA de la consola de administración (WP-23) — Zod estricto + lógica
 * de aviso, sin IO. Se testea sin base de datos. Las Server Actions parsean con
 * estos esquemas antes de tocar Supabase (RLS de admin, 0016).
 */

import { z } from "zod";
import type { TipoInstitucion } from "@/types/db";

// --- Catálogo de tipos de institución (mismo check que 0016) ----------------

export const TIPOS_INSTITUCION: readonly TipoInstitucion[] = [
  "hospital",
  "clinica",
  "centro_oncologico",
  "otro",
] as const;

export const ETIQUETA_TIPO_INSTITUCION: Record<TipoInstitucion, string> = {
  hospital: "Hospital",
  clinica: "Clínica",
  centro_oncologico: "Centro oncológico",
  otro: "Otro",
};

const tipoInstitucion = z.enum([
  "hospital",
  "clinica",
  "centro_oncologico",
  "otro",
]);

// Código ISO-3166 alfa-2 en mayúsculas (mismo check que la tabla `paises`).
const codigoPais = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "El código de país debe tener 2 letras (p. ej. PE).");

// --- Instituciones -----------------------------------------------------------

export const esquemaCrearInstitucion = z
  .object({
    nombre: z.string().trim().min(1, "Falta el nombre.").max(160),
    tipo: tipoInstitucion,
    paisCodigo: codigoPais,
  })
  .strict();

export type EntradaCrearInstitucion = z.infer<typeof esquemaCrearInstitucion>;

export const esquemaEditarInstitucion = z
  .object({
    id: z.string().uuid("Institución no válida."),
    nombre: z.string().trim().min(1, "Falta el nombre.").max(160),
    tipo: tipoInstitucion,
    paisCodigo: codigoPais,
  })
  .strict();

export type EntradaEditarInstitucion = z.infer<typeof esquemaEditarInstitucion>;

export const esquemaEstadoInstitucion = z
  .object({
    id: z.string().uuid("Institución no válida."),
    activa: z.boolean(),
  })
  .strict();

// --- Países (alta de catálogo, fila simple) ----------------------------------

export const esquemaCrearPais = z
  .object({
    codigo: codigoPais,
    nombre: z.string().trim().min(1, "Falta el nombre del país.").max(80),
  })
  .strict();

export type EntradaCrearPais = z.infer<typeof esquemaCrearPais>;

// --- Membresías profesional↔institución --------------------------------------

export const esquemaAsignarMembresia = z
  .object({
    profesionalId: z.string().uuid("Profesional no válido."),
    institucionId: z.string().uuid("Institución no válida."),
  })
  .strict();

export const esquemaRetirarMembresia = z
  .object({
    membresiaId: z.string().uuid("Membresía no válida."),
    // Segundo intento tras el aviso de "es su única institución".
    confirmar: z.boolean().optional().default(false),
  })
  .strict();

// --- Pacientes sin institución -----------------------------------------------

export const esquemaAsignarInstitucionPaciente = z
  .object({
    pacienteId: z.string().uuid("Paciente no válido."),
    institucionId: z.string().uuid("Institución no válida."),
  })
  .strict();

// --- Lógica PURA del aviso al retirar la última membresía ---------------------

/**
 * Decide el aviso al RETIRAR una membresía (WP-23 §4). Si tras el retiro el
 * profesional se queda sin ninguna otra institución activa y la institución que
 * se retira tiene pacientes, dejará de ver a esos pacientes (la visibilidad es
 * por institución, ADR-004). Devuelve el texto de aviso, o `null` si no hace
 * falta confirmar.
 */
export function avisoRetiroMembresia(params: {
  otrasMembresiasActivas: number;
  pacientesEnInstitucion: number;
  nombreInstitucion: string;
}): string | null {
  const { otrasMembresiasActivas, pacientesEnInstitucion, nombreInstitucion } =
    params;
  if (otrasMembresiasActivas > 0) return null;
  if (pacientesEnInstitucion <= 0) return null;
  const plural = pacientesEnInstitucion === 1 ? "paciente" : "pacientes";
  return (
    `Es su única institución activa: al retirarla dejará de ver a los ` +
    `${pacientesEnInstitucion} ${plural} de ${nombreInstitucion}. ` +
    `Confirma si quieres continuar.`
  );
}
