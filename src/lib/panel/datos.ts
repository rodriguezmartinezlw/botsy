/**
 * Carga de datos del panel profesional (WP-06) — SERVER ONLY.
 *
 * Todas las lecturas usan el cliente de SERVIDOR (cookies): la RLS de profesional
 * de WP-01 garantiza que cada profesional sólo ve a SUS pacientes asignados y sus
 * datos. NO se usa el cliente de servicio (service-role) para leer datos de
 * pacientes: si una lectura "necesitara" service-role sería porque falta una
 * política en WP-01, y se anotaría en la entrega, no se saltaría la RLS.
 *
 * Ante ausencia de sesión, de backend o de datos, se devuelven valores vacíos
 * coherentes (nunca se lanza): la UI muestra estados vacíos amables.
 */

import "server-only";
import { format, parseISO, subDays } from "date-fns";
import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";
import { parsearCondicion } from "@/lib/escalado/motor";
import {
  deltaPorcentual,
  mediaSerie,
  mediasDiarias,
  porcentajeAdherencia,
  rangoAnterior,
  rangoPeriodo,
  semanaAdherencia,
  seriesAnimoEstres,
  type ObservacionFechada,
  type TomaFechada,
} from "@/lib/agregados";
import { describirCondicion } from "./reglas-plantillas";
import {
  filtrarDesenlacesPendientes,
  fechaVencimiento,
} from "@/lib/disposiciones/nucleo";
import { configEfectiva } from "@/lib/programas/config";
import { describirConfig } from "@/lib/programas/describir";
import {
  problemasFrecuentes,
  serieDistres,
  type RespuestaDistres,
} from "@/lib/instrumentos/termometro";
import {
  calcularEdad,
  diasSinCheckin,
  nivelSemaforo,
  ordenarPacientes,
  type PacienteLista,
} from "./lista";
import type {
  AlertaDetalle,
  DesenlacePendienteVista,
  DisposicionVista,
  DistresTendencia,
  FichaPaciente,
  ItemTimeline,
  MotivoCatalogo,
  PautaVista,
  ProgramaPacienteVista,
  ReglaVista,
  TendenciasCompactas,
} from "./tipos";
import type { Json, VerticalPaciente } from "@/types/db";

const ZONA_POR_DEFECTO = "Europe/Madrid";

function inicialDe(nombre: string): string {
  const limpio = (nombre ?? "").trim();
  return limpio.length > 0 ? limpio[0].toUpperCase() : "?";
}

/** Devuelve la mayor de dos fechas "yyyy-MM-dd" (o la no nula, o null). */
function maxFecha(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

// =====================================================================
// Badge del sidebar: nº de alertas NUEVAS visibles para el profesional.
// =====================================================================

export async function contarAlertasNuevas(): Promise<number> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;
    const { count } = await supabase
      .from("alertas")
      .select("id", { count: "exact", head: true })
      .eq("estado", "nueva");
    return count ?? 0;
  } catch {
    return 0;
  }
}

// =====================================================================
// Catálogo de programas activos (para el alta de pacientes, WP-20 §A).
// =====================================================================

export type PlantillaProgramaLista = {
  clave: string;
  nombre: string;
  descripcion: string | null;
};

/** Programas activos del catálogo, para el desplegable del alta. Nunca lanza. */
export async function listarProgramasActivos(): Promise<PlantillaProgramaLista[]> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("programas")
      .select("clave, nombre, descripcion")
      .eq("activo", true)
      .order("nombre", { ascending: true });
    return (data ?? []).map((p) => ({
      clave: p.clave,
      nombre: p.nombre,
      descripcion: p.descripcion,
    }));
  } catch {
    return [];
  }
}

// =====================================================================
// Instituciones del profesional actual (WP-22): para el alta y el filtro.
// =====================================================================

export type InstitucionProfesional = {
  id: string;
  nombre: string;
  paisNombre: string | null;
};

