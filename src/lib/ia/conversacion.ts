/**
 * Builder compartido del motor conversacional (WP-02).
 *
 * TODA la lógica de la conversación se escribe UNA vez aquí para que WP-03
 * (voz, Realtime) la reutilice sin duplicar: contexto del paciente,
 * instrucciones (system prompt) que implementan el flujo §2.2, definición
 * NEUTRA de tools (mapeable a Chat Completions y a Realtime), y utilidades de
 * cierre (racha y resumen).
 *
 * Módulo apto para importarse desde componentes cliente: no tiene imports
 * estáticos de código de servidor. `construirContexto` carga el cliente de
 * Supabase de forma DIFERIDA (dynamic import) para no arrastrar `next/headers`
 * a bundles de cliente ni a los tests.
 */

import { differenceInCalendarDays, differenceInYears, parseISO } from "date-fns";
import type {
  EstadoToma,
  Json,
  NivelRiesgo,
  TipoCheckin,
  VerticalPaciente,
} from "@/types/db";
import type { HerramientaChat } from "./openai";
import {
  DOMINIOS_CHECKIN,
  esDominioCheckin,
  type DominioCheckin,
} from "./dominios";
import {
  aEsquemaJson,
  esquemaFinalizarCheckin,
  esquemaMarcarDominioCubierto,
  esquemaRegistrarInstrumento,
  esquemaRegistrarObservacion,
  esquemaRegistrarToma,
  esquemaSenalAlarma,
} from "./schemas";

export { DOMINIOS_CHECKIN };
export type { DominioCheckin };

// --- Fechas ------------------------------------------------------------------

/** Fecha de HOY (YYYY-MM-DD) en la zona horaria dada. */
export function fechaHoyEnZona(
  zona = "Europe/Madrid",
  ahora: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ahora);
  } catch {
    return ahora.toISOString().slice(0, 10);
  }
}

// --- Contexto ----------------------------------------------------------------

export type PautaContexto = {
  id: string;
  farmaco: string;
  dosis: string | null;
  momentos: string[];
  critica: boolean;
};

export type ObservacionReciente = {
  dominio: string;
  codigo: string;
  valorNum: number | null;
  valorTexto: string | null;
  fecha: string;
};

// --- Programa de monitorización (WP-11 v2) ----------------------------------

export type PreguntaExtraCtx = {
  clave: string;
  texto: string;
  dominio?: string;
};

export type EstiloCheckinCtx = {
  ritmo: "calmado" | "normal";
  frases_cortas: boolean;
  repeticion: boolean;
};

/**
 * Recorte del programa activo que dirige la conversación de hoy: subconjunto de
 * dominios, preguntas extra del guion, estilo y (para oncología) la guía de
 * vocabulario CTCAE. `null` cuando el paciente no tiene programa (F1 intacto).
 */
export type ProgramaContexto = {
  clave: string;
  nombre: string;
  /** Subconjunto de dominios de checklist que el programa activa. */
  dominios: DominioCheckin[];
  preguntasExtra: PreguntaExtraCtx[];
  estilo: EstiloCheckinCtx;
  /** Guía de códigos de síntomas para el prompt (oncología). */
  guiaVocabulario?: string;
};

/**
 * Estado del instrumento (Termómetro de Distrés NCCN, WP-16) para el check-in de
 * hoy. Presente solo cuando el programa lo tiene ACTIVO. `administrar` = activo y
 * TOCA hoy según la frecuencia y el último registro: solo entonces el guion lo
 * introduce y se ofrece la tool.
 */
export type InstrumentoContexto = {
  clave: "termometro_distres_nccn";
  administrar: boolean;
  frecuencia: "semanal" | "quincenal" | "ninguna";
  /** Puntuación (referencia NCCN) a partir de la cual recorrer los problemas. */
  umbralProblemas: number;
};

