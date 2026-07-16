/**
 * Tipos presentacionales del panel profesional (WP-06): la forma de los datos YA
 * LEÍDOS Y AGREGADOS que el Server Component pasa a los componentes cliente. No
 * importan Supabase; sólo tipos de módulos puros (`@/lib/agregados`).
 */

import type { PuntoAnimo, SeriePunto, DiaAdherencia } from "@/lib/agregados";
import type {
  CanalCheckin,
  EstadoAlerta,
  EstadoCheckin,
  Json,
  NivelEscalado,
  NivelRiesgo,
  TipoConsentimiento,
  VerticalPaciente,
} from "@/types/db";

// --- Cabecera de la ficha ----------------------------------------------------

export type CabeceraFicha = {
  id: string;
  nombre: string;
  inicial: string;
  avatarUrl: string | null;
  edad: number | null;
  sexo: string | null;
  vertical: VerticalPaciente;
  condiciones: string[];
  /** Teléfono del paciente (para el botón de llamada). */
  telefono: string | null;
  rachaActual: number;
  rachaMaxima: number;
};

// --- Línea temporal unificada ------------------------------------------------

export type ItemCheckin = {
  tipo: "checkin";
  id: string;
  /** Timestamp ISO para ordenar cronológicamente. */
  ts: string;
  /** Fecha clínica "yyyy-MM-dd" para mostrar. */
  fecha: string;
  canal: CanalCheckin | null;
  estado: EstadoCheckin;
  riesgo: NivelRiesgo | null;
  resumen: string | null;
  /** Transcript completo (se muestra al expandir). */
  mensajes: { rol: string; contenido: string }[];
};

export type ItemAlerta = {
  tipo: "alerta";
  id: string;
  ts: string;
  nivel: NivelEscalado;
  estado: EstadoAlerta;
  motivo: string;
  evidencia: Json;
};

export type ItemMedicacion = {
  tipo: "medicacion";
  id: string;
  ts: string;
  farmaco: string;
  dosis: string | null;
  critica: boolean;
  activa: boolean;
};

export type ItemConsentimiento = {
  tipo: "consentimiento";
  id: string;
  ts: string;
  tipoConsentimiento: TipoConsentimiento;
  otorgado: boolean;
  version: string;
};

export type ItemTimeline =
  | ItemCheckin
  | ItemAlerta
  | ItemMedicacion
  | ItemConsentimiento;

// --- Tendencias compactas (reutilizan los gráficos de WP-05) ------------------

export type FarmacoTendencia = {
  pautaId: string;
  farmaco: string;
  dosis: string | null;
  critica: boolean;
  semana: DiaAdherencia[];
  adherencia7: number | null;
};

export type TendenciasCompactas = {
  hoy: string;
  dolor: { serie: SeriePunto[]; media: number | null; delta: number | null };
  animo: PuntoAnimo[];
  farmacos: FarmacoTendencia[];
};

// --- Medicación --------------------------------------------------------------

export type PautaVista = {
  id: string;
  farmaco: string;
  dosis: string | null;
  momentos: string[];
  critica: boolean;
  activa: boolean;
  creadoEn: string;
};

// --- Reglas ------------------------------------------------------------------

export type ReglaVista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Frase legible de la condición (WP-04) para mostrar sin JSON. */
  condicionTexto: string;
  nivel: NivelEscalado;
  activa: boolean;
  /** Ámbito de la regla (global aplica a varios pacientes; propia sólo a éste). */
  vertical: string | null;
};

// --- Ficha completa ----------------------------------------------------------

export type FichaPaciente = {
  cabecera: CabeceraFicha;
  timeline: ItemTimeline[];
  tendencias: TendenciasCompactas;
  pautas: PautaVista[];
  reglasGlobales: ReglaVista[];
  reglasPaciente: ReglaVista[];
};

// --- Resultado de una Server Action ------------------------------------------

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

// --- Bandeja de alertas (detalle para la UI) ---------------------------------

export type AlertaDetalle = {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  pacienteInicial: string;
  checkinId: string | null;
  nivel: NivelEscalado;
  estado: EstadoAlerta;
  motivo: string;
  motivoDescarte: string | null;
  evidencia: Json;
  creadoEn: string;
  gestionadaEn: string | null;
};
