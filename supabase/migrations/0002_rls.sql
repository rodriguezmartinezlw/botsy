-- =====================================================================
-- Botsy — Migración 0002: RLS + políticas + storage
-- RLS habilitada en TODAS las tablas (CLAUDE.md). Ninguna tabla sin
-- políticas en esta misma entrega (WP-01).
--
-- Modelo:
--   Paciente     -> solo sus propias filas (auth.uid() = paciente_id | id).
--                   Nunca DELETE. No toca reglas_escalado. Solo SELECT de
--                   sus alertas. consentimientos: append-only (INSERT+SELECT).
--   Profesional  -> SELECT de los datos de sus pacientes asignados;
--                   INSERT/UPDATE de pautas_medicacion, reglas_escalado de
--                   sus pacientes y gestión (UPDATE) de alertas.
--   Admin        -> todo.
-- Las políticas se restringen al rol `authenticated` (anon queda sin acceso).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones helper (security definer para no chocar con la propia RLS).
-- ---------------------------------------------------------------------

-- ¿El usuario actual es admin?
create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- ¿El usuario actual es el profesional asignado del paciente (o admin)?
create or replace function public.es_profesional_de(p_paciente uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.es_admin()
      or exists (
        select 1 from public.pacientes
        where id = p_paciente and profesional_id = auth.uid()
      );
$$;

-- Paciente dueño de un check-in (para tablas sin paciente_id como mensajes).
create or replace function public.paciente_de_checkin(p_checkin uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select paciente_id from public.checkins where id = p_checkin;
$$;

-- ---------------------------------------------------------------------
-- Habilitar RLS en TODAS las tablas.
-- ---------------------------------------------------------------------
alter table public.perfiles          enable row level security;
alter table public.pacientes         enable row level security;
alter table public.pautas_medicacion enable row level security;
alter table public.checkins          enable row level security;
alter table public.mensajes          enable row level security;
alter table public.observaciones     enable row level security;
alter table public.tomas_medicacion  enable row level security;
alter table public.reglas_escalado   enable row level security;
alter table public.alertas           enable row level security;
alter table public.consentimientos   enable row level security;
alter table public.eventos_auditoria enable row level security;

-- =====================================================================
-- perfiles
-- =====================================================================
create policy perfiles_select_propio on public.perfiles
  for select to authenticated using (id = auth.uid());
create policy perfiles_update_propio on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy perfiles_select_profesional on public.perfiles
  for select to authenticated using (public.es_profesional_de(id));
create policy perfiles_admin_todo on public.perfiles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- pacientes
-- =====================================================================
create policy pacientes_select_propio on public.pacientes
  for select to authenticated using (id = auth.uid());
create policy pacientes_insert_propio on public.pacientes
  for insert to authenticated with check (id = auth.uid());
create policy pacientes_update_propio on public.pacientes
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy pacientes_select_profesional on public.pacientes
  for select to authenticated using (public.es_profesional_de(id));
create policy pacientes_admin_todo on public.pacientes
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- pautas_medicacion
--   Paciente: SELECT de las suyas (SOLO lectura: el paciente NO se auto-prescribe;
--             la medicación la pauta el profesional. Regla clínica de CLAUDE.md).
--   Profesional: SELECT/INSERT/UPDATE de las de sus pacientes.
-- =====================================================================
create policy pautas_select_propio on public.pautas_medicacion
  for select to authenticated using (paciente_id = auth.uid());
create policy pautas_select_profesional on public.pautas_medicacion
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy pautas_insert_profesional on public.pautas_medicacion
  for insert to authenticated with check (public.es_profesional_de(paciente_id));
create policy pautas_update_profesional on public.pautas_medicacion
  for update to authenticated using (public.es_profesional_de(paciente_id)) with check (public.es_profesional_de(paciente_id));
create policy pautas_admin_todo on public.pautas_medicacion
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- checkins
-- =====================================================================
create policy checkins_select_propio on public.checkins
  for select to authenticated using (paciente_id = auth.uid());
create policy checkins_insert_propio on public.checkins
  for insert to authenticated with check (paciente_id = auth.uid());
create policy checkins_update_propio on public.checkins
  for update to authenticated using (paciente_id = auth.uid()) with check (paciente_id = auth.uid());
create policy checkins_select_profesional on public.checkins
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy checkins_admin_todo on public.checkins
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- mensajes (dueño resuelto vía paciente_de_checkin)
-- =====================================================================
create policy mensajes_select_propio on public.mensajes
  for select to authenticated using (public.paciente_de_checkin(checkin_id) = auth.uid());
create policy mensajes_insert_propio on public.mensajes
  for insert to authenticated with check (public.paciente_de_checkin(checkin_id) = auth.uid());
create policy mensajes_update_propio on public.mensajes
  for update to authenticated
  using (public.paciente_de_checkin(checkin_id) = auth.uid())
  with check (public.paciente_de_checkin(checkin_id) = auth.uid());
create policy mensajes_select_profesional on public.mensajes
  for select to authenticated using (public.es_profesional_de(public.paciente_de_checkin(checkin_id)));
create policy mensajes_admin_todo on public.mensajes
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- observaciones
-- =====================================================================
create policy observaciones_select_propio on public.observaciones
  for select to authenticated using (paciente_id = auth.uid());
create policy observaciones_insert_propio on public.observaciones
  for insert to authenticated with check (paciente_id = auth.uid());
create policy observaciones_update_propio on public.observaciones
  for update to authenticated using (paciente_id = auth.uid()) with check (paciente_id = auth.uid());
create policy observaciones_select_profesional on public.observaciones
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy observaciones_admin_todo on public.observaciones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- tomas_medicacion
-- =====================================================================
create policy tomas_select_propio on public.tomas_medicacion
  for select to authenticated using (paciente_id = auth.uid());
create policy tomas_insert_propio on public.tomas_medicacion
  for insert to authenticated with check (paciente_id = auth.uid());
create policy tomas_update_propio on public.tomas_medicacion
  for update to authenticated using (paciente_id = auth.uid()) with check (paciente_id = auth.uid());
create policy tomas_select_profesional on public.tomas_medicacion
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy tomas_admin_todo on public.tomas_medicacion
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- reglas_escalado
--   Paciente: SIN acceso (ninguna política aplica).
--   Profesional: SELECT globales + de sus pacientes; INSERT/UPDATE solo
--                de sus pacientes (las globales las gestiona el admin).
--   Admin: todo.
-- =====================================================================
create policy reglas_select_profesional on public.reglas_escalado
  for select to authenticated
  using (paciente_id is null or public.es_profesional_de(paciente_id));
create policy reglas_insert_profesional on public.reglas_escalado
  for insert to authenticated
  with check (paciente_id is not null and public.es_profesional_de(paciente_id));
create policy reglas_update_profesional on public.reglas_escalado
  for update to authenticated
  using (paciente_id is not null and public.es_profesional_de(paciente_id))
  with check (paciente_id is not null and public.es_profesional_de(paciente_id));
create policy reglas_admin_todo on public.reglas_escalado
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- alertas
--   Paciente: solo SELECT de las suyas.
--   Profesional: SELECT + UPDATE (gestión) de las de sus pacientes.
--   Admin: todo. (La creación la hace el motor de escalado con service role.)
-- =====================================================================
create policy alertas_select_propio on public.alertas
  for select to authenticated using (paciente_id = auth.uid());
create policy alertas_select_profesional on public.alertas
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy alertas_update_profesional on public.alertas
  for update to authenticated
  using (public.es_profesional_de(paciente_id))
  with check (public.es_profesional_de(paciente_id));
create policy alertas_admin_todo on public.alertas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- consentimientos (append-only: INSERT + SELECT, sin UPDATE/DELETE)
-- =====================================================================
create policy consentimientos_select_propio on public.consentimientos
  for select to authenticated using (paciente_id = auth.uid());
create policy consentimientos_insert_propio on public.consentimientos
  for insert to authenticated with check (paciente_id = auth.uid());
create policy consentimientos_select_profesional on public.consentimientos
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy consentimientos_admin_select on public.consentimientos
  for select to authenticated using (public.es_admin());
-- Admin puede consultar y añadir (append); no se permite UPDATE/DELETE a
-- nadie para preservar el histórico append-only.
create policy consentimientos_admin_insert on public.consentimientos
  for insert to authenticated with check (public.es_admin());

-- =====================================================================
-- eventos_auditoria (append-only: INSERT autenticados, SELECT solo admin)
-- =====================================================================
create policy auditoria_insert_autenticado on public.eventos_auditoria
  for insert to authenticated with check (auth.uid() is not null);
create policy auditoria_select_admin on public.eventos_auditoria
  for select to authenticated using (public.es_admin());

-- =====================================================================
-- Storage: bucket privado de audios de check-in.
--   El paciente sube a `{su_id}/...`; la lectura es solo del profesional
--   asignado o admin (WP-01).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('audios-checkin', 'audios-checkin', false)
on conflict (id) do nothing;

-- El paciente sube archivos dentro de su propia carpeta (primer segmento = su id).
create policy audios_insert_paciente on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'audios-checkin'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura solo del profesional asignado del dueño de la carpeta (o admin).
create policy audios_select_profesional on storage.objects
  for select to authenticated
  using (
    bucket_id = 'audios-checkin'
    and public.es_profesional_de(((storage.foldername(name))[1])::uuid)
  );