/**
 * Instituciones del profesional actual (sus membresías activas). Para el admin
 * devuelve todas las instituciones activas (puede adscribir a cualquiera). Nunca
 * lanza: ante falta de sesión/datos devuelve lista vacía y la UI muestra el aviso
 * de "pide una institución al administrador".
 */
export async function listarInstitucionesDelProfesional(): Promise<
  InstitucionProfesional[]
> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    type FilaInstitucion = { id: string; nombre: string; pais_codigo: string };
    let instituciones: FilaInstitucion[] = [];
    if (perfil?.rol === "admin") {
      const { data } = await supabase
        .from("instituciones")
        .select("id, nombre, pais_codigo")
        .eq("activa", true)
        .order("nombre", { ascending: true });
      instituciones = data ?? [];
    } else {
      // RLS: SÓLO las membresías propias del profesional.
      const { data: membresias } = await supabase
        .from("profesionales_instituciones")
        .select("institucion_id")
        .eq("activa", true);
      const ids = (membresias ?? []).map((m) => m.institucion_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("instituciones")
        .select("id, nombre, pais_codigo")
        .in("id", ids)
        .eq("activa", true)
        .order("nombre", { ascending: true });
      instituciones = data ?? [];
    }
    if (instituciones.length === 0) return [];

    const paisCodigos = [...new Set(instituciones.map((i) => i.pais_codigo))];
    const { data: paises } = await supabase
      .from("paises")
      .select("codigo, nombre")
      .in("codigo", paisCodigos);
    const nombrePais = new Map((paises ?? []).map((p) => [p.codigo, p.nombre]));

    return instituciones.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      paisNombre: nombrePais.get(i.pais_codigo) ?? null,
    }));
  } catch {
    return [];
  }
}

// =====================================================================
// Lista de pacientes (RF-DB, versión F1).
// =====================================================================

export async function listarPacientes(): Promise<PacienteLista[]> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const hoy = fechaHoyEnZona(ZONA_POR_DEFECTO);
    const desde7 = format(subDays(parseISO(hoy), 6), "yyyy-MM-dd");

    // RLS: sólo pacientes de las instituciones de este profesional (WP-22).
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, fecha_nacimiento, vertical, ultimo_checkin, institucion_id");
    if (!pacientes || pacientes.length === 0) return [];

    const ids = pacientes.map((p) => p.id);
    const institucionIds = [
      ...new Set(
        pacientes
          .map((p) => p.institucion_id)
          .filter((x): x is string => x !== null),
      ),
    ];

    const [
      { data: perfiles },
      { data: checkins },
      { data: tomas },
      { data: alertas },
      { data: instituciones },
    ] = await Promise.all([
      supabase.from("perfiles").select("id, nombre, avatar_url").in("id", ids),
      supabase.from("checkins").select("paciente_id, fecha").in("paciente_id", ids),
      supabase
        .from("tomas_medicacion")
        .select("paciente_id, estado, fecha")
        .in("paciente_id", ids)
        .gte("fecha", desde7),
      supabase
        .from("alertas")
        .select("paciente_id, nivel, estado")
        .in("paciente_id", ids)
        .in("estado", ["nueva", "vista"]),
      institucionIds.length
        ? supabase
            .from("instituciones")
            .select("id, nombre")
            .in("id", institucionIds)
        : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    ]);

    const perfilPorId = new Map(
      (perfiles ?? []).map((p) => [p.id, p]),
    );
    const nombreInstitucionPorId = new Map(
      (instituciones ?? []).map((i) => [i.id, i.nombre]),
    );
    const ultimoCheckinPorPaciente = new Map<string, string | null>();
    for (const c of checkins ?? []) {
      ultimoCheckinPorPaciente.set(
        c.paciente_id,
        maxFecha(ultimoCheckinPorPaciente.get(c.paciente_id) ?? null, c.fecha),
      );
    }

    const lista: PacienteLista[] = pacientes.map((p) => {
      const perfil = perfilPorId.get(p.id);
      const nombre = perfil?.nombre ?? "Paciente";
      const ultimoCheckin = maxFecha(
        p.ultimo_checkin,
        ultimoCheckinPorPaciente.get(p.id) ?? null,
      );
      const tomasPaciente = (tomas ?? []).filter((t) => t.paciente_id === p.id);
      const alertasPaciente = (alertas ?? []).filter(
        (a) => a.paciente_id === p.id,
      );
      return {
        id: p.id,
        nombre,
        inicial: inicialDe(nombre),
        avatarUrl: perfil?.avatar_url ?? null,
        edad: calcularEdad(p.fecha_nacimiento, hoy),
        vertical: p.vertical,
        adherencia7: porcentajeAdherencia(tomasPaciente),
        ultimoCheckin,
        diasSinCheckin: diasSinCheckin(ultimoCheckin, hoy),
        semaforo: nivelSemaforo(alertasPaciente),
        institucionId: p.institucion_id,
        institucionNombre: p.institucion_id
          ? nombreInstitucionPorId.get(p.institucion_id) ?? null
          : null,
      };
    });

    return ordenarPacientes(lista);
  } catch {
    return [];
  }
}

