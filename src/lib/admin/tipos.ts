/**
 * Tipos presentacionales de la consola de administración (WP-23): la forma de los
 * datos YA LEÍDOS que los Server Components pasan a los componentes cliente. No
 * importan Supabase; sólo tipos del dominio (`@/types/db`).
 */

import type { TipoInstitucion } from "@/types/db";

/** Resultado común de las Server Actions del admin. */
export type AccionAdmin =
  | { ok: true; mensaje?: string }
  | {
      ok: false;
      error: string;
      /** El "error" es en realidad un aviso a confirmar (retiro de última membresía). */
      confirmable?: boolean;
    };

/** País del catálogo (para selects y la gestión de catálogo). */
export type PaisVista = {
  codigo: string;
  nombre: string;
};

/** Institución con su país resuelto y conteos, para la lista del admin. */
export type InstitucionVista = {
  id: string;
  nombre: string;
  tipo: TipoInstitucion;
  paisCodigo: string;
  paisNombre: string | null;
  activa: boolean;
  /** Nº de profesionales con membresía activa en la institución. */
  profesionales: number;
  /** Nº de pacientes adscritos a la institución. */
  pacientes: number;
};

/** Institución mínima (id + nombre + país) para los desplegables de asignación. */
export type InstitucionOpcion = {
  id: string;
  nombre: string;
  paisNombre: string | null;
};

/** Una membresía del profesional, ya resuelta a nombre de institución. */
export type MembresiaVista = {
  id: string;
  institucionId: string;
  institucionNombre: string;
  activa: boolean;
};

/** Profesional con sus membresías, para la lista del admin. */
export type ProfesionalVista = {
  id: string;
  nombre: string;
  telefono: string | null;
  membresias: MembresiaVista[];
};

/** Paciente sin institución (riesgo operativo de WP-22), para la vista admin. */
export type PacienteSinInstitucionVista = {
  id: string;
  nombre: string;
  inicial: string;
  creadoEn: string;
};

/** Recuento de cabecera del panel de administración. */
export type ResumenAdmin = {
  instituciones: number;
  institucionesActivas: number;
  profesionales: number;
  pacientesSinInstitucion: number;
};
