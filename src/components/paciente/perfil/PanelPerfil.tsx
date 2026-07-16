"use client";

import { useState } from "react";
import { ETIQUETA_PERIODO, type Periodo } from "@/lib/agregados";
import TarjetaDolor from "./TarjetaDolor";
import TarjetaAnimoEstres from "./TarjetaAnimoEstres";
import TarjetaAdherencia from "./TarjetaAdherencia";
import TarjetaSueno from "./TarjetaSueno";
import TarjetaCognicion from "./TarjetaCognicion";
import TarjetaSintomas from "./TarjetaSintomas";
import type { DatosPerfil } from "./tipos";

/**
 * Panel cliente del perfil (WP-05). Único componente con estado: el período
 * seleccionado (Semana / Mes / 3 meses). NO hace fetch: recibe del Server
 * Component todos los bundles YA CALCULADOS y sólo elige cuál mostrar. Las 6
 * tarjetas reciben series listas para pintar.
 */
const PERIODOS: Periodo[] = ["semana", "mes", "tres_meses"];

function SelectorPeriodo({
  valor,
  onChange,
}: {
  valor: Periodo;
  onChange: (p: Periodo) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período a mostrar"
      className="flex gap-1 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-1"
    >
      {PERIODOS.map((p) => {
        const activo = p === valor;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={activo}
            className={`flex-1 rounded-[var(--radius-md)] px-3 py-2.5 text-base font-semibold transition-colors ${
              activo
                ? "bg-primario text-white shadow-sm"
                : "text-texto-suave hover:text-texto"
            }`}
          >
            {ETIQUETA_PERIODO[p]}
          </button>
        );
      })}
    </div>
  );
}

export default function PanelPerfil({ datos }: { datos: DatosPerfil }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const bundle = datos.porPeriodo[periodo];
  const periodoLabel = ETIQUETA_PERIODO[periodo];

  return (
    <div className="flex flex-col gap-6">
      <SelectorPeriodo valor={periodo} onChange={setPeriodo} />

      <TarjetaDolor dolor={bundle.dolor} periodoLabel={periodoLabel} />
      <TarjetaAnimoEstres animo={bundle.animo} />
      <TarjetaAdherencia
        farmacos={datos.farmacos}
        adherencia={bundle.adherencia}
        periodoLabel={periodoLabel}
      />
      <TarjetaSueno sueno={bundle.sueno} />
      <TarjetaCognicion cognicion={datos.cognicion} />
      <TarjetaSintomas sintomas={datos.sintomas} />
    </div>
  );
}
