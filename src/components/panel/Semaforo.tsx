import type { NivelEscalado } from "@/types/db";
import { estiloSemaforo } from "./niveles";

/**
 * Punto de semáforo del riesgo de un paciente (WP-06). `nivel` null = verde
 * (sin alertas abiertas). Accesible: el estado se expone por texto.
 */
export default function Semaforo({ nivel }: { nivel: NivelEscalado | null }) {
  const estilo = estiloSemaforo(nivel);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-inset ring-white/50"
        style={{ backgroundColor: estilo.color }}
      />
      <span className="sr-only">{estilo.etiqueta}</span>
    </span>
  );
}
