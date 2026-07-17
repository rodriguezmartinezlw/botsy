-- =====================================================================
-- Botsy — Migración 0020: conversaciones a demanda (WP-24)
--
-- Decisión de producto: el check-in diario sigue siendo LA estructura
-- (1/día, alimenta racha y ficha), pero la persona debe poder hablar con
-- Botsy siempre que lo necesite — un síntoma nuevo a las 22h no espera a
-- mañana. Se modelan AMBOS en la misma tabla `checkins` con una columna
-- `tipo`:
--   - 'checkin'  : el check-in estructurado del día (máx. 1 por día).
--   - 'consulta' : conversación a demanda (sin límite diario).
--
-- RLS: INTACTA. Es la misma tabla `checkins`; las políticas de 0002
-- (checkins_select_propio / _insert_propio / _update_propio /
-- _select_profesional / _admin_todo) filtran por paciente_id, no por tipo,
-- así que cubren las consultas SIN cambios ni políticas nuevas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Columna `tipo`. Default 'checkin' para que las filas existentes (todas
--    check-ins estructurados) queden clasificadas sin migración de datos.
-- ---------------------------------------------------------------------
alter table public.checkins
  add column tipo text not null default 'checkin'
    check (tipo in ('checkin', 'consulta'));

-- ---------------------------------------------------------------------
-- 2) Sustituir la restricción UNIQUE (paciente_id, fecha) de 0001 por un
--    índice único PARCIAL que solo aplica a los check-ins estructurados:
--    un único 'checkin' por paciente y día; las consultas quedan fuera del
--    índice y son ilimitadas.
--
--    La restricción inline de 0001 (`unique (paciente_id, fecha)`) tiene el
--    nombre autogenerado por Postgres `checkins_paciente_id_fecha_key`. Se
--    localiza y elimina de forma ROBUSTA (por sus columnas, no solo por el
--    nombre) para no dejarla activa si en la BD viva estuviera renombrada:
--    de quedar, seguiría bloqueando las consultas del mismo día.
-- ---------------------------------------------------------------------
do $$
declare
  v_con text;
begin
  select con.conname into v_con
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'checkins'
    and con.contype = 'u'
    and (
      -- att.attname es de tipo `name`: se castea a text para comparar con el
      -- array literal (sin el cast: «operator does not exist: name[] = text[]»,
      -- detectado al aplicar en vivo — el parser no ve errores de tipos).
      select array_agg(att.attname::text order by att.attname::text)
      from unnest(con.conkey) as k(attnum)
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = k.attnum
    ) = array['fecha', 'paciente_id']
  limit 1;

  if v_con is not null then
    execute format('alter table public.checkins drop constraint %I', v_con);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Índice único PARCIAL: máximo un check-in estructurado por día. Las
--    consultas (tipo = 'consulta') no entran en el índice → sin límite.
-- ---------------------------------------------------------------------
create unique index if not exists checkins_checkin_diario_unico
  on public.checkins (paciente_id, fecha)
  where tipo = 'checkin';

-- ---------------------------------------------------------------------
-- 4) Índice de apoyo para el historial de la paciente (WP-24 §C): listar y
--    paginar sus sesiones (check-ins + consultas) por fecha descendente.
-- ---------------------------------------------------------------------
create index if not exists idx_checkins_paciente_tipo_fecha
  on public.checkins (paciente_id, tipo, fecha desc);
