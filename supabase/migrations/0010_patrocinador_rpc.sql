-- =====================================================================
-- Botsy — Migración 0010: funciones RPC de agregados para el patrocinador
--                          (WP-17 + WP-15, PLAN §4.6, §5, §7).
-- Migración ADITIVA. No edita migraciones ya entregadas.
--
-- ÚNICA vía por la que el rol `patrocinador` accede a datos clínicos: funciones
-- `security definer` que devuelven SOLO AGREGADOS con K-ANONIMATO >= 5. Ningún
-- corte con < 5 pacientes se devuelve — se OMITE (0 filas) o se marca
-- `datos_insuficientes = true` sin exponer ninguna métrica ni el conteo exacto.
--
-- Todas:
--   - `security definer` + `set search_path = public` (aislado, seguro).
--   - Guarda interna: si el llamante no es patrocinador ni admin, no devuelve
--     nada (defensa en profundidad además del REVOKE a anon).
--   - Alcance: SOLO los pacientes de los programas que el patrocinador que llama
--     financia (`programas_patrocinados` del patrocinador del usuario). Un
--     patrocinador no puede pedir datos de una cohorte que no financia.
--   - K-ANONIMATO = 5 (constante de negocio; se repite inline y va comentada).
--
-- NOTA REGULATORIA: estas funciones DESCRIBEN lo observado; no predicen ni
-- puntúan (regla de oro 4). El proxy de "urgencias evitadas" del ROI es una
-- definición honesta y se documenta en el propio informe (WP-15).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Resumen de cohorte por programa financiado. Para cada programa que el
--    patrocinador financia devuelve el nº de pacientes SOLO si >= 5; si < 5,
--    `n_pacientes = NULL` y `datos_insuficientes = true` (no revela el conteo).
-- ---------------------------------------------------------------------
create or replace function public.patro_resumen_cohorte(p_programa_id uuid default null)
returns table (
  programa_id        uuid,
  clave              text,
  nombre             text,
  n_pacientes        integer,
  datos_insuficientes boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
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
  conteos as (
    select pr.programa_id as pid, count(distinct ppac.paciente_id) as n
    from prog pr
    join public.programas_paciente ppac on ppac.programa_id = pr.programa_id
    group by pr.programa_id
  )
  select
    c.pid,
    g.clave,
    g.nombre,
    case when c.n >= 5 then c.n::int else null end,   -- k-anonimato: oculta n < 5
    (c.n < 5)
  from conteos c
  join public.programas g on g.id = c.pid
  order by g.nombre;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Persistencia (curva simple tipo Kaplan-Meier sobre discontinuada_en).
--    Fracción de pautas aún NO discontinuadas al mes m (0..6). Se OMITE por
--    completo (0 filas) si la cohorte tiene < 5 pacientes.
-- ---------------------------------------------------------------------
create or replace function public.patro_persistencia(p_programa_id uuid default null)
returns table (mes integer, tasa numeric, n integer)
language plpgsql
security definer
set search_path = public
stable
as $$
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

-- ---------------------------------------------------------------------
-- 3) Meses en tratamiento (mediana + cuartiles). Una fila. Si < 5 pacientes,
--    devuelve la fila con métricas NULL y `datos_insuficientes = true`.
-- ---------------------------------------------------------------------
create or replace function public.patro_meses_tratamiento(p_programa_id uuid default null)
returns table (
  mediana numeric, p25 numeric, p75 numeric, n integer, datos_insuficientes boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
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

-- ---------------------------------------------------------------------
-- 4) Adherencia media mensual. Suprime CADA mes con < 5 pacientes (HAVING).
-- ---------------------------------------------------------------------
create or replace function public.patro_adherencia_mensual(p_programa_id uuid default null)
returns table (mes text, adherencia numeric, n_pacientes integer)
language plpgsql
security definer
set search_path = public
stable
as $$
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
  t as (
    select to_char(tm.fecha, 'YYYY-MM') as mes, tm.estado, tm.paciente_id
    from public.tomas_medicacion tm
    join cohorte on cohorte.pid = tm.paciente_id
    where tm.estado in ('tomada', 'omitida')
  )
  select
    t.mes,
    round(sum((t.estado = 'tomada')::int)::numeric / nullif(count(*), 0) * 100, 1),
    count(distinct t.paciente_id)::int
  from t
  group by t.mes
  having count(distinct t.paciente_id) >= 5   -- k-anonimato por mes
  order by t.mes;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Motivos de discontinuación codificados (conteos). Se OMITE por completo si
