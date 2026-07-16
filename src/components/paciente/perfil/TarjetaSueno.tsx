import { Moon } from "lucide-react";
import GraficoBarras from "@/components/graficos/GraficoBarras";
import { PALETA } from "@/components/graficos/paleta";
import TarjetaPerfil from "./TarjetaPerfil";
import type { PuntoBarra } from "@/lib/agregados";

/**
 * Tarjeta de Sueño (WP-05): barras del dominio 'sueno' si hay datos. Recibe las
 * barras YA CALCULADAS (una por día con dato). Estado vacío amable si no hay.
 */
export default function TarjetaSueno({ sueno }: { sueno: PuntoBarra[] }) {
  return (
    <TarjetaPerfil
      titulo="Sueño"
      icono={<Moon className="h-5 w-5" aria-hidden />}
      subtitulo={sueno.length > 0 ? "Calidad percibida (0–10)" : undefined}
    >
      <GraficoBarras
        datos={sueno}
        color={PALETA.sueno}
        maxY={10}
        unidad="/10"
        nombreSerie="Sueño"
        mensajeVacio="Cuando me cuentes qué tal duermes, aquí verás tu sueño día a día."
      />
    </TarjetaPerfil>
  );
}
