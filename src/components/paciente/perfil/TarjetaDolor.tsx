import { Activity, Minus, TrendingDown, TrendingUp } from "lucide-react";
import GraficoAreaTemporal from "@/components/graficos/GraficoAreaTemporal";
import { PALETA } from "@/components/graficos/paleta";
import TarjetaPerfil from "./TarjetaPerfil";
import type { BundleDolor } from "./tipos";

/**
 * Tarjeta de Dolor (WP-05): área de la media diaria de `observaciones` de dolor
 * con marcador de pico y delta (↑/↓ %) frente al período anterior. Recibe la
 * serie YA CALCULADA. Estado vacío amable si no hay datos.
 */
function BadgeDelta({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-texto-tenue">
        <Minus className="h-4 w-4" aria-hidden />
        Sin cambios
      </span>
    );
  }
  const baja = delta < 0;
  const Icono = baja ? TrendingDown : TrendingUp;
  // En dolor, bajar es una buena señal (verde); subir se marca en ámbar (no rojo,
  // para no alarmar: es un dato registrado, no un diagnóstico).
  const clase = baja
    ? "bg-acento-suave text-acento-fuerte"
    : "bg-[var(--color-superficie-suave)] text-vigilancia";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold ${clase}`}
    >
      <Icono className="h-4 w-4" aria-hidden />
      {Math.abs(delta)}%
      <span className="font-normal text-texto-tenue">vs. antes</span>
    </span>
  );
}

export default function TarjetaDolor({
  dolor,
  periodoLabel,
}: {
  dolor: BundleDolor;
  periodoLabel: string;
}) {
  const hayDatos = dolor.media !== null;
  const extra = hayDatos ? (
    <div className="flex flex-col items-end gap-1">
      <span className="text-2xl font-bold text-texto">
        {dolor.media}
        <span className="text-base font-normal text-texto-tenue">/10</span>
      </span>
      {dolor.delta !== null ? <BadgeDelta delta={dolor.delta} /> : null}
    </div>
  ) : null;

  return (
    <TarjetaPerfil
      titulo="Dolor"
      icono={<Activity className="h-5 w-5" aria-hidden />}
      subtitulo={hayDatos ? `Media diaria · ${periodoLabel.toLowerCase()}` : undefined}
      extra={extra}
    >
      <GraficoAreaTemporal
        datos={dolor.serie}
        color={PALETA.primario}
        maxY={10}
        unidad="/10"
        marcarPico
        etiquetaSerie="Dolor"
        mensajeVacio="Cuando cuentes cómo va tu dolor en los check-ins, aquí verás su evolución."
      />
    </TarjetaPerfil>
  );
}
