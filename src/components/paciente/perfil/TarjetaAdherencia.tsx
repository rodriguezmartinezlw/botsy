import { Pill } from "lucide-react";
import GraficoBarras from "@/components/graficos/GraficoBarras";
import PuntosAdherencia from "@/components/graficos/PuntosAdherencia";
import EstadoVacioGrafico from "@/components/graficos/EstadoVacioGrafico";
import { PALETA } from "@/components/graficos/paleta";
import TarjetaPerfil from "./TarjetaPerfil";
import type { AdherenciaFarmaco, AdherenciaPeriodo } from "./tipos";

/**
 * Tarjeta de Adherencia (WP-05): por fármaco activo, fila semanal L–D con puntos
 * verde/rojo/gris, % de adherencia del período y barras de evolución mensual.
 * Recibe todo YA CALCULADO. Estado vacío si no hay medicación activa.
 */
function pct(valor: number | null): string {
  return valor === null ? "—" : `${valor}%`;
}

export default function TarjetaAdherencia({
  farmacos,
  adherencia,
  periodoLabel,
}: {
  farmacos: AdherenciaFarmaco[];
  adherencia: AdherenciaPeriodo;
  periodoLabel: string;
}) {
  const extra =
    farmacos.length > 0 ? (
      <div className="flex flex-col items-end">
        <span className="text-2xl font-bold text-texto">
          {pct(adherencia.global)}
        </span>
        <span className="text-sm text-texto-tenue">{periodoLabel.toLowerCase()}</span>
      </div>
    ) : null;

  return (
    <TarjetaPerfil
      titulo="Adherencia"
      icono={<Pill className="h-5 w-5" aria-hidden />}
      subtitulo={farmacos.length > 0 ? "Toma de tu medicación" : undefined}
      extra={extra}
    >
      {farmacos.length === 0 ? (
        <EstadoVacioGrafico mensaje="Cuando tengas medicación registrada, aquí verás cómo llevas tus tomas." />
      ) : (
        <div className="flex flex-col gap-6">
          {farmacos.map((f) => (
            <div key={f.pautaId} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-texto">
                      {f.farmaco}
                    </span>
                    {f.critica ? (
                      <span className="rounded-full bg-superficie-suave px-2 py-0.5 text-sm font-medium text-vigilancia">
                        Importante
                      </span>
                    ) : null}
                  </div>
                  {f.dosis ? (
                    <span className="text-sm text-texto-tenue">{f.dosis}</span>
                  ) : null}
                </div>
                <span className="text-lg font-bold text-texto">
                  {pct(adherencia.porFarmaco[f.pautaId] ?? null)}
                </span>
              </div>

              <PuntosAdherencia dias={f.semana} />

              {f.evolucionMensual.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-texto-tenue">
                    Evolución mensual
                  </span>
                  <GraficoBarras
                    datos={f.evolucionMensual}
                    color={PALETA.acento}
                    maxY={100}
                    unidad="%"
                    mostrarValores
                    nombreSerie="Adherencia"
                    mensajeVacio="Aún no hay meses completos que mostrar."
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </TarjetaPerfil>
  );
}
