/**
 * Datos editables del perfil del paciente (WP-20 §C) — esquema PURO.
 *
 * El paciente SOLO edita sus campos NO clínicos: nombre, teléfono, hora del
 * recordatorio de check-in y zona horaria. Vertical, condiciones, programa y
 * pautas son del PROFESIONAL (regla clínica de CLAUDE.md) y NO aparecen aquí; el
 * esquema es `.strict()`, de modo que cualquier intento de colar un campo
 * clínico se rechaza en validación (además de la RLS `..._update_propio`, que
 * solo permite escribir la propia fila).
 */

import { z } from "zod";
import { VALORES_ZONA_HORARIA } from "./zonas";

/** Hora en formato HH:MM (00:00–23:59). Coincide con la columna `time` de BD. */
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const esquemaMisDatos = z
  .object({
    nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
    telefono: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+()0-9\s-]*$/, "El teléfono contiene caracteres no válidos.")
      .optional()
      .or(z.literal("")),
    horaCheckin: z
      .string()
      .trim()
      .regex(HORA_RE, "La hora debe tener el formato HH:MM."),
    zonaHoraria: z.enum(VALORES_ZONA_HORARIA),
  })
  .strict();

export type MisDatos = z.infer<typeof esquemaMisDatos>;

/**
 * Normaliza la hora a `HH:MM:SS` para la columna `time` de Postgres (acepta
 * `HH:MM`, pero se guarda con segundos para consistencia con el default `10:00`).
 */
export function horaAColumna(hora: string): string {
  return hora.length === 5 ? `${hora}:00` : hora;
}

/** Recorta `HH:MM:SS`/`HH:MM:SS+00` a `HH:MM` para el input `type=time`. */
export function horaDesdeColumna(valor: string | null | undefined): string {
  if (!valor) return "10:00";
  const m = /^([01]\d|2[0-3]):[0-5]\d/.exec(valor);
  return m ? m[0] : "10:00";
}
