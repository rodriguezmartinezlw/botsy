-- =====================================================================
-- 0005_deuda_tecnica.sql  (WP-10)
-- Deuda técnica consciente de F1. Migración ADITIVA — no edita migraciones
-- ya entregadas.
--   Ítem 1: pautas_medicacion.desactivada_en (evento fechado de baja de pauta).
--   Ítem 2: endurecer el INSERT de eventos_auditoria a actor_id = auth.uid()
--           (el motor service-role salta RLS: sus filas de sistema con
--            actor_id NULL siguen entrando).
-- =====================================================================

-- --- Ítem 1: fecha de desactivación de pauta -------------------------------
alter table public.pautas_medicacion
  add column if not exists desactivada_en timestamptz;

comment on column public.pautas_medicacion.desactivada_en is
  'Momento en que la pauta se desactivó (activa=false). NULL si está activa. '
  'Alimenta el evento fechado de la línea temporal (WP-10 ítem 1).';

-- --- Ítem 2: endurecer la política de INSERT de auditoría -------------------
-- Antes: with check (auth.uid() is not null) — cualquier autenticado podía
-- insertar una fila atribuida a otro. Ahora solo puede atribuirse a sí mismo.
-- El cron y el motor de escalado usan service-role (bypassean RLS), así que sus
-- inserciones de sistema (actor_id NULL) no dependen de esta política.
drop policy if exists auditoria_insert_autenticado on public.eventos_auditoria;
create policy auditoria_insert_autenticado on public.eventos_auditoria
  for insert to authenticated
  with check (actor_id = auth.uid());
