/**
 * Cohorte DEMO sintética para el dashboard del patrocinador y el ROI en MODO
 * DEMO (WP-17 §modo demo) — módulo PURO. Reproduce, en memoria y sin base de
 * datos, la MISMA historia que el seed oncológico (`supabase/seed.sql`): 10
 * pacientes de cáncer de mama (6 en «Terapia oral», 4 en «Tratamiento activo»),
 * 45 días de check-ins, adherencia creíble, 2 discontinuaciones con motivo
 * codificado, alertas en varios niveles y disposiciones con desenlace.
 *
 * Sirve el dashboard en LOCAL sin claves de producción (marca de agua
 * "DEMO — datos sintéticos"). Los DATOS SON SINTÉTICOS: no hay pacientes reales.
 *
 * La supresión por k-anonimato la aplican, sobre estos registros, las funciones
 * puras de `agregacion.ts` (las mismas que el resto del sistema). El corte
 * «Tratamiento activo» tiene 4 pacientes (< 5) → aparecerá SUPRIMIDO en la vista
 * por-programa: es la demostración en vivo de la privacidad por diseño.
 */

import { format, parseISO, subDays } from "date-fns";
import type {
  MotivoCodificado,
  RegistroPacienteAgregado,
} from "./agregacion";

export const PROGRAMA_TERAPIA_ORAL = "mama_terapia_oral";
export const PROGRAMA_TRATAMIENTO_ACTIVO = "mama_tratamiento_activo";

export const NOMBRE_PROGRAMA: Record<string, string> = {
  [PROGRAMA_TERAPIA_ORAL]: "Mama · Terapia oral",
  [PROGRAMA_TRATAMIENTO_ACTIVO]: "Mama · Tratamiento activo",
};

export const PATROCINADOR_DEMO = "Laboratorio Demo (sintético)";

const TOXICIDAD: MotivoCodificado = {
  codigo: "toxicidad",
  etiqueta: "Toxicidad / efectos adversos",
};
const DECISION_PACIENTE: MotivoCodificado = {
  codigo: "decision_paciente",
  etiqueta: "Decisión del paciente",
};

type Desenlace = string;

type ParamPaciente = {
  pseudonimo: string;
  programa: string;
  inicioDiasAtras: number;
  discontinuadaDiasAtras: number | null;
  motivo: MotivoCodificado | null;
  adherencia: number; // fracción de tomas 'tomada'
  cumplimiento: number; // fracción de días con check-in
  alertas: {
    nivel: "vigilancia" | "contactar" | "urgencia";
    diasAtras: number;
    conDisposicion: boolean;
    horasHastaDisposicion?: number;
    desenlace?: Desenlace;
  }[];
};

/** Parámetros de los 10 pacientes demo (deterministas, alineados con seed.sql). */
const PARAMS: ParamPaciente[] = [
  // --- Terapia oral (6) ---
  {
    pseudonimo: "ONC-01", programa: PROGRAMA_TERAPIA_ORAL,
    inicioDiasAtras: 200, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.9, cumplimiento: 0.93,
    // Protagonista del guion: fiebre HOY -> alerta contactar NUEVA (sin disposición).
    alertas: [{ nivel: "contactar", diasAtras: 0, conDisposicion: false }],
  },
  {
    pseudonimo: "ONC-02", programa: PROGRAMA_TERAPIA_ORAL,
    inicioDiasAtras: 120, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.95, cumplimiento: 0.9,
    alertas: [{ nivel: "contactar", diasAtras: 15, conDisposicion: true, horasHastaDisposicion: 5, desenlace: "resuelto_sin_evento" }],
  },
  {
    pseudonimo: "ONC-03", programa: PROGRAMA_TERAPIA_ORAL,
    inicioDiasAtras: 300, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.88, cumplimiento: 0.87,
    alertas: [{ nivel: "vigilancia", diasAtras: 20, conDisposicion: true, horasHastaDisposicion: 6, desenlace: "visita_no_programada" }],
  },
  {
    pseudonimo: "ONC-04", programa: PROGRAMA_TERAPIA_ORAL,
    inicioDiasAtras: 90, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.92, cumplimiento: 0.95,
    alertas: [{ nivel: "contactar", diasAtras: 25, conDisposicion: true, horasHastaDisposicion: 3, desenlace: "resuelto_sin_evento" }],
  },
  {
    pseudonimo: "ONC-05", programa: PROGRAMA_TERAPIA_ORAL,
    inicioDiasAtras: 150, discontinuadaDiasAtras: 22, motivo: TOXICIDAD,
    adherencia: 0.7, cumplimiento: 0.8,
    alertas: [{ nivel: "contactar", diasAtras: 24, conDisposicion: true, horasHastaDisposicion: 8, desenlace: "discontinuacion" }],
  },
  {
    pseudonimo: "ONC-06", programa: PROGRAMA_TERAPIA_ORAL,
    inicioDiasAtras: 240, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.85, cumplimiento: 0.88,
    // Bajón de ánimo -> vigilancia VISTA (sin disposición aún).
    alertas: [{ nivel: "vigilancia", diasAtras: 5, conDisposicion: false }],
  },
  // --- Tratamiento activo (4) — cohorte < 5 => suprimida por-programa ---
  {
    pseudonimo: "ONC-07", programa: PROGRAMA_TRATAMIENTO_ACTIVO,
    inicioDiasAtras: 75, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.9, cumplimiento: 0.92,
    // Fiebre en tratamiento activo -> URGENCIA (neutropenia febril), resuelta.
    alertas: [{ nivel: "urgencia", diasAtras: 12, conDisposicion: true, horasHastaDisposicion: 1, desenlace: "resuelto_sin_evento" }],
  },
  {
    pseudonimo: "ONC-08", programa: PROGRAMA_TRATAMIENTO_ACTIVO,
    inicioDiasAtras: 130, discontinuadaDiasAtras: 10, motivo: DECISION_PACIENTE,
    adherencia: 0.6, cumplimiento: 0.78,
    alertas: [],
  },
  {
    pseudonimo: "ONC-09", programa: PROGRAMA_TRATAMIENTO_ACTIVO,
    inicioDiasAtras: 180, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.87, cumplimiento: 0.9,
    alertas: [{ nivel: "contactar", diasAtras: 9, conDisposicion: true, horasHastaDisposicion: 4, desenlace: "resuelto_sin_evento" }],
  },
  {
    pseudonimo: "ONC-10", programa: PROGRAMA_TRATAMIENTO_ACTIVO,
    inicioDiasAtras: 60, discontinuadaDiasAtras: null, motivo: null,
    adherencia: 0.91, cumplimiento: 0.86,
    alertas: [{ nivel: "contactar", diasAtras: 18, conDisposicion: true, horasHastaDisposicion: 7, desenlace: "otro" }],
  },
];

