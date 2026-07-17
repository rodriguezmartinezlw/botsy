import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ShieldCheck } from "lucide-react";
import GraficoBarras from "@/components/graficos/GraficoBarras";
import { PALETA } from "@/components/graficos/paleta";
import type { PuntoBarra } from "@/lib/agregados";
import type { CohorteVista } from "@/lib/patrocinador/proveedor";
import TarjetaKpi from "./TarjetaKpi";

const NIVEL_ETIQUETA: Record<string, string> = {
  vigilancia: "Vigilancia",
  contactar: "Contactar",
  urgencia: "Urgencia",
};

/** Quita el prefijo [PENDIENTE ...] de las etiquetas del catálogo para la vista. */
function limpiarEtiqueta(s: string): string {
  return s.replace(/^\[PENDIENTE[^\]]*\]\s*/i, "");
}

function etiquetaMes(mes: string): string {
  try {
    return format(parseISO(`${mes}-01`), "MMM yyyy", { locale: es });
  } catch {
    return mes;
  }
}

function Grafico({
  titulo,
  datos,
  color,
  maxY,
  unidad,
  mostrarValores,
  mensajeVacio,
}: {
  titulo: string;
  datos: PuntoBarra[];
  color: string;
  maxY?: number;
  unidad?: string;
  mostrarValores?: boolean;
  mensajeVacio: string;
}) {
  return (
    <div className="informe-seccion flex flex-col gap-2 rounded-[var(--radius-md)] border border-borde bg-superficie p-4">
      <h3 className="text-base font-semibold text-texto">{titulo}</h3>
      <GraficoBarras
        datos={datos}
        color={color}
        maxY={maxY}
        unidad={unidad}
        mostrarValores={mostrarValores}
        mensajeVacio={mensajeVacio}
      />
    </div>
  );
}

/**
 * Bloque de una cohorte en el dashboard del patrocinador (WP-17). Solo agregados
 * pseudonimizados. Si la cohorte tiene < 5 pacientes, NO pinta ningún dato:
 * muestra el aviso de k-anonimato (la demostración de privacidad por diseño).
 */
export default function CohorteBloque({ cohorte }: { cohorte: CohorteVista }) {
  if (!cohorte.resumen.suficiente) {
    return (
      <section className="informe-seccion flex flex-col gap-2 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-acento-fuerte" aria-hidden />
          <h2 className="text-lg font-bold text-texto">{cohorte.nombre}</h2>
        </div>
        <p className="text-base text-texto-suave">
          <span className="font-semibold text-texto">Datos insuficientes.</span>{" "}
          Esta cohorte tiene menos de 5 pacientes. Por privacidad (k-anonimato ≥ 5)
          no se muestra ningún agregado: el patrocinador nunca ve cortes tan
          pequeños que pudieran reidentificar a una paciente.
        </p>
      </section>
    );
  }

  const persistencia: PuntoBarra[] = cohorte.persistencia.map((p) => ({
    etiqueta: `Mes ${p.mes}`,
    valor: p.tasa,
  }));
  const adherencia: PuntoBarra[] = cohorte.adherencia.map((a) => ({
    etiqueta: etiquetaMes(a.mes),
    valor: a.adherencia,
  }));
  const motivos: PuntoBarra[] = cohorte.motivos.map((m) => ({
    etiqueta: limpiarEtiqueta(m.etiqueta),
    valor: m.conteo,
  }));
  const alertas: PuntoBarra[] = cohorte.alertas.map((a) => ({
    etiqueta: NIVEL_ETIQUETA[a.nivel] ?? a.nivel,
    valor: a.conteo,
  }));

  const tasa = cohorte.tasaCheckin.suficiente ? cohorte.tasaCheckin.tasa : null;
  const meses = cohorte.meses.suficiente ? cohorte.meses.mediana : null;
  const tiempo = cohorte.tiempoDisposicion.suficiente
    ? cohorte.tiempoDisposicion.medianaHoras
    : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-texto">{cohorte.nombre}</h2>
        <span className="text-sm text-texto-suave">
          {cohorte.resumen.n} pacientes
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <TarjetaKpi etiqueta="Pacientes" valor={String(cohorte.resumen.n)} />
        <TarjetaKpi
          etiqueta="Tasa de check-in (30 d)"
          valor={tasa === null ? "—" : String(tasa)}
          sufijo={tasa === null ? undefined : "%"}
          nota="benchmark Noona 90%"
        />
        <TarjetaKpi
          etiqueta="Meses en tratamiento (mediana)"
          valor={meses === null ? "—" : String(meses)}
        />
        <TarjetaKpi
          etiqueta="Tiempo hasta disposición (mediana)"
          valor={tiempo === null ? "—" : String(tiempo)}
          sufijo={tiempo === null ? undefined : " h"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Grafico
          titulo="Persistencia (% de pautas activas por mes)"
          datos={persistencia}
          color={PALETA.acento}
          maxY={100}
          unidad="%"
          mensajeVacio="Sin datos de persistencia en la cohorte."
        />
        <Grafico
          titulo="Adherencia media mensual"
          datos={adherencia}
          color={PALETA.primario}
          maxY={100}
          unidad="%"
          mostrarValores
          mensajeVacio="Ningún mes alcanza 5 pacientes (suprimido)."
        />
        <Grafico
          titulo="Motivos de discontinuación"
          datos={motivos}
          color={PALETA.vigilancia}
          mostrarValores
          mensajeVacio="Sin discontinuaciones codificadas en el período."
        />
        <Grafico
          titulo="Alertas por nivel"
          datos={alertas}
          color={PALETA.cognicion}
          mostrarValores
          mensajeVacio="Sin alertas en el período."
        />
      </div>
    </section>
  );
}
