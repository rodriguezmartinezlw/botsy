/**
 * Reconciliación: segunda pasada estructurada sobre el transcript completo del
 * check-in, tras el cierre. Extrae observaciones que el flujo en vivo pudo no
 * registrar y las inserta con `origen='reconciliacion'`, SIN duplicar códigos
 * ya presentes (mismo dominio + código).
 *
 * `reconciliarNucleo` es puro respecto a Supabase (solo usa el cliente OpenAI
 * inyectable) y por tanto testeable con un mock. `reconciliar(checkinId)` es el
 * envoltorio que lee el transcript y las observaciones existentes de Supabase,
 * llama al núcleo y persiste el resultado.
 */

import type { ClienteOpenAI, HerramientaChat } from "./openai";
import { modeloTexto } from "./openai";
import {
  aEsquemaJson,
  esquemaLoteExtraccion,
  type ObservacionExtraida,
} from "./schemas";

const PROMPT_EXTRACCION = `Eres un extractor clínico. Recibes el transcript de un check-in de salud entre "Botsy" (asistente) y "Paciente". Tu tarea: devolver, mediante la herramienta registrar_lote_observaciones, las observaciones clínicas ESTRUCTURADAS presentes en la conversación (dolor con intensidad 0-10, síntomas, ánimo, ansiedad, estrés, sueño, cognición, adherencia, tratamiento, hábitos).

Reglas:
- Usa códigos cortos en snake_case ascii (p. ej. dolor_cabeza, disnea, animo_bajo, sueno_malo).
- No inventes: extrae solo lo que la persona dice. Si no hay datos claros, devuelve una lista vacía.
- No diagnostiques ni interpretes causas; solo registra lo observado con su confianza (0 a 1).`;

function herramientaExtraccion(): HerramientaChat {
  return {
    type: "function",
    function: {
      name: "registrar_lote_observaciones",
      description:
        "Devuelve la lista de observaciones clínicas estructuradas extraídas del transcript.",
      parameters: aEsquemaJson(esquemaLoteExtraccion),
    },
  };
}

/** Clave de deduplicado: dominio + código. */
function clave(o: { dominio: string; codigo: string }): string {
  return `${o.dominio}:${o.codigo}`;
}

export type EntradaReconciliacion = {
  cliente: ClienteOpenAI;
  modelo: string;
  transcript: string;
  /** Claves `dominio:codigo` ya presentes en el check-in (no se re-insertan). */
  codigosExistentes: ReadonlySet<string>;
};

/**
 * Núcleo puro: pide al modelo el lote de observaciones, valida con Zod y
 * devuelve solo las nuevas (deduplicadas contra las existentes y entre sí).
 * No lanza: ante cualquier fallo del proveedor devuelve lista vacía.
 */
export async function reconciliarNucleo(
  entrada: EntradaReconciliacion,
): Promise<ObservacionExtraida[]> {
  let salida;
  try {
    salida = await entrada.cliente.crearRespuesta({
      modelo: entrada.modelo,
      mensajes: [
        { rol: "system", contenido: PROMPT_EXTRACCION },
        { rol: "user", contenido: entrada.transcript },
      ],
      herramientas: [herramientaExtraccion()],
      forzarHerramienta: "registrar_lote_observaciones",
    });
  } catch {
    return [];
  }

  const llamada = salida.llamadas.find(
    (l) => l.nombre === "registrar_lote_observaciones",
  );
  if (!llamada) return [];

  let args: unknown;
  try {
    args = JSON.parse(llamada.argumentosJson) as unknown;
  } catch {
    return [];
  }

  const analizado = esquemaLoteExtraccion.safeParse(args);
  if (!analizado.success) return [];

  const vistos = new Set<string>(entrada.codigosExistentes);
  const nuevas: ObservacionExtraida[] = [];
  for (const obs of analizado.data.observaciones) {
    const k = clave(obs);
    if (vistos.has(k)) continue;
    vistos.add(k);
    nuevas.push(obs);
  }
  return nuevas;
}

export type ResultadoReconciliacion = {
  insertadas: number;
  error?: string;
};

/**
 * Envoltorio de servidor: lee transcript y observaciones existentes del
 * check-in, ejecuta la reconciliación e inserta las nuevas con
 * `origen='reconciliacion'`. Best-effort: nunca lanza (no debe tumbar el
 * cierre del check-in); ante fallos devuelve `insertadas: 0` con el motivo.
 */
export async function reconciliar(
  checkinId: string,
  opciones?: { cliente?: ClienteOpenAI },
): Promise<ResultadoReconciliacion> {
  try {
    const { crearClienteServidor } = await import("@/lib/supabase/server");
    const supabase = await crearClienteServidor();

    const { data: checkin } = await supabase
      .from("checkins")
      .select("paciente_id")
      .eq("id", checkinId)
      .maybeSingle();
    if (!checkin) return { insertadas: 0, error: "Check-in no encontrado." };

    const { data: mensajes } = await supabase
      .from("mensajes")
      .select("rol, contenido, orden")
      .eq("checkin_id", checkinId)
      .order("orden", { ascending: true });
    if (!mensajes || mensajes.length === 0) return { insertadas: 0 };

    const transcript = mensajes
      .map((m) => `${m.rol === "paciente" ? "Paciente" : "Botsy"}: ${m.contenido}`)
      .join("\n");

    const { data: existentes } = await supabase
      .from("observaciones")
      .select("dominio, codigo")
      .eq("checkin_id", checkinId);
    const codigosExistentes = new Set(
      (existentes ?? []).map((o) => clave(o)),
    );

    const cliente = opciones?.cliente ?? (await crearClienteReal());
    const nuevas = await reconciliarNucleo({
      cliente,
      modelo: modeloTexto(),
      transcript,
      codigosExistentes,
    });
    if (nuevas.length === 0) return { insertadas: 0 };

    const filas = nuevas.map((o) => ({
      checkin_id: checkinId,
      paciente_id: checkin.paciente_id,
      dominio: o.dominio,
      codigo: o.codigo,
      valor_num: o.valor_num ?? null,
      valor_texto: o.valor_texto ?? null,
      confianza: o.confianza,
      origen: "reconciliacion" as const,
    }));
    const { error } = await supabase.from("observaciones").insert(filas);
    if (error) return { insertadas: 0, error: "No se pudieron insertar." };

    return { insertadas: filas.length };
  } catch {
    return { insertadas: 0, error: "Reconciliación no disponible." };
  }
}

async function crearClienteReal(): Promise<ClienteOpenAI> {
  const { crearClienteOpenAI } = await import("./openai");
  return crearClienteOpenAI();
}