export type ContextoCheckin = {
  pacienteId: string;
  nombre: string;
  edad: number | null;
  vertical: VerticalPaciente;
  condiciones: string[];
  zonaHoraria: string;
  fechaHoy: string;
  pautasHoy: PautaContexto[];
  resumenUltimoCheckin: string | null;
  observacionesRecientes: ObservacionReciente[];
  dominiosCubiertos: DominioCheckin[];
  /** Programa activo que dirige el check-in (null/ausente = comportamiento F1). */
  programa?: ProgramaContexto | null;
  /** Instrumento a administrar hoy (WP-16); null/ausente = no aplica. */
  instrumento?: InstrumentoContexto | null;
  /**
   * Tipo de sesión (WP-24). 'consulta' cambia el guion (escucha a demanda, sin
   * recorrer la checklist de dominios). Ausente/`checkin` = check-in diario.
   */
  tipo?: TipoCheckin;
};

/** Extrae los dominios de checklist marcados en `checkins.dominios_cubiertos`. */
export function parsearDominiosCubiertos(valor: Json | null): DominioCheckin[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const cubiertos: DominioCheckin[] = [];
  for (const [clave, marca] of Object.entries(valor)) {
    if (marca && esDominioCheckin(clave)) cubiertos.push(clave);
  }
  return cubiertos;
}

/**
 * Lee de Supabase (como el paciente autenticado, vía RLS) todo lo necesario
 * para personalizar la conversación de hoy: identidad, pautas activas,
 * memoria longitudinal (resumen del último check-in + observaciones de los
 * últimos 7 días, RF-CV-05) y dominios ya cubiertos hoy.
 *
 * Carga diferida del cliente de servidor a propósito (ver cabecera del módulo).
 */
export async function construirContexto(
  pacienteId: string,
  tipo: TipoCheckin = "checkin",
): Promise<ContextoCheckin> {
  const { crearClienteServidor } = await import("@/lib/supabase/server");
  const supabase = await crearClienteServidor();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, zona_horaria")
    .eq("id", pacienteId)
    .maybeSingle();

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("fecha_nacimiento, vertical, condiciones")
    .eq("id", pacienteId)
    .maybeSingle();

  const zonaHoraria = perfil?.zona_horaria ?? "Europe/Madrid";
  const fechaHoy = fechaHoyEnZona(zonaHoraria);

  const edad =
    paciente?.fecha_nacimiento != null
      ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
      : null;

  const { data: pautas } = await supabase
    .from("pautas_medicacion")
    .select("id, farmaco, dosis, momentos, critica")
    .eq("paciente_id", pacienteId)
    .eq("activa", true);

  const { data: ultimo } = await supabase
    .from("checkins")
    .select("resumen")
    .eq("paciente_id", pacienteId)
    .eq("estado", "completado")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hace7dias = new Date();
  hace7dias.setDate(hace7dias.getDate() - 7);
  const { data: observaciones } = await supabase
    .from("observaciones")
    .select("dominio, codigo, valor_num, valor_texto, creado_en")
    .eq("paciente_id", pacienteId)
    .gte("creado_en", hace7dias.toISOString())
    .order("creado_en", { ascending: false })
    .limit(20);

  // Solo el check-in ESTRUCTURADO de hoy (desde WP-24 pueden convivir varias
  // filas por fecha: el check-in + N consultas; sin el filtro, maybeSingle()
  // fallaría). Las consultas no llevan checklist de dominios.
  const { data: checkinHoy } = await supabase
    .from("checkins")
    .select("dominios_cubiertos")
    .eq("paciente_id", pacienteId)
    .eq("fecha", fechaHoy)
    .eq("tipo", "checkin")
    .maybeSingle();

  // Programa de monitorización activo (WP-11 v2) + instrumento de hoy (WP-16).
  // Carga DIFERIDA del módulo de servidor para no arrastrar `server-only` a
  // bundles de cliente ni a tests. Sin programa → `null` → check-in como en F1.
  let programa: ProgramaContexto | null = null;
  let instrumento: InstrumentoContexto | null = null;
  try {
    const { obtenerContextoPrograma, obtenerContextoInstrumento } = await import(
      "@/lib/programas/servidor"
    );
    programa = await obtenerContextoPrograma(supabase, pacienteId);
    instrumento = await obtenerContextoInstrumento(
      supabase,
      pacienteId,
      fechaHoy,
    );
  } catch {
    programa = null;
    instrumento = null;
  }

  return {
    pacienteId,
    nombre: perfil?.nombre ?? "",
    edad,
    vertical: (paciente?.vertical ?? "general") as VerticalPaciente,
    condiciones: paciente?.condiciones ?? [],
    zonaHoraria,
    fechaHoy,
    pautasHoy: (pautas ?? []).map((p) => ({
      id: p.id,
      farmaco: p.farmaco,
      dosis: p.dosis,
      momentos: p.momentos,
      critica: p.critica,
    })),
    resumenUltimoCheckin: ultimo?.resumen ?? null,
    observacionesRecientes: (observaciones ?? []).map((o) => ({
      dominio: o.dominio,
      codigo: o.codigo,
      valorNum: o.valor_num,
      valorTexto: o.valor_texto,
      fecha: o.creado_en.slice(0, 10),
    })),
    dominiosCubiertos: parsearDominiosCubiertos(
      checkinHoy?.dominios_cubiertos ?? null,
    ),
    programa,
    instrumento,
    tipo,
  };
}

