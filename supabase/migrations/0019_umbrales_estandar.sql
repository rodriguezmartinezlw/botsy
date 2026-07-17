-- =====================================================================
-- 0019_umbrales_estandar.sql  (decisión del fundador, 2026-07-17)
--
-- Los umbrales clínicos dejan de tratarse como "pendientes de validación" y
-- pasan a declararse como lo que son: VALORES ESTÁNDAR de guías publicadas,
-- configurables por el profesional. Los VALORES no cambian (ya eran los
-- estándar); cambia el etiquetado visible en las descripciones:
--
--   · Termómetro de Distrés NCCN: corte >= 4 (guía NCCN Distress Management).
--   · Fiebre >= 38,0 °C en tratamiento activo -> urgencia (umbral estándar de
--     alarma al paciente oncológico, 100,4 °F; coherente con IDSA/NCCN para
--     sospecha de neutropenia febril).
--   · Fiebre >= 38,0 °C en terapia oral -> contactar.
--   · Diarrea / vómitos autorreportados >= 7/10 -> contactar (proxy de
--     severidad, banda alta de la escala 0-10, en línea con CTCAE grado >= 3).
--   · Dolor >= 7 sostenido 2 días -> contactar (banda 7-10 = dolor severo en
--     escalas EVA/NRS); dolor >= 9 puntual -> contactar (regla global previa).
--   · Ánimo <= 3 durante 3 días -> vigilancia (banda baja de la escala 0-10).
--
-- Data-update idempotente sobre las filas sembradas por 0006/0011 (no se editan
-- migraciones commiteadas). La revisión clínica posterior es RECOMENDABLE y los
-- umbrales siguen siendo configurables por regla/paciente.
-- =====================================================================

update public.reglas_escalado
set descripcion = replace(descripcion, '[PENDIENTE CLÍNICO] ', 'Estándar (guías NCCN/IDSA/CTCAE): ')
where descripcion like '%[PENDIENTE CLÍNICO]%';

update public.programas
set config = replace(config::text, '[PENDIENTE CLÍNICO] ', 'Estándar (guías NCCN/IDSA/CTCAE): ')::jsonb
where config::text like '%[PENDIENTE CLÍNICO]%';
