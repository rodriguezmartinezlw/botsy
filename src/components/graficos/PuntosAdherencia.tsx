/**
 * Fila semanal L–D de adherencia (WP-05): un punto por día con color
 * verde (tomada) / rojo (omitida) / gris (desconocido o sin registro). Recibe
 * los días YA CALCULADOS; no conoce Supabase. Reutilizable por WP-06.
 *
 * No usa Recharts (es un widget de puntos). Accesible: cada punto expone su
 * estado por texto para lectores de pantalla.
 */

import type { DiaAdherencia, EstadoDia } from "@/lib/agregados";
import { etiquetaTooltipFecha } from "./formato";
import { PALETA } from "./paleta";

const COLOR_ESTADO: Record<EstadoDia, string> = {
  tomada: PALETA.acento,
  omitida: PALETA.urgencia,
  gris: PALETA.gris,
};

const TEXTO_ESTADO: Record<EstadoDia, string> = {
  tomada: "tomada",
  omitida: "omitida",
  gris: "sin registro",
};

type PuntosAdherenciaProps = {
  dias: DiaAdherencia[];
};

export default function PuntosAdherencia({ dias }: PuntosAdherenciaProps) {
  return (
    <ul className="flex items-stretch justify-between gap-1" role="list">
      {dias.map((dia) => (
        <li
          key={dia.fecha}
          className="flex flex-1 flex-col items-center gap-1.5"
        >
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-full ring-2 ring-inset ring-white/40"
            style={{ backgroundColor: COLOR_ESTADO[dia.estado] }}
          />
          <span className="text-sm font-medium text-texto-suave" aria-hidden>
            {dia.inicial}
          </span>
          <span className="sr-only">
            {etiquetaTooltipFecha(dia.fecha)}: {TEXTO_ESTADO[dia.estado]}
          </span>
        </li>
      ))}
    </ul>
  );
}