// --- Apertura personalizada --------------------------------------------------

function primerNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length === 0) return "";
  return limpio.split(/\s+/)[0];
}

/**
 * Saludo de apertura (§2.2, paso 1). Determinista y cálido: no requiere una
 * llamada al LLM, de modo que iniciar el check-in funciona siempre y sin coste.
 * En modo consulta (WP-24) la apertura invita a contar lo que la persona
 * necesite, sin guion de check-in.
 */
export function construirApertura(contexto: ContextoCheckin): string {
  const nombre = primerNombre(contexto.nombre);
  const saludo = nombre ? `Hola ${nombre}` : "Hola";
  if (contexto.tipo === "consulta") {
    return `${saludo}, soy Botsy. Te escucho: cuéntame qué necesitas, sin prisa.`;
  }
  return `${saludo}, soy Botsy. ¿Cómo te encuentras hoy? Cuéntame con tus palabras cómo ha ido tu día.`;
}

// --- Instrucciones (system prompt) ------------------------------------------

function lineaPautas(pautas: PautaContexto[]): string {
  if (pautas.length === 0) return "  (no hay pautas activas registradas)";
  return pautas
    .map((p) => {
      const dosis = p.dosis ? ` ${p.dosis}` : "";
      const momentos =
        p.momentos.length > 0 ? p.momentos.join(", ") : "sin momento fijado";
      const critica = p.critica ? " — CRÍTICO" : "";
      return `  - ${p.farmaco}${dosis} (pauta_id: ${p.id}); momentos: ${momentos}${critica}`;
    })
    .join("\n");
}

function lineaObservaciones(observaciones: ObservacionReciente[]): string {
  if (observaciones.length === 0) return "  (sin observaciones recientes)";
  return observaciones
    .slice(0, 8)
    .map((o) => {
      const valor =
        o.valorNum != null
          ? String(o.valorNum)
          : o.valorTexto
            ? o.valorTexto
            : "—";
      return `  - [${o.fecha}] ${o.dominio}/${o.codigo}: ${valor}`;
    })
    .join("\n");
}

