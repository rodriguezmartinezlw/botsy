-- =====================================================================
-- Botsy — Migración 0003: reglas de escalado semilla (globales)
-- El formato de `condicion` (JSONB) es el definido en WP-04
-- (sección "Formato de reglas_escalado.condicion"). Tipos usados:
--   observacion | senal | combinacion (todas/alguna) | adherencia_critica | tendencia
-- Estas reglas se insertan como globales (paciente_id null); la #1 se
-- acota a la vertical cardiovascular.
-- =====================================================================

insert into public.reglas_escalado (paciente_id, vertical, nombre, descripcion, condicion, nivel, activa)
values
  -- 1) URGENCIA · cardiovascular: dolor torácico + disnea en el mismo check-in.
  (
    null,
    'cardiovascular',
    'Dolor torácico con disnea',
    'Cardiovascular: dolor torácico y falta de aire detectados en el mismo check-in.',
    '{
      "tipo": "combinacion",
      "todas": [
        { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "dolor_toracico" },
        { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "disnea" }
      ]
    }'::jsonb,
    'urgencia',
    true
  ),
  -- 2) URGENCIA · global: ideación autolítica.
  (
    null,
    null,
    'Ideación autolítica',
    'Señal de ideación autolítica detectada en la conversación.',
    '{ "tipo": "senal", "codigo": "ideacion_autolitica" }'::jsonb,
    'urgencia',
    true
  ),
  -- 3) CONTACTAR · global: dolor con valor_num >= 9.
  (
    null,
    null,
    'Dolor intenso',
    'Dolor reportado con intensidad >= 9 (escala 0-10).',
    '{ "tipo": "observacion", "dominio": "dolor", "valor_num_gte": 9 }'::jsonb,
    'contactar',
    true
  ),
  -- 4) CONTACTAR · global: fármaco crítico omitido >= 2 días consecutivos.
  (
    null,
    null,
    'Fármaco crítico omitido',
    'Un fármaco marcado como crítico se ha omitido 2 o más días consecutivos.',
    '{ "tipo": "adherencia_critica", "dias_consecutivos": 2 }'::jsonb,
    'contactar',
    true
  ),
  -- 5) VIGILANCIA · global: ánimo <= 3 durante >= 3 días seguidos.
  (
    null,
    null,
    'Ánimo bajo sostenido',
    'Ánimo <= 3 (escala 0-10) durante 3 o más días consecutivos.',
    '{ "tipo": "tendencia", "dominio": "animo", "valor_num_lte": 3, "dias_consecutivos": 3 }'::jsonb,
    'vigilancia',
    true
  );
