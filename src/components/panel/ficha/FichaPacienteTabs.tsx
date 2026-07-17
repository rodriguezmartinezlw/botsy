"use client";

import { useState } from "react";
import type {
  FichaPaciente,
  MotivoCatalogo,
  ProgramaPacienteVista,
} from "@/lib/panel/tipos";
import LineaTemporal from "./LineaTemporal";
import ColumnaTendencias from "./ColumnaTendencias";
import ConsentimientosVigentes from "./ConsentimientosVigentes";
import PanelMedicacion from "./PanelMedicacion";
import PanelReglas from "./PanelReglas";
import PanelPrograma from "./PanelPrograma";

type Pestana = "resumen" | "programa" | "medicacion" | "reglas";

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "programa", etiqueta: "Programa" },
  { id: "medicacion", etiqueta: "Medicación" },
  { id: "reglas", etiqueta: "Reglas" },
];

export default function FichaPacienteTabs({
  ficha,
  programa,
  motivosDiscontinuacion,
}: {
  ficha: FichaPaciente;
  programa: ProgramaPacienteVista;
  motivosDiscontinuacion: MotivoCatalogo[];
}) {
  const [pestana, setPestana] = useState<Pestana>("resumen");

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones de la ficha"
        className="flex gap-1 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-1"
      >
        {PESTANAS.map((p) => {
          const activo = p.id === pestana;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={activo}
              type="button"
              onClick={() => setPestana(p.id)}
              className={`flex-1 rounded-[var(--radius-md)] px-3 py-2.5 text-base font-semibold transition-colors ${
                activo
                  ? "bg-primario text-white shadow-sm"
                  : "text-texto-suave hover:text-texto"
              }`}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      {pestana === "resumen" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-texto">Línea temporal</h2>
            <LineaTemporal items={ficha.timeline} />
          </section>
          <aside className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-texto">Tendencias</h2>
            <ColumnaTendencias tendencias={ficha.tendencias} />
            <ConsentimientosVigentes items={ficha.timeline} />
          </aside>
        </div>
      ) : null}

      {pestana === "programa" ? (
        <PanelPrograma pacienteId={ficha.cabecera.id} programa={programa} />
      ) : null}

      {pestana === "medicacion" ? (
        <PanelMedicacion
          pacienteId={ficha.cabecera.id}
          pautas={ficha.pautas}
          motivosDiscontinuacion={motivosDiscontinuacion}
        />
      ) : null}

      {pestana === "reglas" ? (
        <PanelReglas
          pacienteId={ficha.cabecera.id}
          reglasGlobales={ficha.reglasGlobales}
          reglasPaciente={ficha.reglasPaciente}
        />
      ) : null}
    </div>
  );
}