function lineaDominios(
  cubiertos: DominioCheckin[],
  activos: DominioCheckin[] | null,
): {
  pendientes: string;
  hechos: string;
} {
  const setCubiertos = new Set(cubiertos);
  // Si el programa acota los dominios, solo se recorren esos (WP-11 §A.4); si
  // no hay programa, la checklist completa de F1.
  const setActivos = activos ? new Set(activos) : null;
  const base = setActivos
    ? DOMINIOS_CHECKIN.filter((d) => setActivos.has(d.id))
    : DOMINIOS_CHECKIN;
  const pendientes = base.filter((d) => !setCubiertos.has(d.id));
  const hechos = base.filter((d) => setCubiertos.has(d.id));
  return {
    pendientes:
      pendientes.length > 0
        ? pendientes.map((d) => `  - ${d.id}: ${d.descripcion}`).join("\n")
        : "  (todos cubiertos)",
    hechos:
      hechos.length > 0
        ? hechos.map((d) => `  - ${d.id}`).join("\n")
        : "  (ninguno todavía)",
  };
}

/** Sección `# PROGRAMA` del system prompt (WP-11 v2 §A.4). Vacía si no hay programa. */
function seccionPrograma(
  programa: ProgramaContexto | null | undefined,
): string {
  if (!programa) return "";

  const partesEstilo: string[] = [];
  if (programa.estilo.ritmo === "calmado") {
    partesEstilo.push("ritmo pausado, dando tiempo a responder");
  }
  if (programa.estilo.frases_cortas) {
    partesEstilo.push("frases muy cortas");
  }
  if (programa.estilo.repeticion) {
    partesEstilo.push("puedes repetir o reformular si algo no queda claro");
  }
  const estilo =
    partesEstilo.length > 0
      ? `- Estilo de conversación: ${partesEstilo.join("; ")}.`
      : "";

  const preguntas =
    programa.preguntasExtra.length > 0
      ? [
          "- Además de los dominios, cubre con naturalidad estas preguntas del programa (una por turno, sin agobiar):",
          ...programa.preguntasExtra.map((p) => `    · ${p.texto}`),
        ].join("\n")
      : "";

  const vocab = programa.guiaVocabulario ? `\n${programa.guiaVocabulario}` : "";

  return `
# PROGRAMA de seguimiento: ${programa.nombre}
Esta persona sigue un programa concreto. Ajusta el check-in a él SIN cambiar las reglas clínicas.
${estilo}
${preguntas}${vocab}
`;
}

/**
 * Sección `# TERMÓMETRO DE DISTRÉS` del system prompt (WP-16). Vacía salvo cuando
 * TOCA administrar hoy. Botsy ADMINISTRA y REGISTRA el instrumento; NO interpreta
 * el resultado ante la persona ni diagnostica (reglas de oro 1 y 4 de CLAUDE.md).
 */
function seccionInstrumento(
  instrumento: InstrumentoContexto | null | undefined,
): string {
  if (!instrumento || !instrumento.administrar) return "";
  return `
# TERMÓMETRO DE DISTRÉS (una vez, con naturalidad)
Hoy toca el termómetro de malestar. Introdúcelo con calidez, en un solo turno:
- Pregunta: "De 0 a 10, ¿cuánto malestar o angustia has sentido esta última semana? (0 es nada y 10 es el máximo)".
- Registra SIEMPRE la respuesta con registrar_instrumento (instrumento "termometro_distres_nccn", puntuacion 0–10).
- SOLO si la puntuación es ${instrumento.umbralProblemas} o más, pregunta con delicadeza por las áreas que le están preocupando y marca las que confirme, en 'problemas' (categorías: prácticos, familiares, emocionales, físicos, espirituales). Si la puntuación es baja, NO recorras la lista (no alargues el check-in).
- NO interpretes ni pongas nombre al resultado ante la persona ("esto indica...", "tienes distrés" están PROHIBIDOS). No es un diagnóstico. Agradece con calma y sigue.
`;
}

/** Bloque de reglas clínicas innegociables, compartido por ambos guiones. */
const REGLAS_CLINICAS = `# Reglas clínicas INNEGOCIABLES
- NO diagnosticas. No pones nombre a enfermedades ni interpretas causas ante la persona.
- NO recomiendas fármacos ni dosis, ni cambias la pauta del médico. Nada de lo que digas puede contradecir a su profesional.
- NO minimizas los síntomas de alarma ("no será nada" está prohibido). Ante una señal, mantén la calma y sugiere contactar con su médico.
- Distingue siempre "señal detectada" de "diagnóstico".
- Si te preguntan algo médico que excede el registro (dudas de medicación, si algo es grave, ajustes de tratamiento), responde con amabilidad: "eso es mejor que lo consultes con tu médico". (RF-CV-08)
- Recuerda a la persona, si viene a cuento, que hablas como asistente y que no sustituyes a su médico.`;

