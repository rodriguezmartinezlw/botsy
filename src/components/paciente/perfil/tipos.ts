/**
 * Tipos presentacionales del perfil (WP-05): la forma de los datos YA
 * CALCULADOS que el Server Component pasa al panel cliente. No importa Supabase;
 * sólo tipos de `@/lib/agregados` (módulo puro).
 */

import type {
  DiaAdherencia,
  Periodo,
  PuntoAnimo,
  PuntoBarra,
  RecuentoSintoma,
  SeriePunto,
} from "@/lib/agregados";

export type BundleDolor = {
  serie: SeriePunto[];
  media: number | null;
  delta: number | null;
  pico: number | null;
};

/** Parte de adherencia que NO depende del período (fila L–D y evolución mensual). */
export type AdherenciaFarmaco = {
  pautaId: string;
  farmaco: string;
  dosis: string | null;
  critica: boolean;
  semana: DiaAdherencia[];
  evolucionMensual: PuntoBarra[];
};

/** % de adherencia del período seleccionado (global y por fármaco). */
export type AdherenciaPeriodo = {
  global: number | null;
  porFarmaco: Record<string, number | null>;
};

/** Datos que dependen del período seleccionado. */
export type BundlePeriodo = {
  dolor: BundleDolor;
  animo: PuntoAnimo[];
  sueno: PuntoBarra[];
  adherencia: AdherenciaPeriodo;
};

export type CabeceraPerfil = {
  nombre: string;
  inicial: string;
  avatarUrl: string | null;
  rachaActual: number;
  checkinsMes: number;
};

export type DatosPerfil = {
  cabecera: CabeceraPerfil;
  /** Fármacos activos con su fila L–D y evolución mensual (independiente del período). */
  farmacos: AdherenciaFarmaco[];
  /** Serie de cognición (por fecha). Vacía si el paciente aún no tiene datos. */
  cognicion: SeriePunto[];
  /** Chips de síntomas físicos de los últimos 30 días. */
  sintomas: RecuentoSintoma[];
  /** Bundles precalculados para cada período (Semana / Mes / 3 meses). */
  porPeriodo: Record<Periodo, BundlePeriodo>;
};
