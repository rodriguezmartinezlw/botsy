/**
 * Zonas horarias ofrecidas al paciente en su perfil (WP-20 §C) — datos PUROS.
 *
 * Lista corta y comprensible para la población objetivo (LatAm/España), no el
 * catálogo IANA completo. Los identificadores son IANA válidos, que es lo que
 * `fechaHoyEnZona` (Intl) espera al calcular la fecha clínica del check-in.
 */

export const ZONAS_HORARIAS = [
  { valor: "America/Lima", etiqueta: "Perú (Lima)" },
  { valor: "America/Bogota", etiqueta: "Colombia (Bogotá)" },
  { valor: "America/Mexico_City", etiqueta: "México (Ciudad de México)" },
  { valor: "America/Argentina/Buenos_Aires", etiqueta: "Argentina (Buenos Aires)" },
  { valor: "America/Santiago", etiqueta: "Chile (Santiago)" },
  { valor: "America/Guayaquil", etiqueta: "Ecuador (Guayaquil)" },
  { valor: "America/Sao_Paulo", etiqueta: "Brasil (São Paulo)" },
  { valor: "Europe/Madrid", etiqueta: "España (Madrid)" },
] as const;

export type ZonaHoraria = (typeof ZONAS_HORARIAS)[number]["valor"];

export const VALORES_ZONA_HORARIA = ZONAS_HORARIAS.map((z) => z.valor) as [
  ZonaHoraria,
  ...ZonaHoraria[],
];

/** ¿Es `valor` una de las zonas ofrecidas? (narrowing seguro para Zod/UI). */
export function esZonaHorariaValida(valor: string): valor is ZonaHoraria {
  return (VALORES_ZONA_HORARIA as readonly string[]).includes(valor);
}