/**
 * Guion del MODO CONSULTA (WP-24): la persona ha abierto una conversación a
 * demanda (un síntoma nuevo, una duda, un malestar) fuera del check-in diario.
 * Escucha, registra con las mismas herramientas y evalúa señales de alarma,
 * pero NO recorre la checklist de dominios ni administra instrumentos. Cierre
 * natural cuando la persona termine. Función pura (testeable sin red ni BD).
 */
function construirInstruccionesConsulta(contexto: ContextoCheckin): string {
  const edad = contexto.edad != null ? `${contexto.edad} años` : "edad no registrada";
  const condiciones =
    contexto.condiciones.length > 0
      ? contexto.condiciones.join(", ")
      : "sin condiciones registradas";

  return `Eres Botsy, un asistente de salud. Esto NO es el check-in diario: la persona ha abierto una CONVERSACIÓN porque quiere contarte algo AHORA (un síntoma nuevo, una duda, un malestar). Hablas en español de España (es-ES), con tono cálido, cercano y sencillo. La persona puede ser mayor: usa frases CORTAS, vocabulario claro, y haz UNA sola pregunta por turno. Nunca escribas párrafos largos.

# Quién es la persona
- Nombre: ${contexto.nombre || "(desconocido)"}
- ${edad}. Vertical clínica: ${contexto.vertical}. Condiciones: ${condiciones}.

# Pautas de medicación de hoy (por si menciona su medicación)
${lineaPautas(contexto.pautasHoy)}

# Memoria de días anteriores (úsala con naturalidad; no la recites entera)
- Resumen de la última conversación: ${contexto.resumenUltimoCheckin ?? "(no hay)"}
- Observaciones recientes (últimos 7 días):
${lineaObservaciones(contexto.observacionesRecientes)}

# Objetivo de la conversación (modo consulta, a demanda)
La persona quiere contarte algo AHORA. Escúchala:
1. Deja que cuente lo que necesita, con preguntas abiertas y sin prisa. Repregunta con delicadeza solo para aclarar lo clínicamente relevante.
2. REGISTRA cada dato clínico que aparezca con las herramientas (registrar_observacion, registrar_toma).
3. Evalúa si hay señales de alarma y usa senal_alarma exactamente igual que en un check-in: una fiebre o un síntoma grave contados aquí importan igual.
4. NO recorras la checklist de dominios del check-in diario. No conviertas la conversación en un interrogatorio: ella marca el tema.
5. Cierra cuando la persona termine: agradece con calma y usa finalizar_checkin con un resumen breve de lo hablado.

# Uso de las herramientas (obligatorio para registrar datos)
- registrar_observacion: por cada dato clínico (dolor con intensidad 0-10, síntoma, ánimo, sueño...). Usa un 'codigo' corto en snake_case ascii (p. ej. dolor_cabeza, disnea, animo_bajo) y una 'confianza' entre 0 y 1.
- registrar_toma: por cada confirmación de medicación, con el pauta_id de la lista de arriba, el 'momento' (mañana | mediodía | noche) y el 'estado' (tomada | omitida | desconocido).
- senal_alarma: SOLO si detectas una posible señal de aviso (síntoma de alarma, combinación peligrosa, no-adherencia crítica, ideas de hacerse daño). No la uses para molestias leves.
- finalizar_checkin: para cerrar la conversación, con un 'resumen' cálido de 1-3 frases.
No inventes datos: registra únicamente lo que la persona dice. Si no estás seguro, repregunta.

${REGLAS_CLINICAS}`;
}