// =====================================================================
// Ficha 360º de un paciente.
// =====================================================================

/** Traduce una fila de `reglas_escalado` a la vista legible (sin JSON crudo). */
function reglaAVista(fila: {
  id: string;
  nombre: string;
  descripcion: string | null;
  condicion: unknown;
  nivel: ReglaVista["nivel"];
  activa: boolean;
  vertical: string | null;
}): ReglaVista {
  const cond = parsearCondicion(fila.condicion as never);
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    condicionTexto: cond ? describirCondicion(cond) : "Condición personalizada.",
    nivel: fila.nivel,
    activa: fila.activa,
    vertical: fila.vertical,
  };
}

/** Coacciona el jsonb `items` de una respuesta de instrumento a lista de códigos. */
function itemsAProblemas(items: Json | null): string[] {
  if (!Array.isArray(items)) return [];
  return items.filter((x): x is string => typeof x === "string");
}

/**
 * Bloque del Termómetro de Distrés (WP-16): serie temporal + media + última
 * puntuación + problemas más frecuentes. `null` si el paciente no tiene ninguna
 * respuesta registrada (no se muestra la tarjeta).
 */
function construirDistres(
  hoy: string,
  respuestas: RespuestaDistres[],
): DistresTendencia | null {
  if (respuestas.length === 0) return null;
  const rango = rangoPeriodo("tres_meses", hoy);
  const serie = serieDistres(respuestas, rango);
  const ordenadas = [...respuestas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultima = ordenadas[ordenadas.length - 1]?.puntuacion ?? null;
  return {
    serie,
    media: mediaSerie(serie),
    ultima,
    problemas: problemasFrecuentes(respuestas).map((p) => ({
      codigo: p.codigo,
      etiqueta: p.etiqueta,
      recuento: p.recuento,
    })),
  };
}

function construirTendencias(
  hoy: string,
  obsFechadas: ObservacionFechada[],
  pautasActivas: { id: string; farmaco: string; dosis: string | null; critica: boolean }[],
  tomasFechadas: TomaFechada[],
  respuestasDistres: RespuestaDistres[],
): TendenciasCompactas {
  const rango = rangoPeriodo("mes", hoy);
  const rangoPrev = rangoAnterior("mes", hoy);
  const serieDolor = mediasDiarias(obsFechadas, rango, "dolor");
  const mediaActual = mediaSerie(serieDolor);
  const mediaPrev = mediaSerie(mediasDiarias(obsFechadas, rangoPrev, "dolor"));

  const rango7 = rangoPeriodo("semana", hoy);
  const farmacos = pautasActivas.map((p) => {
    const suyas = tomasFechadas.filter((t) => t.pautaId === p.id);
    const suyas7 = suyas.filter(
      (t) => t.fecha >= rango7.desde && t.fecha <= rango7.hasta,
    );
    return {
      pautaId: p.id,
      farmaco: p.farmaco,
      dosis: p.dosis,
      critica: p.critica,
      semana: semanaAdherencia(suyas, hoy),
      adherencia7: porcentajeAdherencia(suyas7),
    };
  });

  return {
    hoy,
    dolor: {
      serie: serieDolor,
      media: mediaActual,
      delta: deltaPorcentual(mediaActual, mediaPrev),
    },
    animo: seriesAnimoEstres(obsFechadas, rango),
    farmacos,
    distres: construirDistres(hoy, respuestasDistres),
  };
}

export async function cargarFichaPaciente(
  pacienteId: string,
): Promise<FichaPaciente | null> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // RLS: si el paciente no está asignado a este profesional, no hay fila.
    const { data: paciente } = await supabase
      .from("pacientes")
      .select(
        "id, fecha_nacimiento, sexo, vertical, condiciones, racha_actual, racha_maxima, ultimo_checkin, institucion_id",
      )
      .eq("id", pacienteId)
      .maybeSingle();
    if (!paciente) return null;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, avatar_url, telefono, zona_horaria")
      .eq("id", pacienteId)
      .maybeSingle();

    // Institución + país del paciente (WP-22). RLS: el catálogo es legible por el
    // profesional; el paciente ya es visible, así que su institución también.
    let institucionNombre: string | null = null;
    let paisNombre: string | null = null;
    if (paciente.institucion_id) {
      const { data: institucion } = await supabase
        .from("instituciones")
        .select("nombre, pais_codigo")
        .eq("id", paciente.institucion_id)
        .maybeSingle();
      institucionNombre = institucion?.nombre ?? null;
      if (institucion?.pais_codigo) {
        const { data: pais } = await supabase
          .from("paises")
          .select("nombre")
          .eq("codigo", institucion.pais_codigo)
          .maybeSingle();
        paisNombre = pais?.nombre ?? null;
      }
    }

    const nombre = perfil?.nombre ?? "Paciente";
    const zona = perfil?.zona_horaria ?? ZONA_POR_DEFECTO;
    const hoy = fechaHoyEnZona(zona);

    // --- Check-ins + mensajes (transcripts) --------------------------------
    const { data: checkins } = await supabase
      .from("checkins")
      .select(
        "id, fecha, canal, estado, riesgo, resumen, finalizado_en, creado_en",
      )
      .eq("paciente_id", pacienteId)
      .order("creado_en", { ascending: false });

    const idsCheckins = (checkins ?? []).map((c) => c.id);
    const fechaPorCheckin = new Map<string, string>();
    for (const c of checkins ?? []) fechaPorCheckin.set(c.id, c.fecha);

    const { data: mensajes } = idsCheckins.length
      ? await supabase
          .from("mensajes")
          .select("checkin_id, rol, contenido, orden")
          .in("checkin_id", idsCheckins)
          .order("orden", { ascending: true })
      : { data: [] };
    const mensajesPorCheckin = new Map<string, { rol: string; contenido: string }[]>();
    for (const m of mensajes ?? []) {
      const lista = mensajesPorCheckin.get(m.checkin_id) ?? [];
      lista.push({ rol: m.rol, contenido: m.contenido });
      mensajesPorCheckin.set(m.checkin_id, lista);
    }

    // --- Observaciones (con fecha clínica) + tomas para las tendencias -----
    const { data: observaciones } = await supabase
      .from("observaciones")
      .select("checkin_id, dominio, codigo, valor_num")
      .eq("paciente_id", pacienteId);
    const obsFechadas: ObservacionFechada[] = [];
    for (const o of observaciones ?? []) {
      const fecha = fechaPorCheckin.get(o.checkin_id);
      if (!fecha) continue;
      obsFechadas.push({
        fecha,
        dominio: o.dominio,
        codigo: o.codigo,
        valor_num: o.valor_num,
      });
    }

    const { data: pautas } = await supabase
      .from("pautas_medicacion")
      .select("id, farmaco, dosis, momentos, critica, activa, creado_en, desactivada_en")
      .eq("paciente_id", pacienteId)
      .order("creado_en", { ascending: false });

    const { data: tomas } = await supabase
      .from("tomas_medicacion")
      .select("pauta_id, fecha, estado")
      .eq("paciente_id", pacienteId);
    const tomasFechadas: TomaFechada[] = (tomas ?? []).map((t) => ({
      fecha: t.fecha,
      estado: t.estado,
      pautaId: t.pauta_id,
    }));

    // Respuestas del Termómetro de Distrés (WP-16). Fecha = del check-in si lo
    // hay; si no, la de creación. RLS: sólo las de sus pacientes.
    const { data: instrumentos } = await supabase
      .from("instrumentos_respuestas")
      .select("checkin_id, puntuacion, items, creado_en")
      .eq("paciente_id", pacienteId)
      .eq("instrumento", "termometro_distres_nccn")
      .order("creado_en", { ascending: true });
    const respuestasDistres: RespuestaDistres[] = (instrumentos ?? []).map((r) => ({
      fecha:
        (r.checkin_id ? fechaPorCheckin.get(r.checkin_id) : null) ??
        r.creado_en.slice(0, 10),
      puntuacion: Number(r.puntuacion),
      problemas: itemsAProblemas(r.items),
    }));

    const { data: alertas } = await supabase
      .from("alertas")
      .select("id, nivel, estado, motivo, evidencia, creado_en")
      .eq("paciente_id", pacienteId)
      .order("creado_en", { ascending: false });

    const { data: consentimientos } = await supabase
      .from("consentimientos")
      .select("id, tipo, otorgado, version_texto, registrado_en")
      .eq("paciente_id", pacienteId)
      .order("registrado_en", { ascending: false });

    // Reglas: globales aplicables (paciente_id null y vertical libre o de este
    // paciente) + reglas propias de este paciente.
    const { data: reglas } = await supabase
      .from("reglas_escalado")
      .select("id, paciente_id, vertical, nombre, descripcion, condicion, nivel, activa")
      .order("creado_en", { ascending: true });

    const vertical: VerticalPaciente = paciente.vertical;
    const reglasGlobales: ReglaVista[] = [];
    const reglasPaciente: ReglaVista[] = [];
    for (const r of reglas ?? []) {
      if (r.paciente_id === pacienteId) {
        reglasPaciente.push(reglaAVista(r));
      } else if (
        r.paciente_id === null &&
        (r.vertical === null || r.vertical === vertical)
      ) {
        reglasGlobales.push(reglaAVista(r));
      }
    }

    // --- Línea temporal unificada ------------------------------------------
    const timeline: ItemTimeline[] = [];
    for (const c of checkins ?? []) {
      timeline.push({
        tipo: "checkin",
        id: c.id,
        ts: c.finalizado_en ?? c.creado_en,
        fecha: c.fecha,
        canal: c.canal,
        estado: c.estado,
        riesgo: c.riesgo,
        resumen: c.resumen,
        mensajes: mensajesPorCheckin.get(c.id) ?? [],
      });
    }
    for (const a of alertas ?? []) {
      timeline.push({
        tipo: "alerta",
        id: a.id,
        ts: a.creado_en,
        nivel: a.nivel,
        estado: a.estado,
        motivo: a.motivo,
        evidencia: a.evidencia,
      });
    }
    for (const p of pautas ?? []) {
      timeline.push({
        tipo: "medicacion",
        id: p.id,
        ts: p.creado_en,
        farmaco: p.farmaco,
        dosis: p.dosis,
        critica: p.critica,
        activa: p.activa,
        evento: "alta",
      });
      // WP-10 ítem 1: evento fechado de baja cuando la pauta se desactivó.
      if (p.desactivada_en) {
        timeline.push({
          tipo: "medicacion",
          id: `${p.id}:baja`,
          ts: p.desactivada_en,
          farmaco: p.farmaco,
          dosis: p.dosis,
          critica: p.critica,
          activa: false,
          evento: "baja",
        });
      }
    }
    for (const c of consentimientos ?? []) {
      timeline.push({
        tipo: "consentimiento",
        id: c.id,
        ts: c.registrado_en,
        tipoConsentimiento: c.tipo,
        otorgado: c.otorgado,
        version: c.version_texto,
      });
    }
    timeline.sort((a, b) => b.ts.localeCompare(a.ts));

    const pautasVista: PautaVista[] = (pautas ?? []).map((p) => ({
      id: p.id,
      farmaco: p.farmaco,
      dosis: p.dosis,
      momentos: p.momentos,
      critica: p.critica,
      activa: p.activa,
      creadoEn: p.creado_en,
    }));

    const pautasActivas = (pautas ?? []).filter((p) => p.activa);
    const tendencias = construirTendencias(
      hoy,
      obsFechadas,
      pautasActivas.map((p) => ({
        id: p.id,
        farmaco: p.farmaco,
        dosis: p.dosis,
        critica: p.critica,
      })),
      tomasFechadas,
      respuestasDistres,
    );

    return {
      cabecera: {
        id: paciente.id,
        nombre,
        inicial: inicialDe(nombre),
        avatarUrl: perfil?.avatar_url ?? null,
        edad: calcularEdad(paciente.fecha_nacimiento, hoy),
        sexo: paciente.sexo,
        vertical: paciente.vertical,
        condiciones: paciente.condiciones ?? [],
        telefono: perfil?.telefono ?? null,
        rachaActual: paciente.racha_actual ?? 0,
        rachaMaxima: paciente.racha_maxima ?? 0,
        institucionNombre,
        paisNombre,
      },
      timeline,
      tendencias,
      pautas: pautasVista,
      reglasGlobales,
      reglasPaciente,
    };
  } catch {
    return null;
  }
}

