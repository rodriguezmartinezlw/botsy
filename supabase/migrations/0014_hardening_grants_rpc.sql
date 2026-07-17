-- =====================================================================
-- 0014_hardening_grants_rpc.sql  (revisión del director, 2026-07-17)
--
-- Hallazgo del LINTER DE SEGURIDAD de Supabase + verificación en vivo: las 9 RPC
-- del patrocinador tienen `EXECUTE` para `PUBLIC` (⇒ anon puede invocarlas). El
-- `revoke ... from anon` de 0010 fue INEFECTIVO: no se puede revocar de un rol
-- concreto un permiso concedido a PUBLIC. No hay fuga de datos (el guard interno
-- `es_patrocinador()` devuelve vacío para no-patrocinadores), pero el cierre que
-- 0010 pretendía nunca ocurrió → superficie de ataque innecesaria.
--
-- Fix correcto: revocar de PUBLIC (y de anon por si acaso) y conceder EXECUTE
-- solo a authenticated (los patrocinadores) y service_role. Estas funciones NO se
-- usan en políticas RLS, así que restringir su EXECUTE es de bajo riesgo. Los
-- helpers de RLS (es_admin, es_profesional_de, …) NO se tocan: se usan dentro de
-- políticas evaluadas por authenticated y solo devuelven booleanos sobre el propio
-- usuario (sin dato sensible); tocar sus grants arriesgaría la RLS por un aviso
-- cosmético. Migración ADITIVA; no edita 0010/0013.
-- =====================================================================

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'patro_resumen_cohorte', 'patro_persistencia', 'patro_meses_tratamiento',
    'patro_adherencia_mensual', 'patro_motivos_discontinuacion', 'patro_tasa_checkin',
    'patro_alertas_por_nivel', 'patro_tiempo_hasta_disposicion', 'patro_roi'
  ]
  loop
    execute format('revoke execute on function public.%I(uuid) from public', fn);
    execute format('revoke execute on function public.%I(uuid) from anon', fn);
    execute format('grant execute on function public.%I(uuid) to authenticated', fn);
    execute format('grant execute on function public.%I(uuid) to service_role', fn);
  end loop;
end $$;
