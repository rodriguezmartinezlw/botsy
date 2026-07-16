/**
 * Carga y AGREGACIÓN de los datos del perfil del paciente autenticado (WP-05).
 *
 * Server-only: lee de Supabase con el cliente de SERVIDOR (cookies), de modo que
 * la RLS 'propio' de WP-01 garantiza que el paciente sólo ve lo suyo. Aquí NO se
 * pinta nada: se leen las filas, se resuelve la fecha clínica de cada
 * observación (la del check-in), y se delega TODA la agregación en
 * `@/lib/agregados` (puro). El resultado (`DatosPerfil`) son series ya
 * calculadas que se pasan a los componentes cliente de gráfico.
 *
 * Ante ausencia de sesión, de backend o de datos, devuelve un `DatosPerfil`
 * vacío coherente (la página muestra estados vacíos amables). Nunca lanza.
 */

import { format, parseISO, subDays } from "date-fns";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";
import { etiquetaEjeFecha } from "@/components/graficos/formato";
import {
  DIAS_PERIODO,
  deltaPorcentual,
  evolucionMensualAdherencia,
  mediaSerie,
  mediasDiarias,
  picoSerie,
  porcentajeAdherencia,
  rangoAnterior,
  rangoPeriodo,
  recuentoSintomas,
  semanaAdherencia,
  seriesAnimoEstres,
  type ObservacionFechada,
  type Periodo,
  type SeriePunto,
  type TomaFechada,
} from "@/lib/agregados";
import type {
  AdherenciaFarmaco,
  BundlePeriodo,
  DatosPerfil,
} from "@/components/paciente/perfil/tipos";

const PERIODOS: Periodo[] = ["semana", "mes", "tres_meses"];

/** Días que se leen (2× el período mayor, para el delta del período anterior). */
const DIAS_VENTANA = DIAS_PERIODO.tres_meses * 2; // 180

function inicialDe(nombre: string): string {
  const limpio = nombre.trim();
  return limpio.length > 0 ? limpio[0].toUpperCase() : "?";
}

function perfilVacio(nombre = "", inicial = "?"): DatosPerfil {
  const periodoVacio: BundlePeriodo = {
    dolor: { serie: [], media: null, delta: null, pico: null },
    animo: [],
    sueno: [],
    adherencia: { global: null, porFarmaco: {} },
  };
  return {
    cabecera: {
      nombre,
      inicial,
      avatarUrl: null,
      rachaActual: 0,
      checkinsMes: 0,
    },
    farmacos: [],
    cognicion: [],
    sintomas: [],
    porPeriodo: {
      semana: periodoVacio,
      mes: periodoVacio,
      tres_meses: periodoVacio,
    },
  };
}

/** Convierte una serie diaria en barras (una por día con dato; omite nulos). */
function serieABarras(serie: SeriePunto[]) {
  return serie
    .filter((p): p is { fecha: string; valor: number } => p.valor !== null)
    .map((p) => ({ etiqueta: etiquetaEjeFecha(p.fecha), valor: p.valor }));
}

