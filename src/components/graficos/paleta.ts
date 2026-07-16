/**
 * Paleta y constantes de estilo de los gráficos (WP-05).
 *
 * Refleja los tokens de `src/app/globals.css` como valores concretos, porque los
 * atributos SVG de Recharts (`fill`, `stroke`) se pintan de forma más fiable con
 * colores explícitos que con `var(--…)`. Si cambia el tema, actualizar aquí.
 *
 * Este archivo NO importa Supabase (los componentes de gráfico deben ser
 * reutilizables por el panel profesional en WP-06 recibiendo sólo series).
 */

export const PALETA = {
  primario: "#2563eb", // azul sanitario — dolor / ánimo
  primarioSuave: "#dbeafe",
  acento: "#10b981", // verde salud — adherencia (tomada)
  acentoFuerte: "#059669",
  vigilancia: "#f59e0b", // ámbar — estrés
  urgencia: "#dc2626", // rojo — omitida / ansiedad
  cognicion: "#7c3aed", // violeta — cognición
  sueno: "#0891b2", // cian — sueño
  gris: "#9ca3af", // desconocido / sin dato
  borde: "#e7e2d9",
  texto: "#1f2937",
  textoSuave: "#4b5563",
  textoTenue: "#6b7280",
  cuadricula: "#efece5",
} as const;

/**
 * Estilo compartido de los ejes. Fuente >=12px (requisito del WP para ejes;
 * el resto de texto legible de la app va >=16px).
 */
export const EJE = {
  tickFontSize: 14,
  color: PALETA.textoSuave,
} as const;

/** Alto por defecto de los lienzos de gráfico (px). */
export const ALTO_GRAFICO = 200;