/**
 * System prompt en español que implementa el flujo §2.2 y las reglas clínicas
 * innegociables de CLAUDE.md. Función pura (testeable sin red ni BD).
 * Con `contexto.tipo === 'consulta'` (WP-24) devuelve el guion de consulta a
 * demanda (sin checklist de dominios ni instrumento).
 */
export function construirInstrucciones(contexto: ContextoCheckin): string {
  if (contexto.tipo === "consulta") {
    return construirInstruccionesConsulta(contexto);
  }
  const dominiosActivos = contexto.programa?.dominios ?? null;
  const { pendientes, hechos } = lineaDominios(
    contexto.dominiosCubiertos,
    dominiosActivos,
  );
  const edad = contexto.edad != null ? `${contexto.edad} años` : "edad no registrada";
  const condiciones =
    contexto.condiciones.length > 0
      ? contexto.condiciones.join(", ")
      : "sin condiciones registradas";
  const bloquePrograma = seccionPrograma(contexto.programa);
  const bloqueInstrumento = seccionInstrumento(contexto.instrumento);

  return `Eres Botsy, un asistente de salud que acompaña a la persona en su check-in DIARIO. Hablas en español de España (es-ES), con tono cálido, cercano y sencillo. La persona puede ser mayor: usa frases CORTAS, vocabulario claro, y haz UNA sola pregunta por turno. Nunca escribas párrafos largos.

# Quién es la persona
- Nombre: ${contexto.nombre || "(desconocido)"}
- ${edad}. Vertical clínica: ${contexto.vertical}. Condiciones: ${condiciones}.
${bloquePrograma}

# Pautas de medicación de hoy (para registrar adherencia)
${lineaPautas(contexto.pautasHoy)}

# Memoria de días anteriores (úsala con naturalidad; no la recites entera)
- Resumen del último check-in: ${contexto.resumenUltimoCheckin ?? "(no hay)"}
- Observaciones recientes (últimos 7 días):
${lineaObservaciones(contexto.observacionesRecientes)}

# Objetivo de la conversación
Completar la ficha diaria recorriendo los dominios PENDIENTES. Termina cuando todos estén cubiertos o cuando la persona quiera parar.

## Dominios PENDIENTES (pregunta solo por estos)
${pendientes}

## Dominios YA cubiertos hoy (NO vuelvas a preguntar por ellos)
${hechos}
${bloqueInstrumento}
# Cómo conducir la conversación (flujo)
1. Escucha abierta: si la persona ya cuenta algo espontáneamente (dolor, ánimo, si tomó su medicación...), EXTRÁELO con las herramientas y NO vuelvas a preguntarlo.
2. Recorre solo los dominios pendientes, de uno en uno, con preguntas naturales.
3. Si una respuesta es ambigua o clínicamente relevante, repregunta con delicadeza para aclarar (p. ej. "¿ese dolor es distinto al de otros días?").
4. Cuando cubras un dominio, márcalo con marcar_dominio_cubierto.
5. Al terminar, agradece y cierra con finalizar_checkin, incluyendo un resumen breve de lo hablado.

# Uso de las herramientas (obligatorio para registrar datos)
- registrar_observacion: por cada dato clínico (dolor con intensidad 0-10, síntoma, ánimo, sueño...). Usa un 'codigo' corto en snake_case ascii (p. ej. dolor_cabeza, disnea, animo_bajo) y una 'confianza' entre 0 y 1.
- registrar_toma: por cada confirmación de medicación, con el pauta_id de la lista de arriba, el 'momento' (mañana | mediodía | noche) y el 'estado' (tomada | omitida | desconocido).
- marcar_dominio_cubierto: cuando un dominio de la checklist quede cubierto.
- senal_alarma: SOLO si detectas una posible señal de aviso (síntoma de alarma, combinación peligrosa, no-adherencia crítica, ideas de hacerse daño). No la uses para molestias leves.
- finalizar_checkin: para cerrar, con un 'resumen' cálido de 1-3 frases.
No inventes datos: registra únicamente lo que la persona dice. Si no estás seguro, repregunta.

${REGLAS_CLINICAS}`;
}

