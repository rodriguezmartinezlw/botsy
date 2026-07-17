/**
 * Tipos de la base de datos de Botsy (F1) — escritos a mano como espejo del
 * SQL de `supabase/migrations/0001_esquema_inicial.sql`. Mantener sincronizado
 * con las migraciones. Convención de columnas: español + snake_case.
 *
 * Se expone `BaseDatos` con la forma que esperan los genéricos de
 * `@supabase/supabase-js` / `@supabase/ssr`, de modo que las consultas queden
 * tipadas (`createBrowserClient<BaseDatos>(...)`, etc.).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [clave: string]: Json | undefined }
  | Json[];

// --- Enumeraciones (checks del SQL) -----------------------------------------
export type RolPerfil = "paciente" | "profesional" | "admin";
export type VerticalPaciente =
  | "cardiovascular"
  | "cronica"
  | "geriatrica"
  | "mental"
  | "ocupacional"
  | "general";
export type CanalCheckin = "texto" | "voz";
export type EstadoCheckin = "en_curso" | "completado" | "abandonado";
export type NivelRiesgo = "normal" | "vigilancia" | "contactar" | "urgencia";
export type RolMensaje = "asistente" | "paciente";
export type DominioObservacion =
  | "dolor"
  | "sintoma_fisico"
  | "animo"
  | "ansiedad"
  | "estres"
  | "sueno"
  | "cognicion"
  | "adherencia"
  | "tratamiento"
  | "habitos";
export type OrigenObservacion = "conversacion" | "reconciliacion";
export type EstadoToma = "tomada" | "omitida" | "desconocido";
export type NivelEscalado = "vigilancia" | "contactar" | "urgencia";
export type EstadoAlerta = "nueva" | "vista" | "resuelta" | "descartada";
export type TipoConsentimiento =
  | "conversacion"
  | "voz_grabacion"
  | "voz_biomarcadores"
  | "uso_secundario";

// --- Programas de monitorización (WP-11 v2) ---------------------------------
export type EstadoProgramaPaciente = "activo" | "completado" | "suspendido";

// --- Disposición estructurada (WP-11 v2, regla de oro 3) --------------------
export type AmbitoMotivo = "disposicion" | "descarte" | "discontinuacion";
export type DecisionDisposicion =
  | "contactado_paciente"
  | "ajuste_pauta"
  | "derivado_consulta"
  | "derivado_urgencias"
  | "observacion"
  | "sin_accion_justificada";
export type DesenlaceDisposicion =
  | "pendiente"
  | "resuelto_sin_evento"
  | "visita_no_programada"
  | "urgencias"
  | "hospitalizacion"
  | "discontinuacion"
  | "otro";

// --- Filas (Row) ------------------------------------------------------------
export type Perfil = {
  id: string;
  rol: RolPerfil;
  nombre: string;
  telefono: string | null;
  avatar_url: string | null;
  idioma: string;
  zona_horaria: string;
  creado_en: string;
}

export type Paciente = {
  id: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  vertical: VerticalPaciente;
  condiciones: string[];
  profesional_id: string | null;
  telefono_medico: string | null;
  hora_checkin: string;
  racha_actual: number;
  racha_maxima: number;
  ultimo_checkin: string | null;
  creado_en: string;
}

export type PautaMedicacion = {
  id: string;
  paciente_id: string;
  farmaco: string;
  dosis: string | null;
  momentos: string[];
  critica: boolean;
  activa: boolean;
  creada_por: string | null;
  creado_en: string;
  desactivada_en: string | null;
  /** Motivo codificado de discontinuación (WP-11 v2 §C.4). NULL si fue baja por error. */
  motivo_discontinuacion: string | null;
}

export type Checkin = {
  id: string;
  paciente_id: string;
  fecha: string;
  canal: CanalCheckin | null;
  estado: EstadoCheckin;
  dominios_cubiertos: Json;
  resumen: string | null;
  riesgo: NivelRiesgo | null;
  duracion_seg: number | null;
  audio_path: string | null;
  finalizado_en: string | null;
  creado_en: string;
}

export type Mensaje = {
  id: string;
  checkin_id: string;
  rol: RolMensaje;
  contenido: string;
  orden: number;
  creado_en: string;
}

export type Observacion = {
  id: string;
  checkin_id: string;
  paciente_id: string;
  dominio: DominioObservacion;
  codigo: string;
  valor_num: number | null;
  valor_texto: string | null;
  confianza: number | null;
  origen: OrigenObservacion;
  creado_en: string;
}

export type TomaMedicacion = {
  id: string;
  pauta_id: string;
  paciente_id: string;
  checkin_id: string | null;
  fecha: string;
  momento: string;
  estado: EstadoToma;
  creado_en: string;
}

