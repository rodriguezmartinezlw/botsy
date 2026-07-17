-- =====================================================================
-- Botsy — Migración 0016: instituciones, país y multi-institución (WP-22).
-- Migración ADITIVA. No edita migraciones ya entregadas (0001..0015).
--
-- Cambio FOUNDATIONAL y CRÍTICO en la RLS (ADR-004): el paciente pasa a
-- pertenecer a una INSTITUCIÓN y la VISIBILIDAD del profesional deja de ser
-- "mis pacientes asignados (profesional_id)" para ser "los pacientes de mi(s)
-- institución(es)". Se logra REDEFINIENDO el helper existente
-- `es_profesional_de(p_paciente)` (misma firma / security definer): así TODAS
-- las políticas que ya lo usan heredan el nuevo modelo sin reescribirse una a una.
--
-- `pacientes.profesional_id` se CONSERVA, pero pasa a significar SOLO "médico
-- responsable" (contacto / escalado / notificación); ya NO controla el acceso.
--
-- RLS + políticas de las tablas nuevas EN ESTA MISMA migración (CLAUDE.md).
-- Índices de FK siguiendo la práctica de 0015.
--
-- IMPORTANTE (residencia de datos): el backfill de `pacientes.institucion_id`
-- se hace en el SEED (supabase/seed.sql + seed_wp06), no aquí, para no acoplar
-- la migración a datos concretos. Un paciente SIN institución NO es visible para
-- ningún profesional (consecuencia deliberada del modelo por institución): el
-- enrolamiento (WP-20) exige institución al dar de alta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) paises — catálogo pequeño (ISO-3166 alfa-2). Admin gestiona.
-- ---------------------------------------------------------------------
create table public.paises (
  codigo    text primary key check (codigo ~ '^[A-Z]{2}$'),
  nombre    text not null,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) instituciones — clínica / hospital / centro que atiende pacientes.
-- ---------------------------------------------------------------------
create table public.instituciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  tipo        text not null default 'clinica'
                check (tipo in ('hospital', 'clinica', 'centro_oncologico', 'otro')),
  pais_codigo text not null references public.paises (codigo),
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) profesionales_instituciones (M:N) — un profesional puede trabajar en
--    varias instituciones; una institución tiene varios profesionales.
-- ---------------------------------------------------------------------
create table public.profesionales_instituciones (
  id             uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.perfiles (id) on delete cascade,
  institucion_id uuid not null references public.instituciones (id) on delete cascade,
  activa         boolean not null default true,
  creado_en      timestamptz not null default now(),
  unique (profesional_id, institucion_id)
);

-- ---------------------------------------------------------------------
-- 4) pacientes.institucion_id — el paciente pertenece a una institución.
--    Nullable en la migración; backfill en el seed. `on delete set null`
--    (no borra al paciente si se elimina la institución).
-- ---------------------------------------------------------------------
alter table public.pacientes
  add column if not exists institucion_id uuid
    references public.instituciones (id) on delete set null;

comment on column public.pacientes.institucion_id is
  'Institución a la que pertenece el paciente (WP-22). Determina la VISIBILIDAD '
  'del profesional vía es_profesional_de(). profesional_id queda como médico responsable.';

comment on column public.pacientes.profesional_id is
  'Médico responsable (contacto / escalado / notificación). Desde WP-22 NO controla '
  'la visibilidad: el acceso es por institución (profesionales_instituciones).';

-- ---------------------------------------------------------------------
-- 5) programas_patrocinados — dimensión país/institución OPCIONAL (WP-22 §6).
--    NULL = toda la cohorte financiada (comportamiento previo). Las RPC de
--    agregados ganan un filtro opcional por institución/país en la migración
--    0017, manteniendo la k-anonimización >= 5.
-- ---------------------------------------------------------------------
alter table public.programas_patrocinados
  add column if not exists pais_codigo    text references public.paises (codigo);
alter table public.programas_patrocinados
  add column if not exists institucion_id uuid references public.instituciones (id) on delete set null;

comment on column public.programas_patrocinados.pais_codigo is
  'Dimensión país OPCIONAL de la cohorte financiada (WP-22 §6). NULL = todos los países.';
comment on column public.programas_patrocinados.institucion_id is
  'Dimensión institución OPCIONAL de la cohorte financiada (WP-22 §6). NULL = todas.';

-- ---------------------------------------------------------------------
-- Índices de FK (práctica de 0015: toda columna FK con índice de cobertura).
-- ---------------------------------------------------------------------
create index if not exists idx_instituciones_pais       on public.instituciones (pais_codigo);
create index if not exists idx_prof_inst_profesional     on public.profesionales_instituciones (profesional_id);
create index if not exists idx_prof_inst_institucion     on public.profesionales_instituciones (institucion_id);
create index if not exists idx_pacientes_institucion     on public.pacientes (institucion_id);
create index if not exists idx_prog_patroc_institucion   on public.programas_patrocinados (institucion_id);
create index if not exists idx_prog_patroc_pais          on public.programas_patrocinados (pais_codigo);

-- =====================================================================
-- RLS — tablas nuevas (CLAUDE.md: RLS en TODAS las tablas, en su migración).
-- =====================================================================
alter table public.paises                      enable row level security;
alter table public.instituciones               enable row level security;
alter table public.profesionales_instituciones enable row level security;

-- --- paises: catálogo legible por profesional/admin; escritura admin. ---------
create policy paises_select_profesional on public.paises
  for select to authenticated using (public.es_profesional_o_admin());
create policy paises_admin_todo on public.paises
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- --- instituciones: catálogo legible por profesional/admin; escritura admin. --
create policy instituciones_select_profesional on public.instituciones
  for select to authenticated using (public.es_profesional_o_admin());
create policy instituciones_admin_todo on public.instituciones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- --- profesionales_instituciones: el profesional ve SUS membresías; admin todo.
create policy prof_inst_select_propio on public.profesionales_instituciones
  for select to authenticated using (profesional_id = auth.uid());
create policy prof_inst_admin_todo on public.profesionales_instituciones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- RLS — el punto CRÍTICO: reescritura de es_profesional_de (ADR-004).
--
-- Se REDEFINE el helper conservando nombre, firma, `security definer`, `stable`
-- y `set search_path = public`. A partir de aquí, "este profesional gestiona a
-- este paciente" significa: es admin, O comparte una institución con el paciente
-- vía una membresía ACTIVA en profesionales_instituciones. Todas las políticas
-- de 0002/0006/0011 que llaman a es_profesional_de heredan este modelo.
--
-- Consecuencia deliberada: un profesional ve a TODOS los pacientes de su(s)
-- institución(es), no solo a los de su profesional_id (equipo de la institución).
-- Un paciente sin institución no es visible para ningún profesional.
-- =====================================================================
create or replace function public.es_profesional_de(p_paciente uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.es_admin()
      or exists (
        select 1
        from public.profesionales_instituciones pi
        join public.pacientes pac on pac.institucion_id = pi.institucion_id
        where pac.id = p_paciente
          and pi.profesional_id = auth.uid()
          and pi.activa
      );
$$;
