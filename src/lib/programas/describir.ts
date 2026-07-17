/**
 * Descripción en lenguaje humano de una config de programa (WP-11 v2 §A.5) —
 * módulo PURO y seguro para cliente. La pestaña "Programa" muestra la config
 * EFECTIVA así, SIN JSON crudo.
 */

import { DOMINIOS_CHECKIN } from "@/lib/ia/dominios";
import type { ConfigPrograma } from "./config";

export type LineaConfig = { etiqueta: string; valor: string };

const ETIQUETA_DOMINIO = new Map(
  DOMINIOS_CHECKIN.map((d) => [d.id as string, d.etiqueta]),
);

const ETIQUETA_FRECUENCIA: Record<string, string> = {
  diaria: "diaria",
  cada_2_dias: "cada 2 días",
  semanal: "semanal",
};

const ETIQUETA_FREC_INSTRUMENTO: Record<string, string> = {
  semanal: "semanal",
  quincenal: "quincenal",
  ninguna: "sin cadencia definida",
};

function modulosActivos(config: ConfigPrograma): string {
  const activos: string[] = [];
  if (config.modulos.texto) activos.push("check-in por texto");
  if (config.modulos.voz) activos.push("check-in por voz");
  if (config.modulos.recomendaciones) activos.push("recomendaciones");
  return activos.length > 0 ? activos.join(", ") : "ninguno";
}

/** Convierte la config efectiva en una lista de líneas legibles (sin JSON). */
export function describirConfig(config: ConfigPrograma): LineaConfig[] {
  const dominios = config.checkin.dominios
    .map((d) => ETIQUETA_DOMINIO.get(d) ?? d)
    .join(", ");

  const estiloPartes: string[] = [];
  if (config.checkin.estilo.ritmo === "calmado") estiloPartes.push("ritmo pausado");
  if (config.checkin.estilo.frases_cortas) estiloPartes.push("frases cortas");
  if (config.checkin.estilo.repeticion) estiloPartes.push("repite si hace falta");

  const preguntas =
    config.checkin.preguntas_extra.length > 0
      ? config.checkin.preguntas_extra.map((p) => p.texto).join(" · ")
      : "sin preguntas extra";

  const term = config.instrumentos.termometro_distres;

  return [
    { etiqueta: "Módulos activos", valor: modulosActivos(config) },
    {
      etiqueta: "Frecuencia del check-in",
      valor: ETIQUETA_FRECUENCIA[config.checkin.frecuencia] ?? config.checkin.frecuencia,
    },
    { etiqueta: "Temas del check-in", valor: dominios },
    {
      etiqueta: "Estilo de conversación",
      valor: estiloPartes.length > 0 ? estiloPartes.join(", ") : "estándar",
    },
    { etiqueta: "Preguntas del programa", valor: preguntas },
    {
      etiqueta: "Reglas de aviso del programa",
      valor:
        config.escalado.reglas_clave.length > 0
          ? `${config.escalado.reglas_clave.length} regla(s) — se activan al asignar el programa`
          : "ninguna",
    },
    {
      etiqueta: "Termómetro de distrés",
      valor: term.activo
        ? `activo (${ETIQUETA_FREC_INSTRUMENTO[term.frecuencia] ?? term.frecuencia})`
        : "no activo",
    },
  ];
}
