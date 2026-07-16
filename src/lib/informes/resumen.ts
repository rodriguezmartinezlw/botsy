/**
 * Resumen ejecutivo del informe por LLM (WP-07) — módulo (casi) PURO.
 *
 * Regla clínica innegociable (CLAUDE.md): el resumen NO inventa ni diagnostica y
 * SÓLO usa cifras que existen en los datos. Aquí eso se garantiza en dos capas:
 *
 *   1. El PROMPT sólo recibe una lista de HECHOS ya calculados (cifras reales);
 *      no se le pasa nada más de lo que pueda "sacar" un número nuevo.
 *   2. Un VALIDADOR determinista revisa el texto devuelto: si contiene alguna
 *      cifra que no esté en el conjunto permitido (las de los hechos), el
 *      resumen se DESCARTA y el informe sale sin resumen. Es defensa en
 *      profundidad: aunque el modelo alucine un número, nunca llega al informe.
 *
 * El cliente OpenAI se INYECTA (interfaz `ClienteOpenAI` de WP-02), de modo que
 * los tests corren sin red y sin `OPENAI_API_KEY`.
 */

import { z } from "zod";
import type { ClienteOpenAI } from "@/lib/ia/openai";
import type { DatosInforme } from "./tipos";

const ETIQUETA_VERTICAL: Record<string, string> = {
  cardiovascular: "cardiovascular",
  cronica: "crónica",
  geriatrica: "geriátrica",
  mental: "salud mental",
  ocupacional: "ocupacional",
  general: "general",
};

/** Un hecho: una frase con las cifras (números) que contiene, ya reales. */
export type Hecho = { texto: string; numeros: number[] };

// --- Construcción de hechos (sólo cifras existentes) -------------------------

/**
 * Traduce los datos agregados a una lista de hechos con cifras reales. Es lo
 * ÚNICO que se le da al modelo. Cada número que aparece aquí sale de los datos.
 */
