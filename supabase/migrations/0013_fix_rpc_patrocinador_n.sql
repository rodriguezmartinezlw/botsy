-- =====================================================================
-- 0013_fix_rpc_patrocinador_n.sql  (WP-09 — corrección del director)
--
-- Hallazgo de la verificación EN VIVO (WP-09): 5 RPC del patrocinador declaran
-- una columna de salida `n` (`returns table (... n integer ...)`) y en el cuerpo
-- referencian `(select n from npac)`; en PL/pgSQL eso es AMBIGUO (¿la variable de
-- salida `n` o la columna `n` de la CTE?) → «column reference "n" is ambiguous».
-- El modo demo del dashboard usa datos sintéticos en TS y NO ejecuta estas RPC,
-- por eso el bug no se detectó hasta ejecutar contra la BD real.
--
-- Fix: `#variable_conflict use_column` — resuelve los nombres en conflicto hacia
-- la COLUMNA (que es lo que todas estas referencias quieren). Es seguro: estas
-- funciones usan `return query` y NUNCA leen las variables de salida. Se recrean
-- idénticas a 0010 salvo esa línea. No edita 0010 (commiteada). Las funciones sin
-- columna de salida `n` (resumen_cohorte, adherencia_mensual, motivos, alertas)
-- no se ven afectadas.
-- =====================================================================

create or replace function public.patro_persistencia(p_programa_id uuid default null)
returns table (mes integer, tasa numeric, n integer)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
begin
  if not (public.es_patrocinador() or public.es_admin()) then
    return;
  end if;

  return query
  with prog as (
    select pp.programa_id
    from public.programas_patrocinados pp
    where pp.patrocinador_id = public.patrocinador_del_usuario()
      and pp.activo
      and (p_programa_id is null or pp.programa_id = p_programa_id)
  ),
  cohorte as (
    select distinct ppac.paciente_id as pid
    from public.programas_paciente ppac
    join prog on prog.programa_id = ppac.programa_id
  ),
  p as (
    select pm.creado_en, pm.discontinuada_en
    from public.pautas_medicacion pm
    join cohorte on cohorte.pid = pm.paciente_id
  ),
  tot as (select count(*)::numeric as c from p),
  npac as (select count(*)::int as n from cohorte)
  select
    m.mes,
    round(
      (select count(*) from p
        where p.discontinuada_en is null
           or p.discontinuada_en >= p.creado_en + make_interval(months => m.mes)
      )::numeric / nullif((select c from tot), 0) * 100, 1) as tasa,
    (select n from npac) as n
  from generate_series(0, 6) as m(mes)
  where (select n from npac) >= 5;   -- k-anonimato: cohorte < 5 => sin filas
end;
$$;