export type ReglaEscalado = {
  id: string;
  paciente_id: string | null;
  vertical: string | null;
  nombre: string;
  descripcion: string | null;
  condicion: Json;
  nivel: NivelEscalado;
  activa: boolean;
  creado_en: string;
  /**
   * Asignación de programa que MATERIALIZÓ esta regla (WP-11 v2 §A.5). NULL para
   * reglas globales, de vertical o creadas a mano por el profesional. Sirve de
   * clave de activación idempotente y de limpieza en cascada al eliminar la
   * asignación.
   */
  programa_paciente_id: string | null;
}

export type Alerta = {
  id: string;
  paciente_id: string;
  checkin_id: string | null;
  regla_id: string | null;
  nivel: NivelEscalado;
  motivo: string;
  evidencia: Json;
  estado: EstadoAlerta;
  motivo_descarte: string | null;
  gestionada_por: string | null;
  gestionada_en: string | null;
  creado_en: string;
}

export type Consentimiento = {
  id: string;
  paciente_id: string;
  tipo: TipoConsentimiento;
  otorgado: boolean;
  version_texto: string;
  registrado_en: string;
  creado_en: string;
}

export type EventoAuditoria = {
  id: string;
  actor_id: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  detalle: Json;
  creado_en: string;
}

export type Informe = {
  id: string;
  paciente_id: string;
  generado_por: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  resumen: string | null;
  modelo: string | null;
  generado_en: string;
}

export type Programa = {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  version: number;
  config: Json;
  activo: boolean;
  creado_en: string;
}

export type ProgramaPaciente = {
  id: string;
  paciente_id: string;
  programa_id: string;
  config_override: Json;
  fase_actual: number;
  fecha_inicio: string | null;
  fecha_evento: string | null;
  estado: EstadoProgramaPaciente;
  asignado_por: string | null;
  creado_en: string;
}

export type CatalogoMotivo = {
  id: string;
  ambito: AmbitoMotivo;
  codigo: string;
  etiqueta: string;
  activo: boolean;
  creado_en: string;
}

export type Disposicion = {
  id: string;
  alerta_id: string;
  decision: DecisionDisposicion;
  motivo_codigo: string | null;
  motivo_texto: string | null;
  dias_seguimiento: number;
  desenlace: DesenlaceDisposicion;
  desenlace_nota: string | null;
  desenlace_registrado_en: string | null;
  creada_por: string | null;
  creado_en: string;
}

// --- Inserts (columnas con default/nulables son opcionales) -----------------
export type PerfilInsert = {
  id: string;
  rol: RolPerfil;
  nombre: string;
  telefono?: string | null;
  avatar_url?: string | null;
  idioma?: string;
  zona_horaria?: string;
  creado_en?: string;
}

export type PacienteInsert = {
  id: string;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  vertical?: VerticalPaciente;
  condiciones?: string[];
  profesional_id?: string | null;
  telefono_medico?: string | null;
  hora_checkin?: string;
  racha_actual?: number;
  racha_maxima?: number;
  ultimo_checkin?: string | null;
  creado_en?: string;
}

export type PautaMedicacionInsert = {
  id?: string;
  paciente_id: string;
  farmaco: string;
  dosis?: string | null;
  momentos: string[];
  critica?: boolean;
  activa?: boolean;
  creada_por?: string | null;
  creado_en?: string;
  desactivada_en?: string | null;
  motivo_discontinuacion?: string | null;
}

export type CheckinInsert = {
  id?: string;
  paciente_id: string;
  fecha: string;
  canal?: CanalCheckin | null;
  estado?: EstadoCheckin;
  dominios_cubiertos?: Json;
  resumen?: string | null;
  riesgo?: NivelRiesgo | null;
  duracion_seg?: number | null;
  audio_path?: string | null;
  finalizado_en?: string | null;
  creado_en?: string;
}

export type MensajeInsert = {
  id?: string;
  checkin_id: string;
  rol: RolMensaje;
  contenido: string;
  orden: number;
  creado_en?: string;
}

export type ObservacionInsert = {
  id?: string;
  checkin_id: string;
  paciente_id: string;
  dominio: DominioObservacion;
  codigo: string;
  valor_num?: number | null;
  valor_texto?: string | null;
  confianza?: number | null;
  origen?: OrigenObservacion;
  creado_en?: string;
}

export type TomaMedicacionInsert = {
  id?: string;
  pauta_id: string;
  paciente_id: string;
  checkin_id?: string | null;
  fecha: string;
  momento: string;
  estado: EstadoToma;
  creado_en?: string;
}

export type ReglaEscaladoInsert = {
  id?: string;
  paciente_id?: string | null;
  vertical?: string | null;
  nombre: string;
  descripcion?: string | null;
  condicion: Json;
  nivel: NivelEscalado;
  activa?: boolean;
  creado_en?: string;
  programa_paciente_id?: string | null;
}

export type AlertaInsert = {
  id?: string;
  paciente_id: string;
  checkin_id?: string | null;
  regla_id?: string | null;
  nivel: NivelEscalado;
  motivo: string;
  evidencia?: Json;
  estado?: EstadoAlerta;
  motivo_descarte?: string | null;
  gestionada_por?: string | null;
  gestionada_en?: string | null;
  creado_en?: string;
}

