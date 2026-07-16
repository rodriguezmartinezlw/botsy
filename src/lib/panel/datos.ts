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
  calcularEdad,
  diasSinCheckin,
  nivelSemaforo,
  ordenarPacientes,
  type PacienteLista,
} from "./lista";
import type {
  AlertaDetalle,
  FichaPaciente,
  ItemTimeline,
  PautaVista,
  ReglaVista,
  TendenciasCompactas,
} from "./tipos";
import type { VerticalPaciente } from "@/types/db";

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

    // RLS: sólo pacientes asignados a este profesional.
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, fecha_nacimiento, vertical, ultimo_checkin");
    if (!pacientes || pacientes.length === 0) return [];

    const ids = pacientes.map((p) => p.id);

    const [
      { data: perfiles },
      { data: checkins },
      { data: tomas },
      { data: alertas },
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
    ]);

    const perfilPorId = new Map(
      (perfiles ?? []).map((p) => [p.id, p]),
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

function construirTendencias(
  hoy: string,
  obsFechadas: ObservacionFechada[],
  pautasActivas: { id: string; farmaco: string; dosis: string | null; critica: boolean }[],
  tomasFechadas: TomaFechada[],
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
        "id, fecha_nacimiento, sexo, vertical, condiciones, racha_actual, racha_maxima, ultimo_checkin",
      )
      .eq("id", pacienteId)
      .maybeSingle();
    if (!paciente) return null;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, avatar_url, telefono, zona_horaria")
      .eq("id", pacienteId)
      .maybeSingle();

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
      .select("id, farmaco, dosis, momentos, critica, activa, creado_en")
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
      });
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
    const { data: perfiles } = await supabase
      .from("perfiles")
      .select("id, nombre")
      .in("id", ids);
    const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

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
      };
    });
  } catch {
    return [];
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
