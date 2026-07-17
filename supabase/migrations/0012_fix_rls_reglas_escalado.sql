-- =====================================================================
-- 0012_fix_rls_reglas_escalado.sql  (WP-09 — corrección del director)
--
-- Hallazgo de la verificación de acceso cruzado EN VIVO (WP-09): la política
-- `reglas_select_profesional` de 0002 usaba `paciente_id is null or
-- es_profesional_de(...)`, y la rama `paciente_id is null` dejaba que CUALQUIER
-- autenticado (incluido un paciente) leyera las reglas de escalado GLOBALES —
-- contradiciendo el invariante documentado de WP-01 ("Paciente: SIN acceso a
-- reglas_escalado"). Nunca se detectó porque `acceso_cruzado.sql` no se había
-- podido ejecutar contra una BD real hasta ahora.
--
-- Fix: gatear la lectura a profesional/admin. El paciente deja de ver ninguna
-- fila de reglas_escalado (ni globales ni las suyas de programa). El motor de
-- escalado ya lee las reglas con service-role (bypassa RLS), así que el check-in
-- no se ve afectado.
-- Migración ADITIVA: no edita 0002.
-- =====================================================================

drop policy if exists reglas_select_profesional on public.reglas_escalado;
create policy reglas_select_profesional on public.reglas_escalado
  for select to authenticated
  using (
    public.es_profesional_o_admin()
    and (paciente_id is null or public.es_profesional_de(paciente_id))
  );