// =====================================================================
// Bandeja de alertas.
// =====================================================================

export async function cargarAlertasBandeja(): Promise<AlertaDetalle[]> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: alertas } = await supabase
      .from("alertas")
      .select(
        "id, paciente_id, checkin_id, nivel, estado, motivo, motivo_descarte, evidencia, creado_en, gestionada_en",
      )
      .order("creado_en", { ascending: false })
      .limit(200);
    if (!alertas || alertas.length === 0) return [];

    const ids = [...new Set(alertas.map((a) => a.paciente_id))];
    const alertaIds = alertas.map((a) => a.id);
    const [{ data: perfiles }, { data: disposiciones }, { data: motivos }] =
      await Promise.all([
        supabase.from("perfiles").select("id, nombre").in("id", ids),
        supabase
          .from("disposiciones")
          .select(
            "id, alerta_id, decision, motivo_codigo, motivo_texto, dias_seguimiento, desenlace, creado_en",
          )
          .in("alerta_id", alertaIds),
        supabase.from("catalogo_motivos").select("id, etiqueta"),
      ]);
    const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));
    const etiquetaMotivo = new Map(
      (motivos ?? []).map((m) => [m.id, m.etiqueta]),
    );
    const disposicionPorAlerta = new Map<string, DisposicionVista>();
    for (const d of disposiciones ?? []) {
      disposicionPorAlerta.set(d.alerta_id, {
        id: d.id,
        decision: d.decision,
        motivoEtiqueta: d.motivo_codigo
          ? etiquetaMotivo.get(d.motivo_codigo) ?? null
          : null,
        motivoTexto: d.motivo_texto,
        diasSeguimiento: d.dias_seguimiento,
        desenlace: d.desenlace,
        creadoEn: d.creado_en,
      });
    }

    return alertas.map((a) => {
      const nombre = nombrePorId.get(a.paciente_id) ?? "Paciente";
      return {
        id: a.id,
        pacienteId: a.paciente_id,
        pacienteNombre: nombre,
        pacienteInicial: inicialDe(nombre),
        checkinId: a.checkin_id,
        nivel: a.nivel,
        estado: a.estado,
        motivo: a.motivo,
        motivoDescarte: a.motivo_descarte,
        evidencia: a.evidencia,
        creadoEn: a.creado_en,
        gestionadaEn: a.gestionada_en,
        disposicion: disposicionPorAlerta.get(a.id) ?? null,
      };
    });
  } catch {
    return [];
  }
}