--    la cohorte tiene < 5 pacientes (los conteos son atributos de una cohorte ya
--    k-segura; no son sub-cohortes por cuasi-identificador). Ver WP-17 entrega.
-- ---------------------------------------------------------------------
create or replace function public.patro_motivos_discontinuacion(p_programa_id uuid default null)
returns table (codigo text, etiqueta text, conteo integer)
language plpgsql
security definer
set search_path = public
stable
as $$
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
  npac as (select count(*)::int as n from cohorte)
  select cm.codigo, cm.etiqueta, count(*)::int
  from public.pautas_medicacion pm
  join cohorte on cohorte.pid = pm.paciente_id
  join public.catalogo_motivos cm on cm.id = pm.motivo_discontinuacion
  where pm.motivo_discontinuacion is not null
    and (select n from npac) >= 5   -- k-anonimato: cohorte < 5 => sin filas
  group by cm.codigo, cm.etiqueta
  order by count(*) desc, cm.codigo;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Tasa de check-in (engagement) de los últimos 30 días. Benchmark Noona 90%.
--    Una fila; NULL + datos_insuficientes si < 5 pacientes.
-- ---------------------------------------------------------------------
create or replace function public.patro_tasa_checkin(p_programa_id uuid default null)
returns table (tasa numeric, n integer, datos_insuficientes boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
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

-- ---------------------------------------------------------------------
-- 7) Alertas por nivel (conteos). Se OMITE por completo si la cohorte < 5.
-- ---------------------------------------------------------------------
create or replace function public.patro_alertas_por_nivel(p_programa_id uuid default null)
returns table (nivel text, conteo integer)
language plpgsql
security definer
set search_path = public
stable
as $$
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
  npac as (select count(*)::int as n from cohorte)
  select a.nivel, count(*)::int
  from public.alertas a
  join cohorte on cohorte.pid = a.paciente_id
  where (select n from npac) >= 5   -- k-anonimato
  group by a.nivel
  order by a.nivel;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) Tiempo mediano hasta disposición (alerta -> disposición), en horas. Una
--    fila; NULL + datos_insuficientes si hay < 5 disposiciones en la cohorte.
-- ---------------------------------------------------------------------
create or replace function public.patro_tiempo_hasta_disposicion(p_programa_id uuid default null)
returns table (mediana_horas numeric, n integer, datos_insuficientes boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
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

-- ---------------------------------------------------------------------
-- 9) ROI pagador (WP-15). Métricas de datos YA capturados, sin ML ni
--    proyección. "urgencias_evitadas" es un PROXY HONESTO: disposiciones con
--    desenlace 'resuelto_sin_evento' sobre alertas de nivel contactar/urgencia
--    (documentado en el propio informe). Una fila; NULL + datos_insuficientes
--    si < 5 pacientes.
-- ---------------------------------------------------------------------
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
  -- pacientes-mes observados = suma por paciente de (días con datos)/30.
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

-- ---------------------------------------------------------------------
-- Cierre de puerta a `anon` (defensa en profundidad; la guarda interna ya
-- devuelve vacío para no-patrocinadores). `authenticated` conserva EXECUTE
-- (default a PUBLIC); la autorización real es la guarda interna.
-- ---------------------------------------------------------------------
revoke execute on function public.patro_resumen_cohorte(uuid)        from anon;
revoke execute on function public.patro_persistencia(uuid)           from anon;
revoke execute on function public.patro_meses_tratamiento(uuid)      from anon;
revoke execute on function public.patro_adherencia_mensual(uuid)     from anon;
revoke execute on function public.patro_motivos_discontinuacion(uuid) from anon;
revoke execute on function public.patro_tasa_checkin(uuid)           from anon;
revoke execute on function public.patro_alertas_por_nivel(uuid)      from anon;
revoke execute on function public.patro_tiempo_hasta_disposicion(uuid) from anon;
revoke execute on function public.patro_roi(uuid)                    from anon;
