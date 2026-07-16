import { Activity, Pill, Smile } from "lucide-react";
import GraficoAreaTemporal from "@/components/graficos/GraficoAreaTemporal";
import GraficoLineas, { type LineaConfig } from "@/components/graficos/GraficoLineas";
import PuntosAdherencia from "@/components/graficos/PuntosAdherencia";
import EstadoVacioGrafico from "@/components/graficos/EstadoVacioGrafico";
import { PALETA } from "@/components/graficos/paleta";
import { hayDatosAnimo } from "@/lib/agregados";
import type { TendenciasCompactas } from "@/lib/panel/tipos";

/**
 * Columna de tendencias de la ficha (WP-06): reutiliza los componentes de
 * gráfico de WP-05 (dolor, ánimo, adherencia) en tamaño compacto. Los datos
 * llegan YA CALCULADOS desde el servidor; estos componentes no tocan Supabase.
 * Ventana: último mes (adherencia semanal L–D).
 */

const LINEAS_ANIMO: LineaConfig[] = [
  { dataKey: "animo", nombre: "Ánimo", color: PALETA.primario },
  { dataKey: "ansiedad", nombre: "Ansiedad", color: PALETA.urgencia },
  { dataKey: "estres", nombre: "Estrés", color: PALETA.vigilancia },
];

function TarjetaCompacta({
  titulo,
  icono,
  extra,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-base font-semibold text-texto">
          <span className="text-primario" aria-hidden>
            {icono}
          </span>
          {titulo}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export default function ColumnaTendencias({
  tendencias,
}: {
  tendencias: TendenciasCompactas;
}) {
  const { dolor, animo, farmacos } = tendencias;

  return (
    <div className="flex flex-col gap-4">
      <TarjetaCompacta
        titulo="Dolor"
        icono={<Activity className="h-5 w-5" aria-hidden />}
        extra={
          dolor.media !== null ? (
            <span className="text-lg font-bold text-texto">
              {dolor.media}
              <span className="text-sm font-normal text-texto-tenue">/10</span>
            </span>
          ) : null
        }
      >
        <GraficoAreaTemporal
          datos={dolor.serie}
          color={PALETA.primario}
          maxY={10}
          unidad="/10"
          marcarPico
          etiquetaSerie="Dolor"
          mensajeVacio="Sin registros de dolor este mes."
        />
      </TarjetaCompacta>

      <TarjetaCompacta
        titulo="Ánimo, ansiedad y estrés"
        icono={<Smile className="h-5 w-5" aria-hidden />}
      >
        {hayDatosAnimo(animo) ? (
          <GraficoLineas
            datos={animo}
            lineas={LINEAS_ANIMO}
            maxY={10}
            mensajeVacio="Sin registros emocionales este mes."
          />
        ) : (
          <EstadoVacioGrafico mensaje="Sin registros emocionales este mes." />
        )}
      </TarjetaCompacta>

      <TarjetaCompacta
        titulo="Adherencia"
        icono={<Pill className="h-5 w-5" aria-hidden />}
      >
        {farmacos.length === 0 ? (
          <EstadoVacioGrafico mensaje="Sin medicación activa registrada." />
        ) : (
          <div className="flex flex-col gap-4">
            {farmacos.map((f) => (
              <div key={f.pautaId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-texto">
                    {f.farmaco}
                    {f.critica ? (
                      <span className="ml-2 rounded-full bg-superficie-suave px-2 py-0.5 text-xs font-medium text-vigilancia">
                        Importante
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm font-semibold text-texto">
                    {f.adherencia7 === null ? "—" : `${f.adherencia7}%`}
                    <span className="ml-1 font-normal text-texto-tenue">7d</span>
                  </span>
                </div>
                <PuntosAdherencia dias={f.semana} />
              </div>
            ))}
          </div>
        )}
      </TarjetaCompacta>
    </div>
  );
}