create or replace function public.patro_meses_tratamiento(p_programa_id uuid default null)
returns table (
  mediana numeric, p25 numeric, p75 numeric, n integer, datos_insuficientes boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
begin
  if not (public.es_patrocinador() or public.es_admin()) then
    return;
  end if;

  return query
  with prog as (
    select pp.programa_id
    from public.programas_patrocinados pp
    where pp.patrocinador_id = public.patrocinador_del_usuario()
      and pp.activo
      and (p_programa_id is null or pp.programa_id = p_programa_id)
  ),
  cohorte as (
    select distinct ppac.paciente_id as pid
    from public.programas_paciente ppac
    join prog on prog.programa_id = ppac.programa_id
  ),
  p as (
    select extract(epoch from (coalesce(pm.discontinuada_en, now()) - pm.creado_en))
             / 86400.0 / 30.0 as meses
    from public.pautas_medicacion pm
    join cohorte on cohorte.pid = pm.paciente_id
  ),
  npac as (select count(*)::int as n from cohorte)
  select
    case when (select n from npac) >= 5
      then round((percentile_cont(0.5) within group (order by p.meses))::numeric, 1) end,
    case when (select n from npac) >= 5
      then round((percentile_cont(0.25) within group (order by p.meses))::numeric, 1) end,
    case when (select n from npac) >= 5
      then round((percentile_cont(0.75) within group (order by p.meses))::numeric, 1) end,
    case when (select n from npac) >= 5 then (select n from npac) end,
    ((select n from npac) < 5)
  from p;
end;
$$;

create or replace function public.patro_tasa_checkin(p_programa_id uuid default null)
returns table (tasa numeric, n integer, datos_insuficientes boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
begin
  if not (public.es_patrocinador() or public.es_admin()) then
    return;
  end if;

  return query
  with prog as (
    select pp.programa_id
    from public.programas_patrocinados pp
    where pp.patrocinador_id = public.patrocinador_del_usuario()
      and pp.activo
      and (p_programa_id is null or pp.programa_id = p_programa_id)
  ),
  cohorte as (
    select distinct ppac.paciente_id as pid
    from public.programas_paciente ppac
    join prog on prog.programa_id = ppac.programa_id
  ),
  npac as (select count(*)::int as n from cohorte),
  dias as (
    select count(*)::numeric as d
    from (
      select distinct ck.paciente_id, ck.fecha
      from public.checkins ck
      join cohorte on cohorte.pid = ck.paciente_id
      where ck.estado = 'completado'
        and ck.fecha >= (current_date - 29)
    ) x
  )
  select
    case when (select n from npac) >= 5
      then round((select d from dias) / nullif((select n from npac) * 30, 0) * 100, 1) end,
    case when (select n from npac) >= 5 then (select n from npac) end,
    ((select n from npac) < 5);
end;
$$;

create or replace function public.patro_tiempo_hasta_disposicion(p_programa_id uuid default null)
returns table (mediana_horas numeric, n integer, datos_insuficientes boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
begin
  if not (public.es_patrocinador() or public.es_admin()) then
    return;
  end if;

  return query
  with prog as (
    select pp.programa_id
    from public.programas_patrocinados pp
    where pp.patrocinador_id = public.patrocinador_del_usuario()
      and pp.activo
      and (p_programa_id is null or pp.programa_id = p_programa_id)
  ),
  cohorte as (
    select distinct ppac.paciente_id as pid
    from public.programas_paciente ppac
    join prog on prog.programa_id = ppac.programa_id
  ),
  d as (
    select extract(epoch from (disp.creado_en - a.creado_en)) / 3600.0 as horas
    from public.disposiciones disp
    join public.alertas a on a.id = disp.alerta_id
    join cohorte on cohorte.pid = a.paciente_id
  ),
  nd as (select count(*)::int as n from d)
  select
    case when (select n from nd) >= 5
      then round((percentile_cont(0.5) within group (order by d.horas))::numeric, 1) end,
    case when (select n from nd) >= 5 then (select n from nd) end,
    ((select n from nd) < 5)
  from d;
end;
$$;

create or replace function public.patro_roi(p_programa_id uuid default null)
returns table (
  pacientes_mes           numeric,
  urgencias_evitadas      integer,
  urgencias_evitadas_100  numeric,
  horas_senal_alerta      numeric,
  horas_alerta_disposicion numeric,
  tasa_checkin            numeric,
  persistencia_pct        numeric,
  n                       integer,
  datos_insuficientes     boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
#variable_conflict use_column
begin
  if not (public.es_patrocinador() or public.es_admin()) then
    return;
  end if;

  return query
  with prog as (
    select pp.programa_id
    from public.programas_patrocinados pp
    where pp.patrocinador_id = public.patrocinador_del_usuario()
      and pp.activo
      and (p_programa_id is null or pp.programa_id = p_programa_id)
  ),
  cohorte as (
    select distinct ppac.paciente_id as pid
    from public.programas_paciente ppac
    join prog on prog.programa_id = ppac.programa_id
  ),
  npac as (select count(*)::int as n from cohorte),
  pacmes as (
    select coalesce(sum((rango.dias + 1)::numeric / 30.0), 0) as pm
    from (
      select ck.paciente_id,
             (max(ck.fecha) - min(ck.fecha)) as dias
      from public.checkins ck
      join cohorte on cohorte.pid = ck.paciente_id
      where ck.estado = 'completado'
      group by ck.paciente_id
    ) rango
  ),
  evitadas as (
    select count(*)::int as c
    from public.disposiciones disp
    join public.alertas a on a.id = disp.alerta_id
    join cohorte on cohorte.pid = a.paciente_id
    where disp.desenlace = 'resuelto_sin_evento'
      and a.nivel in ('contactar', 'urgencia')
  ),
  t_senal as (
    select percentile_cont(0.5) within group (
             order by extract(epoch from (a.creado_en - ck.creado_en)) / 3600.0
           ) as h
    from public.alertas a
    join public.checkins ck on ck.id = a.checkin_id
    join cohorte on cohorte.pid = a.paciente_id
  ),
  t_disp as (
    select percentile_cont(0.5) within group (
             order by extract(epoch from (disp.creado_en - a.creado_en)) / 3600.0
           ) as h
    from public.disposiciones disp
    join public.alertas a on a.id = disp.alerta_id
    join cohorte on cohorte.pid = a.paciente_id
  ),
  ckdias as (
    select count(*)::numeric as d
    from (
      select distinct ck.paciente_id, ck.fecha
      from public.checkins ck
      join cohorte on cohorte.pid = ck.paciente_id
      where ck.estado = 'completado'
        and ck.fecha >= (current_date - 29)
    ) x
  ),
  persist as (
    select case when count(*) = 0 then null
      else round(sum((pm.discontinuada_en is null)::int)::numeric / count(*) * 100, 1) end as pct
    from public.pautas_medicacion pm
    join cohorte on cohorte.pid = pm.paciente_id
  )
  select
    case when (select n from npac) >= 5 then round((select pm from pacmes), 1) end,
    case when (select n from npac) >= 5 then (select c from evitadas) end,
    case when (select n from npac) >= 5 and (select pm from pacmes) > 0
      then round((select c from evitadas)::numeric / (select pm from pacmes) * 100, 1) end,
    case when (select n from npac) >= 5 then round((select h from t_senal)::numeric, 1) end,
    case when (select n from npac) >= 5 then round((select h from t_disp)::numeric, 1) end,
    case when (select n from npac) >= 5
      then round((select d from ckdias) / nullif((select n from npac) * 30, 0) * 100, 1) end,
    case when (select n from npac) >= 5 then (select pct from persist) end,
    case when (select n from npac) >= 5 then (select n from npac) end,
    ((select n from npac) < 5);
end;
$$;