// --- Definición NEUTRA de tools ---------------------------------------------

export type DefinicionToolNeutra = {
  nombre: string;
  descripcion: string;
  /** JSON Schema de los argumentos (derivado del esquema Zod). */
  parametros: Record<string, unknown>;
};

export const TOOLS_CHECKIN: readonly DefinicionToolNeutra[] = [
  {
    nombre: "registrar_observacion",
    descripcion:
      "Registra un dato clínico observado en la conversación (dolor, síntoma, ánimo, sueño, cognición, hábitos, tratamiento...).",
    parametros: aEsquemaJson(esquemaRegistrarObservacion),
  },
  {
    nombre: "registrar_toma",
    descripcion:
      "Registra la toma (o no) de una medicación pautada, por pauta y momento del día.",
    parametros: aEsquemaJson(esquemaRegistrarToma),
  },
  {
    nombre: "marcar_dominio_cubierto",
    descripcion:
      "Marca un dominio de la checklist como cubierto para no volver a preguntarlo hoy.",
    parametros: aEsquemaJson(esquemaMarcarDominioCubierto),
  },
  {
    nombre: "senal_alarma",
    descripcion:
      "Señala una posible situación de riesgo detectada (síntoma de alarma, combinación peligrosa, no-adherencia crítica o ideas de hacerse daño). Actívala con prudencia.",
    parametros: aEsquemaJson(esquemaSenalAlarma),
  },
  {
    nombre: "finalizar_checkin",
    descripcion:
      "Cierra el check-in del día con un resumen breve y cálido de lo hablado.",
    parametros: aEsquemaJson(esquemaFinalizarCheckin),
  },
] as const;

/**
 * Tool del Termómetro de Distrés NCCN (WP-16). Se ofrece SOLO cuando el
 * instrumento se administra hoy (ver `construirToolsCheckin`).
 */
export const TOOL_REGISTRAR_INSTRUMENTO: DefinicionToolNeutra = {
  nombre: "registrar_instrumento",
  descripcion:
    "Registra la respuesta del termómetro de distrés (puntuación 0–10 y, solo si es alta, la lista de problemas marcados). Úsala una vez cuando toque el termómetro.",
  parametros: aEsquemaJson(esquemaRegistrarInstrumento),
};

/**
 * Lista de tools del check-in. Base compartida (F1) + la tool del instrumento
 * SOLO cuando toca administrarlo hoy (gating WP-16: si no se ofrece, el modelo
 * no puede llamarla). El loop añade además la defensa en profundidad en
 * `ejecutarHerramienta`.
 */
export function construirToolsCheckin(opciones?: {
  instrumento?: boolean;
}): DefinicionToolNeutra[] {
  const base: DefinicionToolNeutra[] = [...TOOLS_CHECKIN];
  if (opciones?.instrumento === true) base.push(TOOL_REGISTRAR_INSTRUMENTO);
  return base;
}

export const NOMBRES_TOOLS = TOOLS_CHECKIN.map((t) => t.nombre);

/** Mapea las tools neutras al formato de function calling de Chat Completions. */
export function toolsParaChat(
  tools: readonly DefinicionToolNeutra[] = TOOLS_CHECKIN,
): HerramientaChat[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.nombre,
      description: t.descripcion,
      parameters: t.parametros,
    },
  }));
}

/** Mapea las tools neutras al formato de sesión de OpenAI Realtime (WP-03). */
export function toolsParaRealtime(
  tools: readonly DefinicionToolNeutra[] = TOOLS_CHECKIN,
): {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}[] {
  return tools.map((t) => ({
    type: "function",
    name: t.nombre,
    description: t.descripcion,
    parameters: t.parametros,
  }));
}

// --- Cierre: racha y resumen ------------------------------------------------

