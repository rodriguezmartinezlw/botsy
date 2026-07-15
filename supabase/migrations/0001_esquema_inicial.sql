-- =====================================================================
-- Botsy — Migración 0001: esquema inicial de F1
-- Identificadores en español y snake_case (CLAUDE.md).
-- Todas las tablas: id uuid PK default gen_random_uuid(),
-- creado_en timestamptz default now() (salvo indicación del WP-01).
-- RLS y políticas se activan en 0002_rls.sql (misma entrega WP-01).
-- =====================================================================

-- pgcrypto: necesaria para crypt()/gen_salt() en supabase/seed.sql.
-- (gen_random_uuid() es nativa de Postgres 13+, pero mantenemos la extensión
--  disponible para el seed de usuarios demo.)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- perfiles — 1:1 con auth.users. Rol del usuario en la plataforma.
-- ---------------------------------------------------------------------
create table public.perfiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  rol          text not null check (rol in ('paciente', 'profesional', 'admin')),
  nombre       text not null,
  telefono     text,
  avatar_url   text,
  idioma       text not null default 'es',
  zona_horaria text not null default 'Europe/Madrid',
  creado_en    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- pacientes — extensión clínica del perfil (id = perfiles.id).
-- ---------------------------------------------------------------------
create table public.pacientes (
  id               uuid primary key references public.perfiles (id) on delete cascade,
  fecha_nacimiento date,
  sexo             text,
  vertical         text not null default 'general'
                     check (vertical in ('cardiovascular', 'cronica', 'geriatrica',
                                         'mental', 'ocupacional', 'general')),
  condiciones      text[] not null default '{}',
  profesional_id   uuid references public.perfiles (id) on delete set null,
  telefono_medico  text,
  hora_checkin     time not null default '10:00',
  racha_actual     int not null default 0,
  racha_maxima     int not null default 0,
  ultimo_checkin   date,
  creado_en        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- pautas_medicacion — prescripción activa de un paciente.
-- ---------------------------------------------------------------------
create table public.pautas_medicacion (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  farmaco     text not null,
  dosis       text,
  momentos    text[] not null,              -- valores: mañana | mediodía | noche
  critica     boolean not null default false, -- p. ej. anticoagulantes
  activa      boolean not null default true,
  creada_por  uuid references public.perfiles (id) on delete set null,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- checkins — sesión diaria de check-in (texto o voz).
-- ---------------------------------------------------------------------
create table public.checkins (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references public.pacientes (id) on delete cascade,
  fecha              date not null,
  canal              text check (canal in ('texto', 'voz')),
  estado             text not null default 'en_curso'
                       check (estado in ('en_curso', 'completado', 'abandonado')),
  dominios_cubiertos jsonb not null default '{}',
  resumen            text,
  riesgo             text check (riesgo in ('normal', 'vigilancia', 'contactar', 'urgencia')),
  duracion_seg       int,
  audio_path         text,
  finalizado_en      timestamptz,
  creado_en          timestamptz not null default now(),
  unique (paciente_id, fecha)
);

-- ---------------------------------------------------------------------
-- mensajes — turnos de conversación de un check-in.
-- ---------------------------------------------------------------------
create table public.mensajes (
  id         uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  rol        text not null check (rol in ('asistente', 'paciente')),
  contenido  text not null,
  orden      int not null,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- observaciones — datos clínicos extraídos (paciente_id desnormalizado).
-- ---------------------------------------------------------------------
create table public.observaciones (
  id          uuid primary key default gen_random_uuid(),
  checkin_id  uuid not null references public.checkins (id) on delete cascade,
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  dominio     text not null check (dominio in ('dolor', 'sintoma_fisico', 'animo',
                                               'ansiedad', 'estres', 'sueno', 'cognicion',
                                               'adherencia', 'tratamiento', 'habitos')),
  codigo      text not null,                 -- etiqueta corta, p. ej. dolor_cabeza
  valor_num   numeric,
  valor_texto text,
  confianza   numeric check (confianza between 0 and 1),
  origen      text not null default 'conversacion'
                check (origen in ('conversacion', 'reconciliacion')),
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- tomas_medicacion — adherencia diaria por pauta y momento.
-- ---------------------------------------------------------------------
create table public.tomas_medicacion (
  id          uuid primary key default gen_random_uuid(),
  pauta_id    uuid not null references public.pautas_medicacion (id) on delete cascade,
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  checkin_id  uuid references public.checkins (id) on delete set null,
  fecha       date not null,
  momento     text not null,                 -- mañana | mediodía | noche
  estado      text not null check (estado in ('tomada', 'omitida', 'desconocido')),
  creado_en   timestamptz not null default now(),
  unique (pauta_id, fecha, momento)
);

-- ---------------------------------------------------------------------
-- reglas_escalado — reglas del motor (global si paciente_id null).
-- El formato de `condicion` (JSONB) está definido en WP-04.
-- ---------------------------------------------------------------------
create table public.reglas_escalado (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes (id) on delete cascade, -- null = regla global
  vertical    text,                          -- null = aplica a cualquier vertical
  nombre      text not null,
  descripcion text,
  condicion   jsonb not null,
  nivel       text not null check (nivel in ('vigilancia', 'contactar', 'urgencia')),
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- alertas — señal para el profesional generada por el motor de escalado.
-- ---------------------------------------------------------------------
create table public.alertas (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid not null references public.pacientes (id) on delete cascade,
  checkin_id      uuid references public.checkins (id) on delete set null,
  regla_id        uuid references public.reglas_escalado (id) on delete set null,
  nivel           text not null check (nivel in ('vigilancia', 'contactar', 'urgencia')),
  motivo          text not null,
  evidencia       jsonb not null default '{}',
  estado          text not null default 'nueva'
                    check (estado in ('nueva', 'vista', 'resuelta', 'descartada')),
  motivo_descarte text,
  gestionada_por  uuid references public.perfiles (id) on delete set null,
  gestionada_en   timestamptz,
  creado_en       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- consentimientos — histórico append-only (vigente = último por tipo).
-- ---------------------------------------------------------------------
create table public.consentimientos (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references public.pacientes (id) on delete cascade,
  tipo          text not null check (tipo in ('conversacion', 'voz_grabacion', 'voz_biomarcadores')),
  otorgado      boolean not null,
  version_texto text not null,
  registrado_en timestamptz not null default now(),
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- eventos_auditoria — bitácora append-only (solo INSERT por políticas).
-- actor_id sin FK a propósito: la traza se conserva aunque el usuario
-- se elimine (buena práctica de auditoría).
-- ---------------------------------------------------------------------
create table public.eventos_auditoria (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  accion     text not null,
  entidad    text,
  entidad_id uuid,
  detalle    jsonb not null default '{}',
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Índices (WP-01).
-- ---------------------------------------------------------------------
create index idx_checkins_paciente_fecha       on public.checkins (paciente_id, fecha desc);
create index idx_observaciones_pac_dom_fecha   on public.observaciones (paciente_id, dominio, creado_en desc);
create index idx_alertas_estado_nivel          on public.alertas (estado, nivel);
create index idx_tomas_paciente_fecha          on public.tomas_medicacion (paciente_id, fecha desc);
create index idx_mensajes_checkin_orden        on public.mensajes (checkin_id, orden);

-- ---------------------------------------------------------------------
-- Trigger: al crear un usuario en auth.users, crear su perfil (y su fila
-- de paciente si el rol es paciente). Rol/nombre desde raw_user_meta_data.
-- ---------------------------------------------------------------------
create or replace function public.gestionar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol    text;
  v_nombre text;
begin
  v_rol := coalesce(new.raw_user_meta_data->>'rol', 'paciente');
  if v_rol not in ('paciente', 'profesional', 'admin') then
    v_rol := 'paciente';
  end if;

  v_nombre := coalesce(nullif(new.raw_user_meta_data->>'nombre', ''),
                       split_part(new.email, '@', 1));

  insert into public.perfiles (id, rol, nombre)
  values (new.id, v_rol, v_nombre)
  on conflict (id) do nothing;

  if v_rol = 'paciente' then
    insert into public.pacientes (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.gestionar_nuevo_usuario();
