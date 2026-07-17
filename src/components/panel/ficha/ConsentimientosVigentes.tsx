import { ShieldCheck } from "lucide-react";
import type { ItemTimeline } from "@/lib/panel/tipos";
import type { TipoConsentimiento } from "@/types/db";

const ETIQUETA: Record<TipoConsentimiento, string> = {
  conversacion: "Conversaciones",
  voz_grabacion: "Grabación de voz",
  voz_biomarcadores: "Biomarcadores de voz",
  uso_secundario: "Uso secundario (investigación)",
};

const ORDEN: TipoConsentimiento[] = [
  "conversacion",
  "voz_grabacion",
  "voz_biomarcadores",
  "uso_secundario",
];

/**
 * Estado vigente de consentimientos del paciente, SOLO LECTURA, para la ficha
 * 360º (WP-07). Se deriva de la línea temporal que WP-06 ya carga (eventos de
 * consentimiento ordenados desc): el primero de cada tipo es el vigente. No
 * añade consultas nuevas.
 */
export default function ConsentimientosVigentes({
  items,
}: {
  items: ItemTimeline[];
}) {
  const vigente = new Map<TipoConsentimiento, boolean>();
  for (const item of items) {
    if (item.tipo !== "consentimiento") continue;
    // La timeline viene ordenada desc por ts: el primero visto por tipo gana.
    if (!vigente.has(item.tipoConsentimiento)) {
      vigente.set(item.tipoConsentimiento, item.otorgado);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-4">
      <h3 className="inline-flex items-center gap-2 text-base font-bold text-texto">
        <ShieldCheck className="h-4 w-4 text-[#7c3aed]" aria-hidden />
        Consentimientos
      </h3>
      <ul className="flex flex-col gap-1.5" role="list">
        {ORDEN.map((tipo) => {
          const estado = vigente.get(tipo);
          return (
            <li
              key={tipo}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-texto-suave">{ETIQUETA[tipo]}</span>
              <span
                className={`font-medium ${
                  estado === true
                    ? "text-acento-fuerte"
                    : "text-texto-tenue"
                }`}
              >
                {estado === true ? "Otorgado" : "No otorgado"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-texto-tenue">
        Solo lectura. El paciente los gestiona desde su app.
      </p>
    </div>
  );
}
