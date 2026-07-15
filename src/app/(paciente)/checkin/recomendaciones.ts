import type { VerticalPaciente } from "@/types/db";

/**
 * "Recomendación del día" (§2.2, paso 7 / §5).
 *
 * TODO F2: motor de recomendaciones (RF-RL-01..07). En F1 son textos ESTÁTICOS
 * por vertical, orientativos y no terapéuticos. Ninguno contradice la pauta del
 * profesional ni recomienda fármacos/dosis.
 */

export const RECOMENDACIONES_POR_VERTICAL: Record<VerticalPaciente, string[]> = {
  cardiovascular: [
    "Un paseo tranquilo de 20-30 minutos hoy le sienta bien a tu corazón.",
    "Intenta reducir un poco la sal en las comidas de hoy.",
    "Recuerda beber agua a lo largo del día, sin esperar a tener sed.",
  ],
  cronica: [
    "Mantén tus horarios de comidas estables; ayuda a tu cuerpo a regularse.",
    "Un rato de descanso planificado hoy puede ayudarte a llegar mejor a la tarde.",
    "Anota cualquier cambio que notes; se lo podrás contar a tu médico.",
  ],
  geriatrica: [
    "Levántate despacio de la cama o la silla para evitar mareos.",
    "Un pequeño paseo por casa cada pocas horas mantiene tus piernas activas.",
    "Deja el vaso de agua a la vista para acordarte de beber.",
  ],
  mental: [
    "Dedica cinco minutos hoy a respirar despacio; sin prisa.",
    "Un paseo al aire libre suele aclarar la cabeza.",
    "Habla con alguien de confianza si el día se hace cuesta arriba.",
  ],
  ocupacional: [
    "Haz una pausa breve cada hora para estirar la espalda y el cuello.",
    "Descansa la vista mirando a lo lejos unos segundos cada rato.",
    "Bebe agua con regularidad durante la jornada.",
  ],
  general: [
    "Un poco de movimiento hoy, aunque sea suave, siempre ayuda.",
    "Cuida tu descanso: intenta acostarte a una hora parecida cada noche.",
    "Bebe agua a lo largo del día.",
  ],
};

/** Elige una recomendación estable para el día (misma fecha → mismo texto). */
export function recomendacionDelDia(
  vertical: VerticalPaciente,
  fecha: string = new Date().toISOString().slice(0, 10),
): string {
  const lista =
    RECOMENDACIONES_POR_VERTICAL[vertical] ??
    RECOMENDACIONES_POR_VERTICAL.general;
  let suma = 0;
  for (const c of fecha) suma += c.charCodeAt(0);
  return lista[suma % lista.length];
}
