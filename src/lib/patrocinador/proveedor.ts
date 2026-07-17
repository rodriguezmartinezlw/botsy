/**
 * Proveedor de datos del dashboard del patrocinador (WP-17). Dos caminos que
 * producen la MISMA forma (`DatosDashboard`):
 *
 *  - `agregadosDemo(hoy)`         : PURO, sobre la cohorte sintética en memoria
 *                                    (MODO DEMO — sin base de datos ni claves).
 *  - `agregadosSupabase(cliente)` : llama a las RPC `security definer` de la
 *                                    migración 0010 (producción) con el cliente
 *                                    de sesión del patrocinador; valida cada
 *                                    respuesta con Zod (entrada externa).
 *
 * En ambos casos los datos ya vienen agregados y con k-anonimato aplicado: el
 * camino demo lo aplica con las funciones puras de `agregacion.ts`; el de
 * producción lo aplica en SQL. Este módulo NO importa `next/headers` (recibe el
 * cliente), de modo que el camino demo es utilizable sin entorno de servidor.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaseDatos } from "@/types/db";
import {
  adherenciaMensual,
  alertasPorNivel,
  curvaPersistencia,
  mesesTratamiento,
  motivosDiscontinuacion,
  resumenCohorte,
  tasaCheckin,
  tiempoHastaDisposicion,
  type ConteoMotivo,
  type ConteoNivel,
  type MesesTratamiento,
  type PuntoAdherenciaMensual,
  type PuntoPersistencia,
  type RegistroPacienteAgregado,
  type ResumenCohorte,
  type TasaCheckin,
  type TiempoHastaDisposicion,
} from "./agregacion";
import { calcularRoi, type MetricasRoi } from "./roi";
import {
  PATROCINADOR_DEMO,
  construirCohorteDemo,
  programasDemo,
} from "./demo";

// --- Forma de salida ---------------------------------------------------------

export type CohorteVista = {
  clave: string;
  nombre: string;
  resumen: ResumenCohorte;
  persistencia: PuntoPersistencia[];
  meses: MesesTratamiento;
  adherencia: PuntoAdherenciaMensual[];
  motivos: ConteoMotivo[];
  tasaCheckin: TasaCheckin;
  alertas: ConteoNivel[];
  tiempoDisposicion: TiempoHastaDisposicion;
};

export type DatosDashboard = {
  demo: boolean;
  patrocinador: string;
  combinado: CohorteVista;
  programas: CohorteVista[];
  roi: MetricasRoi;
};

const CLAVE_COMBINADO = "combinado";
const NOMBRE_COMBINADO = "Todas las cohortes financiadas";

// --- Camino DEMO (puro) ------------------------------------------------------

function vistaDeCohorte(
  clave: string,
  nombre: string,
  registros: RegistroPacienteAgregado[],
  hoy: string,
): CohorteVista {
  return {
    clave,
    nombre,
    resumen: resumenCohorte(registros),
    persistencia: curvaPersistencia(registros),
    meses: mesesTratamiento(registros, hoy),
    adherencia: adherenciaMensual(registros),
    motivos: motivosDiscontinuacion(registros),
    tasaCheckin: tasaCheckin(registros, hoy),
    alertas: alertasPorNivel(registros),
    tiempoDisposicion: tiempoHastaDisposicion(registros),
  };
}

export function agregadosDemo(hoy: string): DatosDashboard {
  const cohorte = construirCohorteDemo(hoy);
  const combinado = vistaDeCohorte(CLAVE_COMBINADO, NOMBRE_COMBINADO, cohorte, hoy);
  const programas = programasDemo().map((p) =>
    vistaDeCohorte(
      p.clave,
      p.nombre,
      cohorte.filter((r) => r.programaClave === p.clave),
      hoy,
    ),
  );
  return {
    demo: true,
    patrocinador: PATROCINADOR_DEMO,
    combinado,
    programas,
    roi: calcularRoi(cohorte, hoy),
  };
}

// --- Camino PRODUCCIÓN (RPC + Zod) -------------------------------------------

// PostgREST puede serializar `numeric` como string; `coerce` lo normaliza.
const num = z.coerce.number();
const numN = z.union([z.coerce.number(), z.null()]);
const boolC = z.coerce.boolean();

const filaResumen = z.object({
  programa_id: z.string(),
  clave: z.string(),
  nombre: z.string(),
  n_pacientes: z.union([z.coerce.number().int(), z.null()]),
  datos_insuficientes: boolC,
});
const filaPersistencia = z.object({ mes: z.coerce.number().int(), tasa: num, n: z.coerce.number().int() });
const filaMeses = z.object({
  mediana: numN, p25: numN, p75: numN,
  n: z.union([z.coerce.number().int(), z.null()]), datos_insuficientes: boolC,
});
const filaAdherencia = z.object({ mes: z.string(), adherencia: num, n_pacientes: z.coerce.number().int() });
const filaMotivo = z.object({ codigo: z.string(), etiqueta: z.string(), conteo: z.coerce.number().int() });
const filaTasa = z.object({ tasa: numN, n: z.union([z.coerce.number().int(), z.null()]), datos_insuficientes: boolC });
const filaAlertas = z.object({ nivel: z.enum(["vigilancia", "contactar", "urgencia"]), conteo: z.coerce.number().int() });
const filaTiempo = z.object({ mediana_horas: numN, n: z.union([z.coerce.number().int(), z.null()]), datos_insuficientes: boolC });
const filaRoi = z.object({
  pacientes_mes: numN, urgencias_evitadas: z.union([z.coerce.number().int(), z.null()]),
  urgencias_evitadas_100: numN, horas_senal_alerta: numN, horas_alerta_disposicion: numN,
  tasa_checkin: numN, persistencia_pct: numN,
  n: z.union([z.coerce.number().int(), z.null()]), datos_insuficientes: boolC,
});

/** Cliente mínimo para RPC sin pelear con los genéricos (evita `any`). */
type ClienteRpc = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

