-- =====================================================================
-- Botsy — Migración 0011: Termómetro de Distrés NCCN conversacional (WP-16)
-- Migración ADITIVA. No edita migraciones ya entregadas (0001..0010).
--
--   - `instrumentos_respuestas` : una fila por administración del instrumento
--                                 (puntuación 0–10 + problemas marcados). RLS.
--   - Activación del termómetro en los 2 programas de mama (data update sobre
--     el seed de 0006) + regla de escalado `distres_termometro` en la config de
--     cada programa (se materializa como `reglas_escalado` al asignar).
--
-- RLS + políticas EN ESTA MISMA migración (CLAUDE.md). Reutiliza los helpers
-- `es_admin()` / `es_profesional_de()` de 0002_rls.sql.
--
-- El UMBRAL de escalado (>= 4, estándar NCCN) y la VERSIÓN del instrumento son
-- CONFIGURABLES y van marcados [PENDIENTE CLÍNICO] hasta la validación del
-- psicooncólogo (llamada 1). El umbral vive en la regla de programa
-- (condicion.puntuacion_gte); la versión, en env TERMOMETRO_DISTRES_VERSION.
-- =====================================================================

-- ---------------------------------------------------------------------
-- instrumentos_respuestas — respuestas de instrumentos administrados.
-- `instrumento` es ampliable (hoy solo el termómetro NCCN). `checkin_id` es
-- NULL para administraciones fuera de un check-in (p. ej. formulario futuro).
-- ---------------------------------------------------------------------
create table public.instrumentos_respuestas (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null references public.pacientes (id) on delete cascade,
  checkin_id          uuid references public.checkins (id) on delete set null,
  instrumento         text not null default 'termometro_distres_nccn'
                        check (instrumento in ('termometro_distres_nccn')),
  version_instrumento text not null,
  puntuacion          numeric not null check (puntuacion >= 0 and puntuacion <= 10),
  items               jsonb not null default '[]',
  origen              text not null default 'conversacional'
                        check (origen in ('conversacional', 'formulario')),
  creado_en           timestamptz not null default now()
);

create index idx_instrumentos_resp_paciente
  on public.instrumentos_respuestas (paciente_id, instrumento, creado_en desc);
create index idx_instrumentos_resp_checkin
  on public.instrumentos_respuestas (checkin_id);

comment on table public.instrumentos_respuestas is
  'Respuestas de instrumentos administrados (WP-16). El instrumento se ADMINISTRA '
  'y REGISTRA; Botsy no interpreta el resultado ante el paciente (reglas de oro 1 y 4). '
  'version_instrumento traza la versión usada (integridad del dato para RWE).';

-- =====================================================================
-- RLS
--   Paciente: su propio registro (SELECT + INSERT; sin UPDATE/DELETE, append-only
--             como observaciones).
--   Profesional: SELECT de los de sus pacientes.
--   Admin: todo.
-- =====================================================================
alter table public.instrumentos_respuestas enable row level security;

create policy instrumentos_resp_select_propio on public.instrumentos_respuestas
  for select to authenticated using (paciente_id = auth.uid());
create policy instrumentos_resp_insert_propio on public.instrumentos_respuestas
  for insert to authenticated with check (paciente_id = auth.uid());
create policy instrumentos_resp_select_profesional on public.instrumentos_respuestas
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy instrumentos_resp_admin_todo on public.instrumentos_respuestas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- Activación del termómetro + regla de escalado en los programas de mama.
-- Data update sobre el seed de 0006 (no edita la migración; la actualiza).
--   - instrumentos.termometro_distres.activo -> true (la frecuencia ya venía:
--     quincenal en oral, semanal en tratamiento activo).
--   - añade la regla `distres_termometro` (condición de tipo `instrumento`) a
--     escalado.reglas_clave. Al asignar el programa, se materializa como una fila
--     de reglas_escalado (sincronizarReglasPrograma).
-- Idempotente: no re-añade la regla si ya está.
-- [PENDIENTE CLÍNICO] umbral >= 4 (estándar NCCN) y activación: a validar.
-- =====================================================================
update public.programas
set config = jsonb_set(
  jsonb_set(
    config,
    '{instrumentos,termometro_distres,activo}',
    'true'::jsonb,
    false
  ),
  '{escalado,reglas_clave}',
  (config #> '{escalado,reglas_clave}') || '[
    {
      "clave": "distres_termometro",
      "nombre": "Distrés elevado (Termómetro NCCN)",
      "descripcion": "[PENDIENTE CLÍNICO] Puntuación del termómetro de distrés NCCN >= 4 -> contactar (umbral estándar NCCN; a validar por el psicooncólogo en la llamada 1).",
      "nivel": "contactar",
      "condicion": { "tipo": "instrumento", "instrumento": "termometro_distres_nccn", "puntuacion_gte": 4 }
    }
  ]'::jsonb,
  false
)
where clave in ('mama_terapia_oral', 'mama_tratamiento_activo')
  and not (config #> '{escalado,reglas_clave}') @> '[{"clave": "distres_termometro"}]'::jsonb;
