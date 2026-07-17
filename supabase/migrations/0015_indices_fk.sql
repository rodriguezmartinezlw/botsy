-- =====================================================================
-- 0015_indices_fk.sql  (revisión del director, 2026-07-17)
--
-- El linter de RENDIMIENTO de Supabase señaló 20 claves foráneas sin índice de
-- cobertura. En una BD clínica que crece, la falta de índice en la columna FK
-- penaliza los JOIN, las comprobaciones de RLS (p. ej. `es_profesional_de` filtra
-- por `pacientes.profesional_id`) y las operaciones en cascada. Añadir los índices
-- es una mejora PURA y de bajo riesgo (un índice solo puede ayudar; los `unused_index`
-- que reporte el linter son porque la BD aún es pequeña). Migración ADITIVA.
-- =====================================================================

create index if not exists idx_alertas_checkin              on public.alertas (checkin_id);
create index if not exists idx_alertas_gestionada_por       on public.alertas (gestionada_por);
create index if not exists idx_alertas_paciente             on public.alertas (paciente_id);
create index if not exists idx_alertas_regla                on public.alertas (regla_id);
create index if not exists idx_consentimientos_paciente     on public.consentimientos (paciente_id);
create index if not exists idx_disposiciones_creada_por     on public.disposiciones (creada_por);
create index if not exists idx_disposiciones_motivo         on public.disposiciones (motivo_codigo);
create index if not exists idx_informes_generado_por        on public.informes (generado_por);
create index if not exists idx_observaciones_checkin        on public.observaciones (checkin_id);
create index if not exists idx_pacientes_profesional        on public.pacientes (profesional_id);
create index if not exists idx_pautas_creada_por            on public.pautas_medicacion (creada_por);
create index if not exists idx_pautas_motivo_discont        on public.pautas_medicacion (motivo_discontinuacion);
create index if not exists idx_pautas_paciente              on public.pautas_medicacion (paciente_id);
create index if not exists idx_perfiles_patrocinador        on public.perfiles (patrocinador_id);
create index if not exists idx_prog_pac_asignado_por        on public.programas_paciente (asignado_por);
create index if not exists idx_prog_pac_programa            on public.programas_paciente (programa_id);
create index if not exists idx_prog_patroc_programa         on public.programas_patrocinados (programa_id);
create index if not exists idx_reglas_paciente              on public.reglas_escalado (paciente_id);
create index if not exists idx_reglas_programa_paciente     on public.reglas_escalado (programa_paciente_id);
create index if not exists idx_tomas_checkin                on public.tomas_medicacion (checkin_id);
