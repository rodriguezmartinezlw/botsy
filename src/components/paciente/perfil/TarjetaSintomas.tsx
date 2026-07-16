import { Stethoscope } from "lucide-react";
import EstadoVacioGrafico from "@/components/graficos/EstadoVacioGrafico";
import TarjetaPerfil from "./TarjetaPerfil";
import type { RecuentoSintoma } from "@/lib/agregados";

/**
 * Tarjeta de Síntomas recientes (WP-05): chips de los códigos de síntoma físico
 * de los últimos 30 días con su recuento. Recibe los recuentos YA CALCULADOS.
 * Estado vacío amable si no hay ninguno.
 */
function humanizar(codigo: string): string {
  const texto = codigo.replace(/_/g, " ").trim();
  return texto.length > 0 ? texto[0].toUpperCase() + texto.slice(1) : codigo;
}

export default function TarjetaSintomas({
  sintomas,
}: {
  sintomas: RecuentoSintoma[];
}) {
  return (
    <TarjetaPerfil
      titulo="Síntomas recientes"
      icono={<Stethoscope className="h-5 w-5" aria-hidden />}
      subtitulo={sintomas.length > 0 ? "Últimos 30 días" : undefined}
    >
      {sintomas.length === 0 ? (
        <EstadoVacioGrafico mensaje="No has registrado síntomas físicos en los últimos 30 días." />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {sintomas.map((s) => (
            <li
              key={s.codigo}
              className="inline-flex items-center gap-2 rounded-full border border-borde bg-superficie-suave px-3 py-1.5"
            >
              <span className="text-base text-texto">{humanizar(s.codigo)}</span>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primario-suave px-1.5 text-sm font-semibold text-primario">
                {s.recuento}
              </span>
            </li>
          ))}
        </ul>
      )}
    </TarjetaPerfil>
  );
}
