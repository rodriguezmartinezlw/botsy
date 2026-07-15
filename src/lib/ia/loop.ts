/**
 * Loop de tool-calls del check-in por texto.
 *
 * `ejecutarTurno` toma un mensaje del paciente (ya añadido al historial),
 * llama al modelo con las instrucciones + historial + tools, y ejecuta el
 * ciclo: mientras el modelo pida tools, VALIDA sus argumentos con Zod y, si
 * son válidos, los PERSISTE a través de un `RepositorioCheckin` (inyectable);
 * si NO validan, responde al modelo con el error para que corrija y NO
 * persiste nada. Termina cuando el modelo produce texto sin tools.
 *
 * El módulo no depende de Supabase ni de `next/*`: recibe el cliente OpenAI y
 * el repositorio por inyección, de modo que el mismo loop se ejercita en tests
 * con un mock del cliente y un repositorio en memoria, y en producción con el
 * cliente real y el repositorio de Supabase.
 */

import type { DominioObservacion, EstadoToma, NivelRiesgo } from "@/types/db";
import {
  evaluarSenal,
  nivelMaximoRiesgo,
  type ReglaSenal,
} from "@/lib/escalado/senales";
import type { ClienteOpenAI, LlamadaHerramienta, MensajeLLM } from "./openai";
import { toolsParaChat, type DominioCheckin } from "./conversacion";
import {
  esquemaFinalizarCheckin,
  esquemaMarcarDominioCubierto,
  esquemaRegistrarObservacion,
  esquemaRegistrarToma,
  esquemaSenalAlarma,
} from "./schemas";

export type ObservacionEntrada = {
  dominio: DominioObservacion;
  codigo: string;
  valorNum: number | null;
  valorTexto: string | null;
  confianza: number;
};

export type TomaEntrada = {
  pautaId: string;
  momento: string;
  estado: EstadoToma;
};

export type SenalEntrada = {
  nivel: NivelRiesgo;
  motivo: string;
  evidencia: Record<string, unknown>;
};

/** Puerto de persistencia del turno (implementado por Supabase o en memoria). */
export interface RepositorioCheckin {
  registrarObservacion(obs: ObservacionEntrada): Promise<void>;
  registrarToma(toma: TomaEntrada): Promise<void>;
  marcarDominioCubierto(dominio: DominioCheckin): Promise<void>;
  registrarSenal(senal: SenalEntrada): Promise<void>;
}

export type OpcionesTurno = {
  cliente: ClienteOpenAI;
  modelo: string;
  instrucciones: string;
  /** Historial de la conversación terminando con el nuevo mensaje del paciente. */
  historial: MensajeLLM[];
  repositorio: RepositorioCheckin;
  contexto: {
    vertical?: string | null;
    dominiosYaCubiertos: DominioCheckin[];
    /**
     * Reglas `senal` aplicables (opcional). Si se pasan, `evaluarSenal`
     * clasifica en vivo según ellas (p. ej. ideación autolítica → urgencia);
     * si no, toda señal se trata de forma conservadora como `contactar`.
     */
    reglasSenal?: readonly ReglaSenal[];
  };
  maxIteraciones?: number;
};

export type ResultadoTurno = {
  texto: string;
  dominiosCubiertos: DominioCheckin[];
  riesgo: NivelRiesgo | null;
  finalizarSugerido: boolean;
  resumenSugerido: string | null;
};

type ResultadoHerramienta = {
  mensaje: string;
  riesgo?: NivelRiesgo;
  finalizar?: boolean;
  resumen?: string;
};