export type EstadoRacha = {
  racha_actual: number;
  racha_maxima: number;
  ultimo_checkin: string | null;
};

/**
 * Calcula la nueva racha con lógica de días consecutivos.
 * - Mismo día que el último check-in: no cambia (idempotente).
 * - Día inmediatamente siguiente: +1.
 * - Hueco de 2+ días (o primer check-in): se reinicia a 1.
 * Función pura y testeable.
 */
export function calcularRacha(
  previo: EstadoRacha,
  fechaHoy: string,
): { racha_actual: number; racha_maxima: number; ultimo_checkin: string } {
  const anterior = previo.ultimo_checkin;
  let rachaActual: number;

  if (anterior === null) {
    rachaActual = 1;
  } else {
    const dias = differenceInCalendarDays(parseISO(fechaHoy), parseISO(anterior));
    if (dias === 0) {
      rachaActual = previo.racha_actual > 0 ? previo.racha_actual : 1;
    } else if (dias === 1) {
      rachaActual = previo.racha_actual + 1;
    } else {
      // Hueco (o fecha anterior en el futuro por reloj/zona): se reinicia.
      rachaActual = 1;
    }
  }

  return {
    racha_actual: rachaActual,
    racha_maxima: Math.max(previo.racha_maxima, rachaActual),
    ultimo_checkin: fechaHoy,
  };
}

export type DatosResumen = {
  nombre: string;
  dominiosCubiertos: DominioCheckin[];
  observaciones: {
    dominio: string;
    codigo: string;
    valorNum: number | null;
    valorTexto: string | null;
  }[];
  tomas: { estado: EstadoToma }[];
  rachaActual: number;
  riesgo: NivelRiesgo | null;
  /** 'consulta' (WP-24) omite la racha y el cierre "mañana seguimos". */
  tipo?: TipoCheckin;
};

/**
 * Resumen de cierre determinista (§2.2, paso 6): refuerzo positivo + racha.
 * No diagnostica; solo refleja lo registrado con lenguaje cálido y calmado.
 */
export function construirResumen(datos: DatosResumen): string {
  const nombre = primerNombre(datos.nombre);
  const partes: string[] = [];

  partes.push(nombre ? `Gracias por tu tiempo, ${nombre}.` : "Gracias por tu tiempo.");

  const etiquetas = new Map(DOMINIOS_CHECKIN.map((d) => [d.id, d.etiqueta]));
  const cubiertos = datos.dominiosCubiertos
    .map((d) => etiquetas.get(d))
    .filter((e): e is NonNullable<typeof e> => e != null);
  if (cubiertos.length > 0) {
    partes.push(`Hoy hemos repasado: ${cubiertos.join(", ").toLowerCase()}.`);
  }

  const dolor = datos.observaciones.find(
    (o) => o.dominio === "dolor" && o.valorNum != null,
  );
  if (dolor && dolor.valorNum != null) {
    partes.push(`Anoté tu dolor en ${dolor.valorNum} sobre 10.`);
  }

  const tomadas = datos.tomas.filter((t) => t.estado === "tomada").length;
  if (tomadas > 0) {
    partes.push(
      tomadas === 1
        ? "Registré 1 toma de tu medicación."
        : `Registré ${tomadas} tomas de tu medicación.`,
    );
  }

  if (datos.tipo === "consulta") {
    // La consulta no alimenta la racha (WP-24): cierre cálido sin contador.
    partes.push("Gracias por contármelo. Aquí me tienes cuando me necesites.");
  } else if (datos.rachaActual > 1) {
    partes.push(`Llevas ${datos.rachaActual} días seguidos cuidándote. ¡Muy bien!`);
  } else {
    partes.push("Buen comienzo. Mañana seguimos.");
  }

  if (datos.riesgo === "contactar" || datos.riesgo === "urgencia") {
    partes.push(
      "He detectado una señal que conviene comentar: te recomiendo contactar hoy con tu médico. No es un diagnóstico.",
    );
  }

  return partes.join(" ");
}
