import { Smile } from "lucide-react";
import GraficoLineas, {
  type LineaConfig,
} from "@/components/graficos/GraficoLineas";
import { PALETA } from "@/components/graficos/paleta";
import TarjetaPerfil from "./TarjetaPerfil";
import type { PuntoAnimo } from "@/lib/agregados";

/**
 * Tarjeta de Ánimo y estrés (WP-05): líneas comparadas de ánimo, ansiedad y
 * estrés (0–10). Sólo se dibujan las series con datos. Estado vacío amable si no
 * hay ninguna. Recibe la serie YA CALCULADA.
 */
const LINEAS: LineaConfig[] = [
  { dataKey: "animo", nombre: "Ánimo", color: PALETA.acentoFuerte },
  { dataKey: "ansiedad", nombre: "Ansiedad", color: PALETA.vigilancia },
  { dataKey: "estres", nombre: "Estrés", color: PALETA.cognicion },
];

export default function TarjetaAnimoEstres({ animo }: { animo: PuntoAnimo[] }) {
  return (
    <TarjetaPerfil
      titulo="Ánimo y estrés"
      icono={<Smile className="h-5 w-5" aria-hidden />}
      subtitulo="Escala 0–10"
    >
      <GraficoLineas
        datos={animo}
        lineas={LINEAS}
        maxY={10}
        unidad="/10"
        mensajeVacio="Cuando hablemos de cómo te sientes, aquí verás tu ánimo, ansiedad y estrés."
      />
    </TarjetaPerfil>
  );
}
