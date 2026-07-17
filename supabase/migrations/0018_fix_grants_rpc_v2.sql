-- =====================================================================
-- 0018_fix_grants_rpc_v2.sql  (revisión del director, 2026-07-17)
--
-- Regresión detectada por verificación EN VIVO: 0017 recreó las 9 RPC del
-- patrocinador con nueva firma (DROP+CREATE ⇒ ACL reseteada a PUBLIC EXECUTE) y
-- repitió el patrón INEFECTIVO de 0010: `revoke ... from anon`. No se puede
-- revocar de un rol un permiso concedido a PUBLIC ⇒ las funciones volvieron a ser
-- ejecutables por PUBLIC/anon (el fix 0014 quedó deshecho al cambiar la firma).
--
-- Fix ROBUSTO e idempotente: itera sobre TODAS las funciones `patro_*` del
-- esquema public (sea cual sea su firma actual) y revoca de PUBLIC/anon + concede
-- solo a authenticated/service_role. Al no CREAR funciones, no se re-dispara el
-- auto-grant de PUBLIC ⇒ el cierre queda firme. Reemplaza el enfoque estático de
-- 0014 (que dependía de la firma). No edita migraciones commiteadas.
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'patro\_%'
  loop
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
