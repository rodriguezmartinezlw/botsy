/**
 * Tipos presentacionales del informe de seguimiento (WP-07). La forma de los
 * datos YA LEÍDOS Y AGREGADOS que el Server Component pasa a la vista. No
 * importan Supabase; sólo tipos de módulos puros (`@/lib/agregados`, `@/types/db`).
 */

import type { DiaAdherencia, SeriePunto } from "@/lib/agregados";
import type {
  EstadoAlerta,
  Json,
  NivelEscalado,
  TipoConsentimiento,
  VerticalPaciente,
} from "@/types/db";

export type DolorInforme = {
  serie: SeriePunto[];
  media: number | null;
  pico: number | null;
  minimo: number | null;
  /** Nº de días con al menos un registro de dolor. */
  registros: number;
};

export type MetricaDominio = {
  media: number | null;
  registros: number;
};

export type AnimoInforme = {
  animo: MetricaDominio;
  ansiedad: MetricaDominio;
  estres: MetricaDominio;
};

export type FarmacoInforme = {
  farmaco: string;
  dosis: string | null;
  critica: boolean;
  porcentaje: number | null;
  tomadas: number;
  omitidas: number;
  /** Fila semanal L–D (reutiliza el widget CSS de WP-05, apto para impresión). */
  semana: DiaAdherencia[];
};

export type AdherenciaInforme = {
  global: { porcentaje: number | null; tomadas: number; omitidas: number };
  farmacos: FarmacoInforme[];
};

export type AlertaInforme = {
  id: string;
  nivel: NivelEscalado;
  estado: EstadoAlerta;
  motivo: string;
  evidencia: Json;
  creadoEn: string;
  gestionadaEn: string | null;
  motivoDescarte: string | null;
};

export type ObservacionDestacada = {
  fecha: string;
  dominio: string;
  codigo: string;
  texto: string;
};

export type ConsentimientoVigenteInforme = {
  tipo: TipoConsentimiento;
  otorgado: boolean;
};

export type DatosInforme = {
  paciente: {
    id: string;
    nombre: string;
    inicial: string;
    edad: number | null;
    sexo: string | null;
    vertical: VerticalPaciente;
    condiciones: string[];
  };
  periodo: { desde: string; hasta: string; dias: number };
  totalCheckins: number;
  dolor: DolorInforme;
  animo: AnimoInforme;
  adherencia: AdherenciaInforme;
  alertas: AlertaInforme[];
  sintomas: { codigo: string; recuento: number }[];
  observaciones: ObservacionDestacada[];
  consentimientos: ConsentimientoVigenteInforme[];
};