/** Convierte los argumentos JSON del modelo en objeto, o `null` si no parsea. */
function parsearArgumentos(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

async function ejecutarHerramienta(
  llamada: LlamadaHerramienta,
  repositorio: RepositorioCheckin,
  dominios: Set<DominioCheckin>,
  contexto: OpcionesTurno["contexto"],
): Promise<ResultadoHerramienta> {
  const args = parsearArgumentos(llamada.argumentosJson);
  if (args === null) {
    return {
      mensaje:
        "ERROR: los argumentos no son JSON válido. Vuelve a llamar la herramienta con JSON correcto.",
    };
  }

  switch (llamada.nombre) {
    case "registrar_observacion": {
      const r = esquemaRegistrarObservacion.safeParse(args);
      if (!r.success) {
        return { mensaje: `ERROR de validación: ${r.error.message}. Corrige y reintenta.` };
      }
      await repositorio.registrarObservacion({
        dominio: r.data.dominio,
        codigo: r.data.codigo,
        valorNum: r.data.valor_num ?? null,
        valorTexto: r.data.valor_texto ?? null,
        confianza: r.data.confianza,
      });
      return { mensaje: "Observación registrada." };
    }

    case "registrar_toma": {
      const r = esquemaRegistrarToma.safeParse(args);
      if (!r.success) {
        return { mensaje: `ERROR de validación: ${r.error.message}. Corrige y reintenta.` };
      }
      await repositorio.registrarToma({
        pautaId: r.data.pauta_id,
        momento: r.data.momento,
        estado: r.data.estado,
      });
      return { mensaje: "Toma registrada." };
    }

    case "marcar_dominio_cubierto": {
      const r = esquemaMarcarDominioCubierto.safeParse(args);
      if (!r.success) {
        return { mensaje: `ERROR de validación: ${r.error.message}. Corrige y reintenta.` };
      }
      dominios.add(r.data.dominio);
      await repositorio.marcarDominioCubierto(r.data.dominio);
      return { mensaje: `Dominio '${r.data.dominio}' marcado como cubierto.` };
    }

    case "senal_alarma": {
      const r = esquemaSenalAlarma.safeParse(args);
      if (!r.success) {
        return { mensaje: `ERROR de validación: ${r.error.message}. Corrige y reintenta.` };
      }
      const resultado = evaluarSenal({
        tipo: r.data.tipo,
        descripcion: r.data.descripcion,
        evidenciaTextual: r.data.evidencia_textual,
        vertical: contexto.vertical ?? null,
        reglas: contexto.reglasSenal,
      });
      await repositorio.registrarSenal({
        nivel: resultado.nivel,
        motivo: resultado.motivo,
        evidencia: {
          tipo: r.data.tipo,
          descripcion: r.data.descripcion,
          evidencia_textual: r.data.evidencia_textual,
        },
      });
      return { mensaje: resultado.mensajeParaModelo, riesgo: resultado.nivel };
    }

    case "finalizar_checkin": {
      const r = esquemaFinalizarCheckin.safeParse(args);
      if (!r.success) {
        return { mensaje: `ERROR de validación: ${r.error.message}. Corrige y reintenta.` };
      }
      return {
        mensaje: "Cierre registrado. Despídete con calidez.",
        finalizar: true,
        resumen: r.data.resumen,
      };
    }

    default:
      return {
        mensaje: `ERROR: herramienta desconocida '${llamada.nombre}'.`,
      };
  }
}

/**
 * Ejecuta un turno completo de la conversación (§2.2, pasos 2-6), incluyendo
 * el ciclo de tool-calls con persistencia. Devuelve el texto que verá el
 * paciente y el estado derivado (dominios, riesgo, intención de cierre).
 */
export async function ejecutarTurno(
  opciones: OpcionesTurno,
): Promise<ResultadoTurno> {
  const { cliente, modelo, instrucciones, repositorio, contexto } = opciones;
  const maxIteraciones = opciones.maxIteraciones ?? 6;
  const herramientas = toolsParaChat();

  const mensajes: MensajeLLM[] = [
    { rol: "system", contenido: instrucciones },
    ...opciones.historial,
  ];
  const dominios = new Set<DominioCheckin>(contexto.dominiosYaCubiertos);
  let riesgo: NivelRiesgo | null = null;
  let finalizarSugerido = false;
  let resumenSugerido: string | null = null;

  for (let i = 0; i < maxIteraciones; i++) {
    const salida = await cliente.crearRespuesta({ modelo, mensajes, herramientas });

    if (salida.llamadas.length === 0) {
      return {
        texto: salida.contenido ?? "",
        dominiosCubiertos: [...dominios],
        riesgo,
        finalizarSugerido,
        resumenSugerido,
      };
    }

    mensajes.push({
      rol: "assistant",
      contenido: salida.contenido,
      llamadas: salida.llamadas,
    });

    for (const llamada of salida.llamadas) {
      const resultado = await ejecutarHerramienta(
        llamada,
        repositorio,
        dominios,
        contexto,
      );
      if (resultado.riesgo) riesgo = nivelMaximoRiesgo(riesgo, resultado.riesgo);
      if (resultado.finalizar) finalizarSugerido = true;
      if (resultado.resumen) resumenSugerido = resultado.resumen;
      mensajes.push({
        rol: "tool",
        idLlamada: llamada.id,
        nombre: llamada.nombre,
        contenido: resultado.mensaje,
      });
    }
  }

  // Se alcanzó el máximo de iteraciones: pide un cierre textual sin tools.
  const cierre = await cliente.crearRespuesta({
    modelo,
    mensajes,
    herramientas: [],
  });
  return {
    texto:
      cierre.contenido ??
      "Gracias por contarme cómo estás. Seguimos mañana.",
    dominiosCubiertos: [...dominios],
    riesgo,
    finalizarSugerido,
    resumenSugerido,
  };
}
