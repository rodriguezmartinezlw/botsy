-- =====================================================================
-- Botsy — Migración 0009: rol `patrocinador` + patrocinadores + cohortes
--                          financiadas (WP-17, PLAN §4.6, §5).
-- Migración ADITIVA. No edita migraciones ya entregadas (0001..0008).
--
--   - `perfiles.rol` amplía el check con 'patrocinador'.
--   - `patrocinadores`           : la organización patrocinadora (farma/pagador).
--   - `perfiles.patrocinador_id` : a qué patrocinador pertenece un usuario
--                                  con rol 'patrocinador' (NULL en el resto).
--   - `programas_patrocinados`   : qué programa/cohorte financia cada
--                                  patrocinador (la unidad de agregación).
--   - Helpers `es_patrocinador()` y `patrocinador_del_usuario()`.
--
-- ============================ CLAVE DE PRIVACIDAD ============================
-- El rol `patrocinador` NO recibe NINGUNA política de lectura sobre las tablas
-- de pacientes (perfiles ajenos, pacientes, checkins, observaciones, tomas,
-- alertas, disposiciones, etc.). Este archivo NO añade ni una sola política de
-- lectura de patrocinador a esas tablas — y por diseño no debe hacerlo nunca.
-- Su ÚNICO acceso a datos clínicos es a través de las funciones RPC
-- `security definer` de la migración 0010, que devuelven SOLO agregados con
-- k-anonimato >= 5. Un usuario patrocinador ejecutando `select * from pacientes`
-- obtiene 0 filas (ninguna política le concede acceso; `es_admin()`,
-- `es_profesional_de()` y `es_profesional_o_admin()` son todas false para él).
-- (Regla de oro de CLAUDE.md + PLAN §7; verificado por auditoria.test.ts y por
--  el escenario de patrocinador de supabase/tests/acceso_cruzado.sql.)
-- ============================================================================
--
-- RLS + políticas EN ESTA MISMA migración (CLAUDE.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- perfiles.rol: ampliar el check con 'patrocinador'.
-- (El check inline de 0001 se llama perfiles_rol_check.)
-- ---------------------------------------------------------------------
alter table public.perfiles
  drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('paciente', 'profesional', 'admin', 'patrocinador'));

-- ---------------------------------------------------------------------
-- patrocinadores — organización que financia programas (farma / pagador).
-- Sin datos clínicos: solo la identidad del patrocinador.
-- ---------------------------------------------------------------------
create table public.patrocinadores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  tipo      text not null default 'laboratorio'
              check (tipo in ('laboratorio', 'pagador', 'fundacion', 'otro')),
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- perfiles.patrocinador_id — a qué patrocinador pertenece el usuario. NULL en
-- pacientes / profesionales / admin. FK con on delete set null (no borra el
-- perfil si se elimina el patrocinador).
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists patrocinador_id uuid
    references public.patrocinadores (id) on delete set null;

comment on column public.perfiles.patrocinador_id is
  'Patrocinador (organización) al que pertenece un usuario con rol patrocinador. '
  'NULL para el resto de roles. Determina el alcance de las RPC de agregados (0010).';

-- ---------------------------------------------------------------------
-- programas_patrocinados — qué programa/cohorte financia un patrocinador.
-- Es la unidad de agregación: las RPC solo agregan pacientes cuyos programas
-- estén en esta tabla para el patrocinador que llama.
-- `etiqueta_cohorte` permite nombrar una sub-cohorte (opcional, informativa).
-- ---------------------------------------------------------------------
create table public.programas_patrocinados (
  id               uuid primary key default gen_random_uuid(),
  patrocinador_id  uuid not null references public.patrocinadores (id) on delete cascade,
  programa_id      uuid not null references public.programas (id) on delete cascade,
  etiqueta_cohorte text,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  unique (patrocinador_id, programa_id)
);

create index idx_programas_patrocinados_patro
  on public.programas_patrocinados (patrocinador_id, activo);

-- ---------------------------------------------------------------------
-- pautas_medicacion.discontinuada_en (PLAN §4.3) — fecha (date) de la
-- discontinuación clínica. Complementa `desactivada_en` (timestamptz, WP-10,
-- baja genérica) y `motivo_discontinuacion` (WP-11 §C.4). Alimenta las curvas
-- de persistencia del dashboard del patrocinador (WP-17).
--
-- NOTA (discrepancia detectada): el PLAN §4.3 pedía añadir `discontinuada_en`
-- junto a `motivo_discontinuacion`, pero la migración 0007 (WP-11 v2) solo
-- añadió `motivo_discontinuacion`. Se subsana aquí de forma ADITIVA (no edita
-- migraciones commiteadas). El código de la app que discontinúa una pauta puede
-- rellenar `discontinuada_en` con la fecha del evento; si quedara NULL en una
-- pauta ya inactiva, la persistencia la trata como aún vigente (conservador).
-- ---------------------------------------------------------------------
alter table public.pautas_medicacion
  add column if not exists discontinuada_en date;

comment on column public.pautas_medicacion.discontinuada_en is
  'Fecha de discontinuación clínica (PLAN §4.3). Complementa desactivada_en '
  '(timestamptz, WP-10) y motivo_discontinuacion (WP-11). Alimenta persistencia (WP-17).';

-- ---------------------------------------------------------------------
-- Helpers de rol (security definer para no chocar con la propia RLS).
-- ---------------------------------------------------------------------

-- ¿El usuario actual tiene rol patrocinador?
create or replace function public.es_patrocinador()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'patrocinador'
  );
$$;

-- Patrocinador (organización) al que pertenece el usuario actual, o NULL.
create or replace function public.patrocinador_del_usuario()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select patrocinador_id from public.perfiles where id = auth.uid();
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.patrocinadores          enable row level security;
alter table public.programas_patrocinados  enable row level security;

-- --- patrocinadores: el usuario patrocinador ve SOLO su propia organización.
-- Escritura: solo admin. (El patrocinador NO ve otros patrocinadores.)
create policy patrocinadores_select_propio on public.patrocinadores
  for select to authenticated
  using (id = public.patrocinador_del_usuario());
create policy patrocinadores_admin_todo on public.patrocinadores
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- --- programas_patrocinados: el patrocinador ve SOLO las cohortes que financia
-- (metadatos: qué programa, no datos de pacientes). Escritura: solo admin.
create policy programas_patrocinados_select_propio on public.programas_patrocinados
  for select to authenticated
  using (patrocinador_id = public.patrocinador_del_usuario());
create policy programas_patrocinados_admin_todo on public.programas_patrocinados
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- Trigger de alta de usuario: admitir el rol 'patrocinador'. Se REDEFINE la
-- función de 0001 (create or replace; no edita la migración 0001). Un
-- patrocinador NO obtiene fila en `pacientes` (no es sujeto clínico).
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
  if v_rol not in ('paciente', 'profesional', 'admin', 'patrocinador') then
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