/** Pseudo-aleatorio determinista en [0,1) a partir de dos enteros. */
function det(a: number, b: number): number {
  const x = Math.sin(a * 97.13 + b * 13.71) * 43758.5453;
  return x - Math.floor(x);
}

function fechaAtras(hoy: string, dias: number): string {
  return format(subDays(parseISO(hoy), dias), "yyyy-MM-dd");
}

function isoAtras(hoy: string, dias: number, horas = 9): string {
  const d = subDays(parseISO(hoy), dias);
  d.setHours(horas, 0, 0, 0);
  return d.toISOString();
}

/** Construye la cohorte demo (10 pacientes) relativa a `hoy` (yyyy-MM-dd). */
export function construirCohorteDemo(hoy: string): RegistroPacienteAgregado[] {
  return PARAMS.map((p, i) => {
    const checkinDias: string[] = [];
    const tomas: { fecha: string; estado: "tomada" | "omitida" }[] = [];

    for (let d = 0; d < 45; d++) {
      const diasAtras = 44 - d;
      const fecha = fechaAtras(hoy, diasAtras);
      const haceCheckin = det(i + 1, d + 1) < p.cumplimiento;
      if (!haceCheckin) continue;
      checkinDias.push(fecha);
      // Tomas solo mientras la pauta está activa (antes de la discontinuación).
      const activa = p.discontinuadaDiasAtras === null || diasAtras > p.discontinuadaDiasAtras;
      if (activa) {
        const tomada = det(i + 50, d + 1) < p.adherencia;
        tomas.push({ fecha, estado: tomada ? "tomada" : "omitida" });
      }
    }

    return {
      pseudonimo: p.pseudonimo,
      programaClave: p.programa,
      pautas: [
        {
          inicio: fechaAtras(hoy, p.inicioDiasAtras),
          discontinuada:
            p.discontinuadaDiasAtras === null
              ? null
              : fechaAtras(hoy, p.discontinuadaDiasAtras),
          motivo: p.motivo,
        },
      ],
      tomas,
      checkinDias,
      alertas: p.alertas.map((a) => ({
        nivel: a.nivel,
        creadaEn: isoAtras(hoy, a.diasAtras, 9),
        senalEn: isoAtras(hoy, a.diasAtras, 8), // señal ~1h antes de la alerta
        disposicion: a.conDisposicion
          ? {
              creadaEn: isoAtras(hoy, a.diasAtras, 9 + (a.horasHastaDisposicion ?? 4)),
              desenlace: a.desenlace ?? "pendiente",
            }
          : null,
      })),
    };
  });
}

/** Cohortes por programa financiado (para las tarjetas por-programa del dashboard). */
export function programasDemo(): { clave: string; nombre: string }[] {
  return [
    { clave: PROGRAMA_TERAPIA_ORAL, nombre: NOMBRE_PROGRAMA[PROGRAMA_TERAPIA_ORAL] },
    { clave: PROGRAMA_TRATAMIENTO_ACTIVO, nombre: NOMBRE_PROGRAMA[PROGRAMA_TRATAMIENTO_ACTIVO] },
  ];
}