export function construirHechos(datos: DatosInforme): Hecho[] {
  const hechos: Hecho[] = [];

  hechos.push({
    texto: `El período abarca ${datos.periodo.dias} días.`,
    numeros: [datos.periodo.dias],
  });
  hechos.push({
    texto: `Se registraron ${datos.totalCheckins} check-ins en el período.`,
    numeros: [datos.totalCheckins],
  });

  // Dolor
  if (datos.dolor.registros > 0 && datos.dolor.media !== null) {
    const nums = [datos.dolor.media, datos.dolor.registros];
    let t = `Dolor: media de ${datos.dolor.media} sobre 10 en ${datos.dolor.registros} días con registro`;
    nums.push(10);
    if (datos.dolor.pico !== null && datos.dolor.minimo !== null) {
      t += `, con un máximo de ${datos.dolor.pico} y un mínimo de ${datos.dolor.minimo}`;
      nums.push(datos.dolor.pico, datos.dolor.minimo);
    }
    hechos.push({ texto: `${t}.`, numeros: nums });
  } else {
    hechos.push({ texto: "Dolor: sin registros en el período.", numeros: [] });
  }

  // Ánimo / ansiedad / estrés
  for (const [clave, etiqueta] of [
    ["animo", "ánimo"],
    ["ansiedad", "ansiedad"],
    ["estres", "estrés"],
  ] as const) {
    const m = datos.animo[clave];
    if (m.registros > 0 && m.media !== null) {
      hechos.push({
        texto: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)}: media de ${m.media} sobre 10 en ${m.registros} días.`,
        numeros: [m.media, 10, m.registros],
      });
    }
  }

  // Adherencia global
  const g = datos.adherencia.global;
  if (g.porcentaje !== null) {
    hechos.push({
      texto: `Adherencia global: ${g.porcentaje}% (${g.tomadas} tomas registradas y ${g.omitidas} omitidas).`,
      numeros: [g.porcentaje, g.tomadas, g.omitidas],
    });
  }
  // Adherencia por fármaco
  for (const f of datos.adherencia.farmacos) {
    if (f.porcentaje !== null) {
      hechos.push({
        texto: `Adherencia de ${f.farmaco}: ${f.porcentaje}% (${f.tomadas} tomadas, ${f.omitidas} omitidas).`,
        numeros: [f.porcentaje, f.tomadas, f.omitidas],
      });
    }
  }

  // Alertas por nivel
  const porNivel = { vigilancia: 0, contactar: 0, urgencia: 0 };
  for (const a of datos.alertas) porNivel[a.nivel] += 1;
  const totalAlertas = datos.alertas.length;
  hechos.push({
    texto: `Alertas en el período: ${totalAlertas} en total (${porNivel.urgencia} de urgencia, ${porNivel.contactar} de contactar, ${porNivel.vigilancia} de vigilancia).`,
    numeros: [
      totalAlertas,
      porNivel.urgencia,
      porNivel.contactar,
      porNivel.vigilancia,
    ],
  });

  return hechos;
}

// --- Cifras permitidas y validación ------------------------------------------

/** Canonicaliza un número a cadena ("86", "3.29") para comparar sin ruido. */
function canonico(n: number): string {
  return String(n);
}

/**
 * Conjunto de cifras (como cadenas canónicas) que el resumen PUEDE contener:
 * las de los hechos, más los componentes numéricos de las fechas del período
 * (por si el modelo las menciona pese a que le pedimos que no).
 */
export function cifrasPermitidas(datos: DatosInforme, hechos: Hecho[]): Set<string> {
  const set = new Set<string>();
  for (const h of hechos) for (const n of h.numeros) set.add(canonico(n));
  for (const fecha of [datos.periodo.desde, datos.periodo.hasta]) {
    for (const parte of fecha.split("-")) {
      const n = Number(parte);
      if (!Number.isNaN(n)) {
        set.add(canonico(n)); // sin ceros a la izquierda (mes "06" -> "6")
        set.add(parte); // y con ellos ("06")
      }
    }
  }
  if (datos.paciente.edad !== null) set.add(canonico(datos.paciente.edad));
  return set;
}

/** Extrae todas las cifras (enteros o decimales) de un texto, canonicalizadas. */
export function extraerCifras(texto: string): string[] {
  const encontrados = texto.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return encontrados.map((s) => {
    const n = Number(s.replace(",", "."));
    return Number.isNaN(n) ? s : canonico(n);
  });
}

export type ResultadoValidacion =
  | { ok: true }
  | { ok: false; intrusas: string[] };

/**
 * Comprueba que el resumen no contenga ninguna cifra ajena a `permitidas`.
 * Devuelve las intrusas encontradas (para registro), nunca lanza.
 */
export function validarResumenSinCifrasInventadas(
  resumen: string,
  permitidas: Set<string>,
): ResultadoValidacion {
  const intrusas = extraerCifras(resumen).filter((c) => !permitidas.has(c));
  return intrusas.length === 0 ? { ok: true } : { ok: false, intrusas };
}

// --- Prompt ------------------------------------------------------------------

export function construirPromptResumen(
  datos: DatosInforme,
  hechos: Hecho[],
): { system: string; user: string } {
  const vertical = ETIQUETA_VERTICAL[datos.paciente.vertical] ?? "general";
  const system = [
    "Eres un asistente que redacta el RESUMEN EJECUTIVO de un informe de seguimiento para un profesional sanitario, en español de España.",
    "Reglas estrictas e innegociables:",
    "1. NO diagnostiques ni sugieras diagnósticos: describe únicamente lo observado.",
    "2. NO inventes ni infieras datos. Usa EXCLUSIVAMENTE los hechos que se te dan.",
    "3. NO introduzcas ninguna cifra que no esté en los hechos. Cada número que escribas debe aparecer literalmente en la lista de hechos.",
    "4. No menciones fechas concretas ni el nombre del paciente (ya figuran en el encabezado del informe).",
    "5. Tono neutro y profesional. Entre 3 y 6 frases, en un solo párrafo. Sin listas ni encabezados.",
    "6. Si un dato no consta, dilo con naturalidad; no lo estimes.",
  ].join("\n");

  const user = [
    `Perfil: paciente de seguimiento en vertical ${vertical}.`,
    "Hechos disponibles (todas las cifras que puedes usar están aquí):",
    ...hechos.map((h) => `- ${h.texto}`),
    "",
    "Redacta el resumen ejecutivo respetando las reglas.",
  ].join("\n");

  return { system, user };
}

// --- Generación (con cliente inyectable) -------------------------------------

const esquemaTextoLLM = z.string().trim().min(1);

export type ResultadoResumen =
  | { estado: "ok"; resumen: string }
  | { estado: "sin_resumen"; motivo: MotivoSinResumen };

export type MotivoSinResumen =
  | "sin_datos"
  | "respuesta_vacia"
  | "cifras_invalidas"
  | "error_proveedor";

/**
 * Genera el resumen ejecutivo. Nunca lanza: ante cualquier problema (sin datos,
 * respuesta vacía, cifras inventadas o fallo del proveedor) devuelve
 * `sin_resumen` con el motivo, y el informe se renderiza sin resumen (con aviso).
 */
export async function generarResumenEjecutivo(
  cliente: ClienteOpenAI,
  datos: DatosInforme,
  modelo: string,
): Promise<ResultadoResumen> {
  if (datos.totalCheckins === 0) {
    return { estado: "sin_resumen", motivo: "sin_datos" };
  }

  const hechos = construirHechos(datos);
  const { system, user } = construirPromptResumen(datos, hechos);

  let salida;
  try {
    salida = await cliente.crearRespuesta({
      modelo,
      mensajes: [
        { rol: "system", contenido: system },
        { rol: "user", contenido: user },
      ],
      temperatura: 0.2,
    });
  } catch {
    return { estado: "sin_resumen", motivo: "error_proveedor" };
  }

  const analizado = esquemaTextoLLM.safeParse(salida.contenido ?? "");
  if (!analizado.success) {
    return { estado: "sin_resumen", motivo: "respuesta_vacia" };
  }
  const texto = analizado.data;

  const permitidas = cifrasPermitidas(datos, hechos);
  const validacion = validarResumenSinCifrasInventadas(texto, permitidas);
  if (!validacion.ok) {
    // Defensa en profundidad: el modelo introdujo una cifra que no existe en
    // los datos. Se descarta el resumen (no se muestra ni se persiste).
    console.warn(
      "Resumen ejecutivo descartado: cifras no presentes en los datos:",
      validacion.intrusas.join(", "),
    );
    return { estado: "sin_resumen", motivo: "cifras_invalidas" };
  }

  return { estado: "ok", resumen: texto };
}
