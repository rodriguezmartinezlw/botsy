import Link from "next/link";
import { ArrowLeft, FileText, Flame, Phone } from "lucide-react";
import type { CabeceraFicha as CabeceraFichaTipo } from "@/lib/panel/tipos";
import type { VerticalPaciente } from "@/types/db";

const ETIQUETA_VERTICAL: Record<VerticalPaciente, string> = {
  cardiovascular: "Cardiovascular",
  cronica: "Crónica",
  geriatrica: "Geriátrica",
  mental: "Salud mental",
  ocupacional: "Ocupacional",
  general: "General",
};

/**
 * Cabecera de la ficha 360º (WP-06): datos del paciente, condiciones, racha y
 * botones "Ver informe" (placeholder → WP-07) y teléfono. Server component:
 * los botones son enlaces/estáticos, sin interactividad de cliente.
 */
export default function CabeceraFicha({
  cabecera,
}: {
  cabecera: CabeceraFichaTipo;
}) {
  const datos = [
    cabecera.edad !== null ? `${cabecera.edad} años` : null,
    cabecera.sexo,
    ETIQUETA_VERTICAL[cabecera.vertical],
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/pacientes"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-texto-suave hover:text-primario"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a pacientes
      </Link>

      <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primario-suave text-2xl font-bold text-primario"
          >
            {cabecera.inicial}
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-texto">
              {cabecera.nombre}
            </h1>
            <p className="text-base text-texto-suave">{datos.join(" · ")}</p>
            {cabecera.condiciones.length > 0 ? (
              <ul className="flex flex-wrap gap-2" role="list">
                {cabecera.condiciones.map((c) => (
                  <li
                    key={c}
                    className="rounded-full bg-superficie-suave px-3 py-1 text-sm font-medium text-texto-suave"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="inline-flex items-center gap-1.5 text-sm text-texto-tenue">
              <Flame className="h-4 w-4 text-vigilancia" aria-hidden />
              Racha actual: {cabecera.rachaActual} días · máxima {cabecera.rachaMaxima}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
          <button
            type="button"
            disabled
            title="Disponible en la próxima entrega (informes)"
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-[var(--radius-md)] border border-borde bg-superficie-suave px-4 py-2.5 text-base font-semibold text-texto-tenue"
          >
            <FileText className="h-5 w-5" aria-hidden />
            Ver informe
          </button>
          {cabecera.telefono ? (
            <a
              href={`tel:${cabecera.telefono}`}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primario px-4 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte"
            >
              <Phone className="h-5 w-5" aria-hidden />
              Llamar
            </a>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-borde px-4 py-2.5 text-base font-medium text-texto-tenue">
              <Phone className="h-5 w-5" aria-hidden />
              Sin teléfono
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
