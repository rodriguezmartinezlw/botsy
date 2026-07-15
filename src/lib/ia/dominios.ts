/**
 * Dominios del check-in — módulo PURO y seguro para cliente (solo importa
 * tipos). Vive separado para que tanto los componentes cliente (checklist
 * visual) como el motor de servidor puedan importarlo sin arrastrar código de
 * servidor (Supabase / next/headers / OpenAI).
 *
 * Distinción importante:
 *  - `DOMINIOS_CHECKIN` (7): dominios de la CHECKLIST de la conversación
 *    (§2.2 de la funcional). Es lo que se marca con `marcar_dominio_cubierto`
 *    y lo que se guarda en `checkins.dominios_cubiertos`.
 *  - `DominioObservacion` (10, en `types/db.ts`): granularidad fina de la
 *    columna `observaciones.dominio`. Un dominio de checklist agrupa uno o
 *    varios dominios de observación (p. ej. "animo" agrupa ánimo/ansiedad/
 *    estrés/sueño).
 */

import type { DominioObservacion } from "@/types/db";

export type EntradaDominioCheckin = {
  readonly id: string;
  readonly etiqueta: string;
  readonly descripcion: string;
  /** Dominios de observación (BD) que cubre este dominio de checklist. */
  readonly observaciones: readonly DominioObservacion[];
};

export const DOMINIOS_CHECKIN = [
  {
    id: "adherencia",
    etiqueta: "Medicación",
    descripcion: "Si tomó su medicación de hoy (por fármaco y momento).",
    observaciones: ["adherencia"],
  },
  {
    id: "dolor",
    etiqueta: "Dolor",
    descripcion: "Presencia, localización e intensidad (0-10) del dolor.",
    observaciones: ["dolor"],
  },
  {
    id: "sintomas_fisicos",
    etiqueta: "Síntomas",
    descripcion: "Síntomas físicos nuevos o recurrentes.",
    observaciones: ["sintoma_fisico"],
  },
  {
    id: "animo",
    etiqueta: "Ánimo y sueño",
    descripcion: "Estado de ánimo, ansiedad, estrés y sueño percibido.",
    observaciones: ["animo", "ansiedad", "estres", "sueno"],
  },
  {
    id: "cognicion",
    etiqueta: "Memoria",
    descripcion: "Señales ligeras de cognición integradas con naturalidad.",
    observaciones: ["cognicion"],
  },
  {
    id: "tratamiento",
    etiqueta: "Tratamiento",
    descripcion: "Efectos y efectos adversos de terapias/tratamientos.",
    observaciones: ["tratamiento"],
  },
  {
    id: "habitos",
    etiqueta: "Hábitos",
    descripcion: "Comida, actividad física y hábitos del día.",
    observaciones: ["habitos"],
  },
] as const satisfies readonly EntradaDominioCheckin[];

export type DominioCheckin = (typeof DOMINIOS_CHECKIN)[number]["id"];

export const IDS_DOMINIOS_CHECKIN: readonly DominioCheckin[] =
  DOMINIOS_CHECKIN.map((d) => d.id);

/** Type guard: ¿es `valor` un id de dominio de checklist válido? */
export function esDominioCheckin(valor: unknown): valor is DominioCheckin {
  return (
    typeof valor === "string" &&
    (IDS_DOMINIOS_CHECKIN as readonly string[]).includes(valor)
  );
}