// =====================================================================
// Catálogo de motivos + desenlaces pendientes (WP-11 v2 §B).
// =====================================================================

/** Motivos del catálogo (para los selects de la disposición). */
export async function cargarMotivos(): Promise<MotivoCatalogo[]> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("catalogo_motivos")
      .select("id, codigo, etiqueta, ambito")
      .eq("activo", true)
      .order("ambito", { ascending: true })
      .order("etiqueta", { ascending: true });
    return (data ?? []).map((m) => ({
      id: m.id,
      codigo: m.codigo,
      etiqueta: m.etiqueta,
      ambito: m.ambito,
    }));
  } catch {
    return [];
  }
}

/**
 * Disposiciones con seguimiento VENCIDO y desenlace 'pendiente' (WP-11 v2 §B.3),
 * ordenadas por vencimiento ascendente (lo más atrasado primero).
 */
export async function cargarDesenlacesPendientes(): Promise<
  DesenlacePendienteVista[]
> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // RLS: sólo disposiciones de alertas de sus pacientes.
    const { data: disposiciones } = await supabase
      .from("disposiciones")
      .select(
        "id, alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, creado_en",
      )
      .eq("desenlace", "pendiente")
      .limit(500);
    if (!disposiciones || disposiciones.length === 0) return [];

    const hoyISO = new Date().toISOString();
    const vencidas = filtrarDesenlacesPendientes(
      disposiciones.map((d) => ({
        id: d.id,
        diasSeguimiento: d.dias_seguimiento,
        desenlace: d.desenlace,
        creadoEn: d.creado_en,
      })),
      hoyISO,
    );
    if (vencidas.length === 0) return [];
    const vencidaIds = new Set(vencidas.map((v) => v.id));
    const porId = new Map(disposiciones.map((d) => [d.id, d]));

    const alertaIds = [
      ...new Set(
        [...vencidaIds].map((id) => porId.get(id)!.alerta_id),
      ),
    ];
    const { data: alertas } = await supabase
      .from("alertas")
      .select("id, paciente_id, nivel, motivo")
      .in("id", alertaIds);
    const alertaPorId = new Map((alertas ?? []).map((a) => [a.id, a]));

    const pacienteIds = [
      ...new Set((alertas ?? []).map((a) => a.paciente_id)),
    ];
    const [{ data: perfiles }, { data: motivos }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre").in("id", pacienteIds),
      supabase.from("catalogo_motivos").select("id, etiqueta"),
    ]);
    const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));
    const etiquetaMotivo = new Map(
      (motivos ?? []).map((m) => [m.id, m.etiqueta]),
    );

    const resultado: DesenlacePendienteVista[] = [];
    for (const v of vencidas) {
      const disp = porId.get(v.id);
      if (!disp) continue;
      const alerta = alertaPorId.get(disp.alerta_id);
      if (!alerta) continue; // RLS: no es de sus pacientes.
      const nombre = nombrePorId.get(alerta.paciente_id) ?? "Paciente";
      resultado.push({
        disposicionId: disp.id,
        alertaId: disp.alerta_id,
        pacienteId: alerta.paciente_id,
        pacienteNombre: nombre,
        pacienteInicial: inicialDe(nombre),
        nivel: alerta.nivel,
        alertaMotivo: alerta.motivo,
        decision: disp.decision,
        motivoEtiqueta: disp.motivo_codigo
          ? etiquetaMotivo.get(disp.motivo_codigo) ?? null
          : null,
        diasSeguimiento: disp.dias_seguimiento,
        creadoEn: disp.creado_en,
        venceEn: fechaVencimiento({
          id: disp.id,
          diasSeguimiento: disp.dias_seguimiento,
          desenlace: disp.desenlace,
          creadoEn: disp.creado_en,
        }).toISOString(),
      });
    }
    return resultado;
  } catch {
    return [];
  }
}