export type ConsentimientoInsert = {
  id?: string;
  paciente_id: string;
  tipo: TipoConsentimiento;
  otorgado: boolean;
  version_texto: string;
  registrado_en?: string;
  creado_en?: string;
}

export type EventoAuditoriaInsert = {
  id?: string;
  actor_id?: string | null;
  accion: string;
  entidad?: string | null;
  entidad_id?: string | null;
  detalle?: Json;
  creado_en?: string;
}

export type InformeInsert = {
  id?: string;
  paciente_id: string;
  generado_por?: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  resumen?: string | null;
  modelo?: string | null;
  generado_en?: string;
}

export type ProgramaInsert = {
  id?: string;
  clave: string;
  nombre: string;
  descripcion?: string | null;
  version?: number;
  config: Json;
  activo?: boolean;
  creado_en?: string;
}

export type ProgramaPacienteInsert = {
  id?: string;
  paciente_id: string;
  programa_id: string;
  config_override?: Json;
  fase_actual?: number;
  fecha_inicio?: string | null;
  fecha_evento?: string | null;
  estado?: EstadoProgramaPaciente;
  asignado_por?: string | null;
  creado_en?: string;
}

export type CatalogoMotivoInsert = {
  id?: string;
  ambito: AmbitoMotivo;
  codigo: string;
  etiqueta: string;
  activo?: boolean;
  creado_en?: string;
}

export type DisposicionInsert = {
  id?: string;
  alerta_id: string;
  decision: DecisionDisposicion;
  motivo_codigo?: string | null;
  motivo_texto?: string | null;
  dias_seguimiento?: number;
  desenlace?: DesenlaceDisposicion;
  desenlace_nota?: string | null;
  desenlace_registrado_en?: string | null;
  creada_por?: string | null;
  creado_en?: string;
}

// --- Esquema para los genéricos de supabase-js ------------------------------
export type BaseDatos = {
  public: {
    Tables: {
      perfiles: {
        Row: Perfil;
        Insert: PerfilInsert;
        Update: Partial<PerfilInsert>;
        Relationships: [];
      };
      pacientes: {
        Row: Paciente;
        Insert: PacienteInsert;
        Update: Partial<PacienteInsert>;
        Relationships: [];
      };
      pautas_medicacion: {
        Row: PautaMedicacion;
        Insert: PautaMedicacionInsert;
        Update: Partial<PautaMedicacionInsert>;
        Relationships: [];
      };
      checkins: {
        Row: Checkin;
        Insert: CheckinInsert;
        Update: Partial<CheckinInsert>;
        Relationships: [];
      };
      mensajes: {
        Row: Mensaje;
        Insert: MensajeInsert;
        Update: Partial<MensajeInsert>;
        Relationships: [];
      };
      observaciones: {
        Row: Observacion;
        Insert: ObservacionInsert;
        Update: Partial<ObservacionInsert>;
        Relationships: [];
      };
      tomas_medicacion: {
        Row: TomaMedicacion;
        Insert: TomaMedicacionInsert;
        Update: Partial<TomaMedicacionInsert>;
        Relationships: [];
      };
      reglas_escalado: {
        Row: ReglaEscalado;
        Insert: ReglaEscaladoInsert;
        Update: Partial<ReglaEscaladoInsert>;
        Relationships: [];
      };
      alertas: {
        Row: Alerta;
        Insert: AlertaInsert;
        Update: Partial<AlertaInsert>;
        Relationships: [];
      };
      consentimientos: {
        Row: Consentimiento;
        Insert: ConsentimientoInsert;
        Update: Partial<ConsentimientoInsert>;
        Relationships: [];
      };
      eventos_auditoria: {
        Row: EventoAuditoria;
        Insert: EventoAuditoriaInsert;
        Update: Partial<EventoAuditoriaInsert>;
        Relationships: [];
      };
      informes: {
        Row: Informe;
        Insert: InformeInsert;
        Update: Partial<InformeInsert>;
        Relationships: [];
      };
      programas: {
        Row: Programa;
        Insert: ProgramaInsert;
        Update: Partial<ProgramaInsert>;
        Relationships: [];
      };
      programas_paciente: {
        Row: ProgramaPaciente;
        Insert: ProgramaPacienteInsert;
        Update: Partial<ProgramaPacienteInsert>;
        Relationships: [];
      };
      catalogo_motivos: {
        Row: CatalogoMotivo;
        Insert: CatalogoMotivoInsert;
        Update: Partial<CatalogoMotivoInsert>;
        Relationships: [];
      };
      disposiciones: {
        Row: Disposicion;
        Insert: DisposicionInsert;
        Update: Partial<DisposicionInsert>;
        Relationships: [];
      };
    };
    // Vacíos (sin firma de índice `[k: string]`, que colapsaría Tables&Views a
    // `never`). `Record<never, never>` equivale a `{}` con 0 claves.
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
