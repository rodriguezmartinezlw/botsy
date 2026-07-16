/**
 * Formateadores de fecha en español para los ejes y tooltips de los gráficos
 * (WP-05). Usa `date-fns` con locale `es`. Sin dependencia de Supabase.
 *
 * Las fechas de entrada son cadenas "yyyy-MM-dd"; se parsean con `parseISO`
 * (medianoche local) para no desplazar el día por zona horaria.
 */

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/** "2026-07-15" -> "15 jul" (para ejes X compactos). */
export function etiquetaEjeFecha(fecha: string): string {
  return format(parseISO(fecha), "d MMM", { locale: es });
}

/** "2026-07-15" -> "martes, 15 de julio" (para tooltips). */
export function etiquetaTooltipFecha(fecha: string): string {
  return format(parseISO(fecha), "EEEE, d 'de' MMMM", { locale: es });
}
