import type { NivelEscalado } from "@/types/db";
import { NIVEL_ESTILO } from "./niveles";

/** Píldora con el nivel de escalado (WP-06), con su color semáforo. */
export default function BadgeNivel({ nivel }: { nivel: NivelEscalado }) {
  const estilo = NIVEL_ESTILO[nivel];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${estilo.claseBadge}`}
    >
      {estilo.etiqueta}
    </span>
  );
}