/** Recuento para el badge de "Desenlaces pendientes" en la navegación. */
export async function contarDesenlacesPendientes(): Promise<number> {
  return (await cargarDesenlacesPendientes()).length;
}

// =====================================================================
// Pestaña Programa de la ficha (WP-11 v2 §A.5).
// =====================================================================

const ETIQUETA_MODULO: Record<"voz" | "texto" | "recomendaciones", string> = {
  texto: "Check-in por texto",
  voz: "Check-in por voz",
  recomendaciones: "Recomendaciones del día",
};

/**
 * Estado del programa del paciente para la pestaña "Programa": asignación actual
 * (activa o suspendida), su config efectiva en lenguaje humano, los toggles de
 * módulo y el catálogo de plantillas para asignar. Nunca lanza.
 */
export async function cargarProgramaPaciente(
  pacienteId: string,
): Promise<ProgramaPacienteVista> {
  const vacio: ProgramaPacienteVista = {
    asignacionId: null,
    programaId: null,
    programaNombre: null,
    estado: null,
    resumenConfig: [],
    modulos: [],
    plantillas: [],
  };
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return vacio;

    // Confirma acceso al paciente (RLS: profesional asignado / admin).
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("id")
      .eq("id", pacienteId)
      .maybeSingle();
    if (!paciente) return vacio;

    // Catálogo de plantillas disponibles.
    const { data: catalogo } = await supabase
      .from("programas")
      .select("id, clave, nombre, descripcion")
      .eq("activo", true)
      .order("nombre", { ascending: true });
    const plantillas = (catalogo ?? []).map((p) => ({
      id: p.id,
      clave: p.clave,
      nombre: p.nombre,
      descripcion: p.descripcion,
    }));

    // Asignación más reciente (activa o suspendida) del paciente.
    const { data: asignacion } = await supabase
      .from("programas_paciente")
      .select("id, programa_id, config_override, estado")
      .eq("paciente_id", pacienteId)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!asignacion) {
      return { ...vacio, plantillas };
    }

    const { data: programa } = await supabase
      .from("programas")
      .select("nombre, config")
      .eq("id", asignacion.programa_id)
      .maybeSingle();

    const { config } = configEfectiva(
      programa?.config ?? {},
      asignacion.config_override,
    );

    return {
      asignacionId: asignacion.id,
      programaId: asignacion.programa_id,
      programaNombre: programa?.nombre ?? null,
      estado: asignacion.estado,
      resumenConfig: describirConfig(config),
      modulos: (["texto", "voz", "recomendaciones"] as const).map((clave) => ({
        clave,
        etiqueta: ETIQUETA_MODULO[clave],
        activo: config.modulos[clave],
      })),
      plantillas,
    };
  } catch {
    return vacio;
  }
}

// =====================================================================
// Configuración del profesional (F1 mínimo).
// =====================================================================

export type ConfiguracionProfesional = {
  nombre: string;
  telefono: string | null;
};

export async function cargarConfiguracion(): Promise<ConfiguracionProfesional> {
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { nombre: "", telefono: null };
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, telefono")
      .eq("id", user.id)
      .maybeSingle();
    return {
      nombre: perfil?.nombre ?? "",
      telefono: perfil?.telefono ?? null,
    };
  } catch {
    return { nombre: "", telefono: null };
  }
}
