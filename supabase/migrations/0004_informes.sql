-- =====================================================================
-- Botsy — Migración 0004: tabla `informes` (WP-07)
-- Trazabilidad de los informes de seguimiento generados por el profesional:
-- guarda el período y el resumen ejecutivo (LLM) de cada informe emitido.
--
-- RLS + políticas en ESTA MISMA migración (CLAUDE.md: ninguna tabla sin RLS).
-- Reutiliza los helpers `es_profesional_de()` / `es_admin()` de 0002_rls.sql.
-- =====================================================================

create table public.informes (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references public.pacientes (id) on delete cascade,
  -- Quién lo generó (profesional/admin). Sin borrado en cascada: la traza
  -- se conserva aunque el perfil se elimine.
  generado_por  uuid references public.perfiles (id) on delete set null,
  periodo_desde date not null,
  periodo_hasta date not null,
  -- Resumen ejecutivo del LLM. Puede ser null si OpenAI falló (informe sin
  -- resumen, con aviso) o si el resumen se descartó por seguridad.
  resumen       text,
  -- Modelo que lo generó (trazabilidad); null si no hubo resumen.
  modelo        text,
  generado_en   timestamptz not null default now(),
  check (periodo_hasta >= periodo_desde)
);

create index idx_informes_paciente on public.informes (paciente_id, generado_en desc);

-- ---------------------------------------------------------------------
-- RLS: sólo el profesional asignado (o admin) ve e inserta informes de
-- sus pacientes. El paciente NO accede (el informe es una herramienta del
-- profesional). `es_profesional_de()` ya incluye a admin.
-- ---------------------------------------------------------------------
alter table public.informes enable row level security;

create policy informes_select_profesional on public.informes
  for select to authenticated
  using (public.es_profesional_de(paciente_id));

create policy informes_insert_profesional on public.informes
  for insert to authenticated
  with check (
    public.es_profesional_de(paciente_id)
    and generado_por = auth.uid()
  );

create policy informes_admin_todo on public.informes
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