export async function cargarDatosPerfil(): Promise<DatosPerfil> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return perfilVacio();

    // Perfil + paciente (nombre, avatar, racha, zona).
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, avatar_url, zona_horaria")
      .eq("id", user.id)
      .maybeSingle();
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("racha_actual")
      .eq("id", user.id)
      .maybeSingle();

    const nombre = perfil?.nombre ?? "";
    const inicial = inicialDe(nombre);
    const hoy = fechaHoyEnZona(perfil?.zona_horaria ?? "Europe/Madrid");
    const desde = format(subDays(parseISO(hoy), DIAS_VENTANA - 1), "yyyy-MM-dd");

    // Check-ins de la ventana: id -> fecha (para fechar observaciones) + conteo mensual.
    const { data: checkins } = await supabase
      .from("checkins")
      .select("id, fecha")
      .eq("paciente_id", user.id)
      .gte("fecha", desde);
    const fechaPorCheckin = new Map<string, string>();
    let checkinsMes = 0;
    const mesActual = hoy.slice(0, 7);
    for (const c of checkins ?? []) {
      fechaPorCheckin.set(c.id, c.fecha);
      if (c.fecha.slice(0, 7) === mesActual) checkinsMes += 1;
    }

    // Observaciones: se les resuelve la fecha clínica vía el check-in.
    const { data: observaciones } = await supabase
      .from("observaciones")
      .select("checkin_id, dominio, codigo, valor_num")
      .eq("paciente_id", user.id);
    const obsFechadas: ObservacionFechada[] = [];
    for (const o of observaciones ?? []) {
      const fecha = fechaPorCheckin.get(o.checkin_id);
      if (!fecha) continue; // fuera de la ventana o sin check-in asociado
      obsFechadas.push({
        fecha,
        dominio: o.dominio,
        codigo: o.codigo,
        valor_num: o.valor_num,
      });
    }

    // Pautas activas + tomas de la ventana.
    const { data: pautas } = await supabase
      .from("pautas_medicacion")
      .select("id, farmaco, dosis, critica")
      .eq("paciente_id", user.id)
      .eq("activa", true);
    const { data: tomas } = await supabase
      .from("tomas_medicacion")
      .select("pauta_id, fecha, estado")
      .eq("paciente_id", user.id)
      .gte("fecha", desde);
    const tomasFechadas: TomaFechada[] = (tomas ?? []).map((t) => ({
      fecha: t.fecha,
      estado: t.estado,
      pautaId: t.pauta_id,
    }));

    // --- Adherencia por fármaco (independiente del período) ------------------
    const farmacos: AdherenciaFarmaco[] = (pautas ?? []).map((p) => {
      const suyas = tomasFechadas.filter((t) => t.pautaId === p.id);
      return {
        pautaId: p.id,
        farmaco: p.farmaco,
        dosis: p.dosis,
        critica: p.critica,
        semana: semanaAdherencia(suyas, hoy),
        evolucionMensual: evolucionMensualAdherencia(suyas),
      };
    });

    // --- Bundles por período -------------------------------------------------
    const porPeriodo = {} as Record<Periodo, BundlePeriodo>;
    for (const periodo of PERIODOS) {
      const rango = rangoPeriodo(periodo, hoy);
      const rangoPrev = rangoAnterior(periodo, hoy);

      const serieDolor = mediasDiarias(obsFechadas, rango, "dolor");
      const mediaActual = mediaSerie(serieDolor);
      const mediaPrev = mediaSerie(mediasDiarias(obsFechadas, rangoPrev, "dolor"));

      const tomasPeriodo = tomasFechadas.filter(
        (t) => t.fecha >= rango.desde && t.fecha <= rango.hasta,
      );
      const porFarmaco: Record<string, number | null> = {};
      for (const p of pautas ?? []) {
        porFarmaco[p.id] = porcentajeAdherencia(
          tomasPeriodo.filter((t) => t.pautaId === p.id),
        );
      }

      porPeriodo[periodo] = {
        dolor: {
          serie: serieDolor,
          media: mediaActual,
          delta: deltaPorcentual(mediaActual, mediaPrev),
          pico: picoSerie(serieDolor),
        },
        animo: seriesAnimoEstres(obsFechadas, rango),
        sueno: serieABarras(mediasDiarias(obsFechadas, rango, "sueno")),
        adherencia: {
          global: porcentajeAdherencia(tomasPeriodo),
          porFarmaco,
        },
      };
    }

    // Cognición: serie de los últimos 90 días (su tarjeta tiene selector propio).
    const cognicion = mediasDiarias(
      obsFechadas,
      rangoPeriodo("tres_meses", hoy),
      "cognicion",
    );

    // Síntomas físicos: recuento de los últimos 30 días.
    const sintomas = recuentoSintomas(obsFechadas, rangoPeriodo("mes", hoy));

    return {
      cabecera: {
        nombre,
        inicial,
        avatarUrl: perfil?.avatar_url ?? null,
        rachaActual: paciente?.racha_actual ?? 0,
        checkinsMes,
      },
      farmacos,
      cognicion,
      sintomas,
      porPeriodo,
    };
  } catch {
    return perfilVacio();
  }
}