async function llamarRpc<T>(
  cliente: ClienteRpc,
  fn: string,
  programaId: string | null,
  esquemaFila: z.ZodType<T>,
): Promise<T[]> {
  const { data, error } = await cliente.rpc(fn, { p_programa_id: programaId });
  if (error) return [];
  const filas = z.array(esquemaFila).safeParse(data ?? []);
  return filas.success ? filas.data : [];
}

async function metricasRpc(
  cliente: ClienteRpc,
  programaId: string | null,
): Promise<Omit<CohorteVista, "clave" | "nombre" | "resumen">> {
  const [persistencia, meses, adherencia, motivos, tasa, alertas, tiempo] = await Promise.all([
    llamarRpc(cliente, "patro_persistencia", programaId, filaPersistencia),
    llamarRpc(cliente, "patro_meses_tratamiento", programaId, filaMeses),
    llamarRpc(cliente, "patro_adherencia_mensual", programaId, filaAdherencia),
    llamarRpc(cliente, "patro_motivos_discontinuacion", programaId, filaMotivo),
    llamarRpc(cliente, "patro_tasa_checkin", programaId, filaTasa),
    llamarRpc(cliente, "patro_alertas_por_nivel", programaId, filaAlertas),
    llamarRpc(cliente, "patro_tiempo_hasta_disposicion", programaId, filaTiempo),
  ]);

  const m = meses[0];
  const t = tasa[0];
  const th = tiempo[0];

  return {
    persistencia: persistencia.map((p) => ({ mes: p.mes, tasa: p.tasa })),
    meses:
      m && !m.datos_insuficientes && m.mediana !== null && m.p25 !== null && m.p75 !== null && m.n !== null
        ? { suficiente: true, mediana: m.mediana, p25: m.p25, p75: m.p75, n: m.n }
        : { suficiente: false },
    adherencia: adherencia.map((a) => ({ mes: a.mes, adherencia: a.adherencia, nPacientes: a.n_pacientes })),
    motivos: motivos.map((mo) => ({ codigo: mo.codigo, etiqueta: mo.etiqueta, conteo: mo.conteo })),
    tasaCheckin:
      t && !t.datos_insuficientes && t.tasa !== null && t.n !== null
        ? { suficiente: true, tasa: t.tasa, n: t.n }
        : { suficiente: false },
    alertas: alertas.map((a) => ({ nivel: a.nivel, conteo: a.conteo })),
    tiempoDisposicion:
      th && !th.datos_insuficientes && th.mediana_horas !== null && th.n !== null
        ? { suficiente: true, medianaHoras: th.mediana_horas, n: th.n }
        : { suficiente: false },
  };
}

function metricasRoiDeFila(f: z.infer<typeof filaRoi> | undefined): MetricasRoi {
  if (!f || f.datos_insuficientes || f.n === null || f.pacientes_mes === null) {
    return { suficiente: false };
  }
  return {
    suficiente: true,
    n: f.n,
    pacientesMes: f.pacientes_mes,
    urgenciasEvitadas: f.urgencias_evitadas ?? 0,
    urgenciasEvitadas100: f.urgencias_evitadas_100 ?? 0,
    horasSenalAlerta: f.horas_senal_alerta,
    horasAlertaDisposicion: f.horas_alerta_disposicion,
    tasaCheckin: f.tasa_checkin ?? 0,
    persistenciaPct: f.persistencia_pct ?? 0,
  };
}

/**
 * Carga los agregados del patrocinador de la sesión desde las RPC (0010). Nunca
 * lanza: ante un fallo devuelve cohortes vacías/suprimidas (el dashboard muestra
 * "datos insuficientes"). El nombre del patrocinador se pasa desde la sesión.
 */
export async function agregadosSupabase(
  supabase: SupabaseClient<BaseDatos>,
  nombrePatrocinador: string,
): Promise<DatosDashboard> {
  const cliente = supabase as unknown as ClienteRpc;

  const [resumenFilas, combinadoMetricas, roiFilasRaw] = await Promise.all([
    llamarRpc(cliente, "patro_resumen_cohorte", null, filaResumen),
    metricasRpc(cliente, null),
    llamarRpc(cliente, "patro_roi", null, filaRoi),
  ]);

  const roi = metricasRoiDeFila(roiFilasRaw[0]);
  const nCombinado = roi.suficiente ? roi.n : null;
  const combinado: CohorteVista = {
    clave: CLAVE_COMBINADO,
    nombre: NOMBRE_COMBINADO,
    resumen: { n: nCombinado, suficiente: roi.suficiente },
    ...combinadoMetricas,
  };

  const programas: CohorteVista[] = await Promise.all(
    resumenFilas.map(async (fila) => {
      const metricas = await metricasRpc(cliente, fila.programa_id);
      return {
        clave: fila.programa_id,
        nombre: fila.nombre,
        resumen: {
          n: fila.datos_insuficientes ? null : fila.n_pacientes,
          suficiente: !fila.datos_insuficientes,
        },
        ...metricas,
      };
    }),
  );

  return {
    demo: false,
    patrocinador: nombrePatrocinador || "Patrocinador",
    combinado,
    programas,
    roi,
  };
}
