-- =====================================================================
-- Botsy — Migración 0008: consentimiento de uso secundario (WP-11 v2 §D)
-- Amplía el check de `consentimientos.tipo` con 'uso_secundario': opt-in
-- SEPARADO y estrictamente OPCIONAL (habilitador del activo de datos, Memoria
-- §7.4). NINGUNA funcionalidad depende de él. Texto propio [PENDIENTE LEGAL].
-- Migración ADITIVA (solo relaja un check; no borra ni edita migraciones
-- entregadas). La tabla `consentimientos` sigue siendo append-only (RLS 0002).
--
-- Nota: los tipos parentales de pediatría ('parental', 'asentimiento_menor',
-- PLAN §4.7) NO se añaden aquí — pertenecen a WP-19; se ampliarán en su propia
-- migración cuando su puerta se abra.
-- =====================================================================

alter table public.consentimientos
  drop constraint if exists consentimientos_tipo_check;

alter table public.consentimientos
  add constraint consentimientos_tipo_check
  check (tipo in ('conversacion', 'voz_grabacion', 'voz_biomarcadores', 'uso_secundario'));
