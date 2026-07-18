-- =====================================================================
-- 0021_metricas_tipo_checkin.sql  (integración WP-24, revisión del director)
--
-- Con las CONSULTAS a demanda (0020) conviven dos clases de conversación:
--   · check-in diario estructurado (tipo='checkin')  → mide la ADHERENCIA al
--     programa (benchmark de engagement tipo Noona) y alimenta la racha.
--   · consulta a demanda (tipo='consulta')           → dato CLÍNICO pleno para
--     el profesional (ficha, tendencias, alertas), pero NO "cumple" el día.
--
-- Sin este ajuste, una consulta inflaría la "tasa de check-in" y los
-- pacientes-mes que ve el patrocinador. Se redefinen `patro_tasa_checkin` y
-- `patro_roi` con `ck.tipo = 'checkin'` en las CTEs de días/observación.
--
-- IMPORTANTE (patrón recurrente 0010→0014→0017→0018): se usa CREATE OR REPLACE
-- con la MISMA firma → la ACL existente se conserva (nada de DROP+CREATE, que
-- resetea los grants a PUBLIC).
--
-- Mejora anotada (no implementada aquí): exponer al patrocinador una métrica
-- separada de "consultas espontáneas por paciente-mes" — es señal de engagement
-- valiosa por sí misma; requiere ampliar la tabla de retorno (cambio de firma).
-- =====================================================================

create or replace function public.patro_tasa_checkin(
  p_programa_id uuid  default null,
  p_institucion uuid  default null,
  p_pais        text  default null
)
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
    join public.pacientes pac on pac.id = ppac.paciente_id
    left join public.instituciones ins on ins.id = pac.institucion_id
    where (p_institucion is null or pac.institucion_id = p_institucion)
      and (p_pais is null or ins.pais_codigo = p_pais)
  ),
  npac as (select count(*)::int as n from cohorte),
  dias as (
    select count(*)::numeric as d
    from (
      select distinct ck.paciente_id, ck.fecha
      from public.checkins ck
      join cohorte on cohorte.pid = ck.paciente_id
      where ck.estado = 'completado'
        and ck.tipo = 'checkin'          -- WP-24: solo el check-in diario
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

create or replace function public.patro_roi(
  p_programa_id uuid  default null,
  p_institucion uuid  default null,
  p_pais        text  default null
)
returns table (
  pacientes_mes            numeric,
  urgencias_evitadas       integer,
  urgencias_evitadas_100   numeric,
  horas_senal_alerta       numeric,
  horas_alerta_disposicion numeric,
  tasa_checkin             numeric,
  persistencia_pct         numeric,
  n                        integer,
  datos_insuficientes      boolean
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
    join public.pacientes pac on pac.id = ppac.paciente_id
    left join public.instituciones ins on ins.id = pac.institucion_id
    where (p_institucion is null or pac.institucion_id = p_institucion)
      and (p_pais is null or ins.pais_codigo = p_pais)
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
        and ck.tipo = 'checkin'          -- WP-24: la observación la define el programa diario
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
        and ck.tipo = 'checkin'          -- WP-24: solo el check-in diario
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
