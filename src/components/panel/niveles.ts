/**
 * Estilos compartidos de los niveles de escalado en el panel (WP-06).
 * Módulo de datos (sin JSX), seguro para cliente y servidor. Los colores reflejan
 * el semáforo clínico: verde (sin alertas) → ámbar (vigilancia) → naranja
 * (contactar) → rojo (urgencia). Valores hex explícitos (Tailwind v4 arbitrary).
 */

import type { NivelEscalado } from "@/types/db";

export type EstiloNivel = {
  etiqueta: string;
  /** Color del punto del semáforo. */
  color: string;
  /** Clases de una píldora (fondo + texto). */
  claseBadge: string;
};

export const NIVEL_ESTILO: Record<NivelEscalado, EstiloNivel> = {
  urgencia: {
    etiqueta: "Urgencia",
    color: "#dc2626",
    claseBadge: "bg-[#fee2e2] text-[#b91c1c]",
  },
  contactar: {
    etiqueta: "Contactar",
    color: "#ea580c",
    claseBadge: "bg-[#ffedd5] text-[#c2410c]",
  },
  vigilancia: {
    etiqueta: "Vigilancia",
    color: "#f59e0b",
    claseBadge: "bg-[#fef3c7] text-[#92400e]",
  },
};

/** Estilo del estado "sin alertas abiertas" (verde). */
export const ESTILO_VERDE: EstiloNivel = {
  etiqueta: "Sin alertas",
  color: "#10b981",
  claseBadge: "bg-acento-suave text-acento-fuerte",
};

export function estiloSemaforo(nivel: NivelEscalado | null): EstiloNivel {
  return nivel === null ? ESTILO_VERDE : NIVEL_ESTILO[nivel];
}
