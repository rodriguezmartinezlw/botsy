/**
 * Carga de datos del informe de seguimiento (WP-07) — SERVER ONLY.
 *
 * Recibe el cliente de SERVIDOR de la sesión del profesional (de
 * `obtenerSesionPanel`): la RLS de WP-01 garantiza que sólo puede leer los datos
 * de SUS pacientes. Si el paciente no está asignado, `cargarDatosInforme`
 * devuelve `null` (la página responde 404). Nunca usa service-role.
 *
 * Reutiliza las agregaciones puras de WP-05 (`@/lib/agregados`) para dolor,
 * ánimo y adherencia, de modo que las cifras del informe coinciden con las del
 * perfil del paciente y con las que se le pasan al LLM.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mediaSerie,
  mediasDiarias,
  picoSerie,
  porcentajeAdherencia,
  recuentoSintomas,
  semanaAdherencia,
  type ObservacionFechada,
  type SeriePunto,
  type TomaFechada,
} from "@/lib/agregados";
import { calcularEdad } from "@/lib/panel/lista";
import {
  estadoVigenteConsentimientos,
  TIPOS_CONSENTIMIENTO,
  type FilaConsentimiento,
} from "@/lib/consentimientos/estado";
import type { BaseDatos, DominioObservacion, VerticalPaciente } from "@/types/db";
import type {
  AlertaInforme,
  AnimoInforme,
  DatosInforme,
  FarmacoInforme,
  MetricaDominio,
  ObservacionDestacada,
} from "./tipos";

function inicialDe(nombre: string): string {
  const limpio = (nombre ?? "").trim();
  return limpio.length > 0 ? limpio[0].toUpperCase() : "?";
}

/** Nº de días con al menos un valor no nulo en una serie densa. */
function diasConDato(serie: SeriePunto[]): number {
  return serie.filter((p) => p.valor !== null).length;
}

function metricaDominio(
  obs: ObservacionFechada[],
  rango: { desde: string; hasta: string },
  dominio: DominioObservacion,
): MetricaDominio {
  const serie = mediasDiarias(obs, rango, dominio);
  return { media: mediaSerie(serie), registros: diasConDato(serie) };
}

