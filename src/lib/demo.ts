/**
 * Modo DEMO (WP-17). Con `DEMO_MODE=true` (o "1"), el dashboard del patrocinador
 * y el informe ROI se sirven sobre la cohorte SINTÉTICA en memoria (sin base de
 * datos ni claves de producción), con marca de agua "DEMO — datos sintéticos".
 *
 * Es la pantalla de la primera reunión de venta: debe funcionar en LOCAL sin
 * NEXT_PUBLIC_SUPABASE_* ni OPENAI_API_KEY. Puro: seguro de importar en cliente
 * o servidor. La bandera se lee en tiempo de petición.
 */
export function modoDemo(): boolean {
  const v = (process.env.DEMO_MODE ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "si";
}

/** Etiqueta de la marca de agua de la demo. */
export const MARCA_DEMO = "DEMO — datos sintéticos";