/** Nº de días entre dos fechas "yyyy-MM-dd" inclusive. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

export async function cargarDatosInforme(
  supabase: SupabaseClient<BaseDatos>,
  pacienteId: string,
  desde: string,
  hasta: string,
): Promise<DatosInforme | null> {
  const rango = { desde, hasta };

  // RLS: si el paciente no está asignado a este profesional, no hay fila.
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id, fecha_nacimiento, sexo, vertical, condiciones")
    .eq("id", pacienteId)
    .maybeSingle();
  if (!paciente) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", pacienteId)
    .maybeSingle();
  const nombre = perfil?.nombre ?? "Paciente";

  // --- Check-ins del período (para fechar observaciones y contar) -----------
  const { data: checkins } = await supabase
    .from("checkins")
    .select("id, fecha")
    .eq("paciente_id", pacienteId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const fechaPorCheckin = new Map<string, string>();
  for (const c of checkins ?? []) fechaPorCheckin.set(c.id, c.fecha);
  const totalCheckins = checkins?.length ?? 0;

  // --- Observaciones (fechadas por su check-in) -----------------------------
  const { data: observaciones } = await supabase
    .from("observaciones")
    .select("checkin_id, dominio, codigo, valor_num, valor_texto")
    .eq("paciente_id", pacienteId);
  const obsFechadas: ObservacionFechada[] = [];
  const destacadas: ObservacionDestacada[] = [];
  for (const o of observaciones ?? []) {
    const fecha = fechaPorCheckin.get(o.checkin_id);
    if (!fecha) continue; // observación fuera del período (su check-in no está)
    obsFechadas.push({
      fecha,
      dominio: o.dominio,
      codigo: o.codigo,
      valor_num: o.valor_num,
    });
    if (typeof o.valor_texto === "string" && o.valor_texto.trim().length > 0) {
      destacadas.push({
        fecha,
        dominio: o.dominio,
        codigo: o.codigo,
        texto: o.valor_texto.trim(),
      });
    }
  }
  destacadas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  // --- Dolor ----------------------------------------------------------------
  const serieDolor = mediasDiarias(obsFechadas, rango, "dolor");
  const dolor = {
    serie: serieDolor,
    media: mediaSerie(serieDolor),
    pico: picoSerie(serieDolor),
    minimo: minimoSerie(serieDolor),
    registros: diasConDato(serieDolor),
  };

  // --- Ánimo / ansiedad / estrés --------------------------------------------
  const animo: AnimoInforme = {
    animo: metricaDominio(obsFechadas, rango, "animo"),
    ansiedad: metricaDominio(obsFechadas, rango, "ansiedad"),
    estres: metricaDominio(obsFechadas, rango, "estres"),
  };

  // --- Adherencia por fármaco -----------------------------------------------
  const { data: pautas } = await supabase
    .from("pautas_medicacion")
    .select("id, farmaco, dosis, critica, activa")
    .eq("paciente_id", pacienteId);

  const { data: tomas } = await supabase
    .from("tomas_medicacion")
    .select("pauta_id, fecha, estado")
    .eq("paciente_id", pacienteId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const tomasFechadas: TomaFechada[] = (tomas ?? []).map((t) => ({
    fecha: t.fecha,
    estado: t.estado,
    pautaId: t.pauta_id,
  }));

  const farmacos: FarmacoInforme[] = (pautas ?? [])
    .filter((p) => p.activa)
    .map((p) => {
      const suyas = tomasFechadas.filter((t) => t.pautaId === p.id);
      const { tomadas, omitidas } = contarTomas(suyas);
      return {
        farmaco: p.farmaco,
        dosis: p.dosis,
        critica: p.critica,
        porcentaje: porcentajeAdherencia(suyas),
        tomadas,
        omitidas,
        semana: semanaAdherencia(suyas, hasta),
      };
    });
  const globalCuentas = contarTomas(tomasFechadas);
  const adherencia = {
    global: {
      porcentaje: porcentajeAdherencia(tomasFechadas),
      tomadas: globalCuentas.tomadas,
      omitidas: globalCuentas.omitidas,
    },
    farmacos,
  };

  // --- Alertas del período ---------------------------------------------------
  const { data: alertasRaw } = await supabase
    .from("alertas")
    .select("id, nivel, estado, motivo, motivo_descarte, evidencia, creado_en, gestionada_en")
    .eq("paciente_id", pacienteId)
    .order("creado_en", { ascending: false });
  const alertas: AlertaInforme[] = (alertasRaw ?? [])
    .filter((a) => {
      const f = a.creado_en.slice(0, 10);
      return f >= desde && f <= hasta;
    })
    .map((a) => ({
      id: a.id,
      nivel: a.nivel,
      estado: a.estado,
      motivo: a.motivo,
      evidencia: a.evidencia,
      creadoEn: a.creado_en,
      gestionadaEn: a.gestionada_en,
      motivoDescarte: a.motivo_descarte,
    }));

  // --- Consentimientos vigentes (solo lectura) ------------------------------
  const { data: consentRaw } = await supabase
    .from("consentimientos")
    .select("tipo, otorgado, registrado_en")
    .eq("paciente_id", pacienteId);
  const estado = estadoVigenteConsentimientos(
    (consentRaw ?? []) as FilaConsentimiento[],
  );
  const consentimientos = TIPOS_CONSENTIMIENTO.map((tipo) => ({
    tipo,
    otorgado: estado[tipo],
  }));

  const vertical: VerticalPaciente = paciente.vertical;

  return {
    paciente: {
      id: paciente.id,
      nombre,
      inicial: inicialDe(nombre),
      edad: calcularEdad(paciente.fecha_nacimiento, hasta),
      sexo: paciente.sexo,
      vertical,
      condiciones: paciente.condiciones ?? [],
    },
    periodo: { desde, hasta, dias: diasEntre(desde, hasta) },
    totalCheckins,
    dolor,
    animo,
    adherencia,
    alertas,
    sintomas: recuentoSintomas(obsFechadas, rango),
    observaciones: destacadas.slice(0, 8),
    consentimientos,
  };
}

function minimoSerie(serie: SeriePunto[]): number | null {
  const valores = serie
    .map((p) => p.valor)
    .filter((v): v is number => v !== null);
  return valores.length > 0 ? Math.min(...valores) : null;
}

function contarTomas(tomas: TomaFechada[]): { tomadas: number; omitidas: number } {
  let tomadas = 0;
  let omitidas = 0;
  for (const t of tomas) {
    if (t.estado === "tomada") tomadas += 1;
    else if (t.estado === "omitida") omitidas += 1;
  }
  return { tomadas, omitidas };
}
