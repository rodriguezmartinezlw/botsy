-- =====================================================================
-- Botsy — Migración 0006: núcleo de programas de monitorización (WP-11 v2 §A)
-- Migración ADITIVA. No edita migraciones ya entregadas (0001..0005).
--
--   - `programas`           : catálogo de programas (config canónica en jsonb).
--   - `programas_paciente`  : asignación de un programa a un paciente, con
--                             override por paciente y UNIQUE PARCIAL de un
--                             programa ACTIVO por paciente.
--   - `reglas_escalado.programa_paciente_id` : traza la asignación que
--                             materializó una regla (activación idempotente
--                             de las reglas clave del programa; WP-11 §A.5).
--   - Seed: 2 programas de mama (`mama_terapia_oral`, `mama_tratamiento_activo`).
--
-- RLS + políticas EN ESTA MISMA migración (CLAUDE.md). Reutiliza los helpers
-- `es_admin()` / `es_profesional_de()` de 0002_rls.sql y añade
-- `es_profesional_o_admin()` (rol global, sin paciente concreto).
--
-- TODOS los umbrales clínicos de las reglas seed van marcados [PENDIENTE
-- CLÍNICO]: los números definitivos los fija el psicooncólogo (llamada 1).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper de rol global: ¿es el usuario profesional o admin?
-- ---------------------------------------------------------------------
create or replace function public.es_profesional_o_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol in ('profesional', 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- programas — catálogo. `config` valida contra EsquemaConfigPrograma
-- (src/lib/programas/config.ts). `clave` es el identificador estable.
-- ---------------------------------------------------------------------
create table public.programas (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null unique,
  nombre      text not null,
  descripcion text,
  version     int not null default 1,
  config      jsonb not null default '{}',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- programas_paciente — asignación. Un paciente puede tener a lo sumo UN
-- programa en estado 'activo' (UNIQUE parcial más abajo).
-- ---------------------------------------------------------------------
create table public.programas_paciente (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid not null references public.pacientes (id) on delete cascade,
  programa_id     uuid not null references public.programas (id) on delete restrict,
  config_override jsonb not null default '{}',
  fase_actual     int not null default 0,
  fecha_inicio    date,
  fecha_evento    date,
  estado          text not null default 'activo'
                    check (estado in ('activo', 'completado', 'suspendido')),
  asignado_por    uuid references public.perfiles (id) on delete set null,
  creado_en       timestamptz not null default now()
);

-- Un solo programa ACTIVO por paciente (los suspendidos/completados no cuentan).
create unique index uq_programa_activo_por_paciente
  on public.programas_paciente (paciente_id)
  where (estado = 'activo');

create index idx_programas_paciente_paciente
  on public.programas_paciente (paciente_id, estado);

-- ---------------------------------------------------------------------
-- reglas_escalado.programa_paciente_id — traza de materialización.
-- NULL en reglas globales / de vertical / creadas a mano. Al eliminar la
-- asignación, sus reglas materializadas se borran en cascada.
-- ---------------------------------------------------------------------
alter table public.reglas_escalado
  add column if not exists programa_paciente_id uuid
    references public.programas_paciente (id) on delete cascade;

comment on column public.reglas_escalado.programa_paciente_id is
  'Asignación de programa que materializó esta regla (WP-11 v2 §A.5). '
  'Clave de activación idempotente; NULL para reglas no derivadas de un programa.';

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.programas          enable row level security;
alter table public.programas_paciente enable row level security;

-- --- programas: catálogo -------------------------------------------------
-- Profesional/admin ven todo el catálogo (para asignar). El paciente sólo ve
-- el/los programa(s) que tiene ASIGNADOS (necesario para el check-in dirigido
-- por programa), no el catálogo completo. Escritura: sólo admin.
create policy programas_select_profesional on public.programas
  for select to authenticated
  using (public.es_profesional_o_admin());
create policy programas_select_asignado on public.programas
  for select to authenticated
  using (
    exists (
      select 1 from public.programas_paciente pp
      where pp.programa_id = programas.id
        and pp.paciente_id = auth.uid()
    )
  );
create policy programas_admin_todo on public.programas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- --- programas_paciente: asignación --------------------------------------
-- Paciente: SELECT de las suyas. Profesional: gestiona (SELECT/INSERT/UPDATE)
-- las de sus pacientes asignados. Admin: todo.
create policy programas_paciente_select_propio on public.programas_paciente
  for select to authenticated using (paciente_id = auth.uid());
create policy programas_paciente_select_profesional on public.programas_paciente
  for select to authenticated using (public.es_profesional_de(paciente_id));
create policy programas_paciente_insert_profesional on public.programas_paciente
  for insert to authenticated with check (public.es_profesional_de(paciente_id));
create policy programas_paciente_update_profesional on public.programas_paciente
  for update to authenticated
  using (public.es_profesional_de(paciente_id))
  with check (public.es_profesional_de(paciente_id));
create policy programas_paciente_admin_todo on public.programas_paciente
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- Seed: 2 programas de mama (WP-11 v2 §C.1).
-- La `config` es la forma canónica COMPLETA de EsquemaConfigPrograma.
-- Umbrales de `escalado.reglas_clave` marcados [PENDIENTE CLÍNICO].
-- =====================================================================

-- 1) Terapia oral: check-in diario; adherencia + síntomas + ánimo/distrés breve.
--    Fiebre >=38 -> contactar; diarrea intensa -> contactar; vómitos que impiden
--    ingesta -> contactar; dolor >=7 sostenido 2 días -> contactar. [PENDIENTE CLÍNICO]
insert into public.programas (clave, nombre, descripcion, version, config, activo)
values (
  'mama_terapia_oral',
  'Mama · Terapia oral',
  'Seguimiento diario de pacientes de cáncer de mama en terapia endocrina/oral: adherencia a la toma, síntomas frecuentes y ánimo/distrés breve.',
  1,
  '{
    "modulos": { "voz": true, "texto": true, "recomendaciones": true },
    "perfil_graficos": { "dolor": true, "animo": true, "adherencia": true, "sintomas": true, "sueno": false, "cognicion": false },
    "checkin": {
      "frecuencia": "diaria",
      "dominios": ["adherencia", "sintomas_fisicos", "animo"],
      "preguntas_extra": [
        { "clave": "fiebre",  "texto": "¿Te has tomado la temperatura? ¿Has tenido fiebre?", "dominio": "sintomas_fisicos" },
        { "clave": "diarrea", "texto": "¿Has tenido diarrea o descomposición?", "dominio": "sintomas_fisicos" },
        { "clave": "fatiga",  "texto": "¿Cómo estás de energía? ¿Te has notado con mucho cansancio?", "dominio": "sintomas_fisicos" }
      ],
      "estilo": { "ritmo": "calmado", "frases_cortas": true, "repeticion": false }
    },
    "escalado": {
      "reglas_clave": [
        {
          "clave": "fiebre_oral",
          "nombre": "Fiebre en terapia oral",
          "descripcion": "[PENDIENTE CLÍNICO] Fiebre >= 38 grados en terapia oral -> contactar.",
          "nivel": "contactar",
          "condicion": { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "fiebre", "valor_num_gte": 38 }
        },
        {
          "clave": "diarrea_intensa",
          "nombre": "Diarrea intensa",
          "descripcion": "[PENDIENTE CLÍNICO] Diarrea intensa/persistente (intensidad >= 7) -> contactar.",
          "nivel": "contactar",
          "condicion": { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "diarrea", "valor_num_gte": 7 }
        },
        {
          "clave": "vomitos_ingesta",
          "nombre": "Vómitos que impiden la ingesta",
          "descripcion": "[PENDIENTE CLÍNICO] Vómitos que impiden ingesta (intensidad >= 7) -> contactar.",
          "nivel": "contactar",
          "condicion": { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "vomitos", "valor_num_gte": 7 }
        },
        {
          "clave": "dolor_sostenido",
          "nombre": "Dolor alto sostenido",
          "descripcion": "[PENDIENTE CLÍNICO] Dolor >= 7 durante 2 días seguidos -> contactar.",
          "nivel": "contactar",
          "condicion": { "tipo": "tendencia", "dominio": "dolor", "valor_num_gte": 7, "dias_consecutivos": 2 }
        }
      ]
    },
    "instrumentos": { "termometro_distres": { "activo": false, "frecuencia": "quincenal" } }
  }'::jsonb,
  true
)
on conflict (clave) do nothing;

-- 2) Tratamiento activo: síntomas de ciclo (náuseas, vómitos, mucositis, fatiga),
--    distrés completo semanal (WP-16), adherencia a orales concomitantes.
--    Fiebre >=38 -> URGENCIA (neutropenia febril); diarrea/vómitos/dolor -> contactar.
--    [PENDIENTE CLÍNICO]
insert into public.programas (clave, nombre, descripcion, version, config, activo)
values (
  'mama_tratamiento_activo',
  'Mama · Tratamiento activo',
  'Seguimiento diario de pacientes de cáncer de mama en tratamiento activo (quimio/anti-HER2): síntomas de ciclo, distrés y adherencia a orales concomitantes.',
  1,
  '{
    "modulos": { "voz": true, "texto": true, "recomendaciones": true },
    "perfil_graficos": { "dolor": true, "animo": true, "adherencia": true, "sintomas": true, "sueno": true, "cognicion": false },
    "checkin": {
      "frecuencia": "diaria",
      "dominios": ["adherencia", "sintomas_fisicos", "animo", "dolor"],
      "preguntas_extra": [
        { "clave": "nauseas",  "texto": "¿Has tenido náuseas hoy?", "dominio": "sintomas_fisicos" },
        { "clave": "vomitos",  "texto": "¿Has vomitado? ¿Has podido comer y beber?", "dominio": "sintomas_fisicos" },
        { "clave": "mucositis","texto": "¿Cómo tienes la boca? ¿Notas llagas o molestias al tragar?", "dominio": "sintomas_fisicos" },
        { "clave": "fatiga",   "texto": "¿Cómo estás de energía? ¿Mucho cansancio?", "dominio": "sintomas_fisicos" }
      ],
      "estilo": { "ritmo": "calmado", "frases_cortas": true, "repeticion": true }
    },
    "escalado": {
      "reglas_clave": [
        {
          "clave": "fiebre_activo",
          "nombre": "Fiebre en tratamiento activo",
          "descripcion": "[PENDIENTE CLÍNICO] Fiebre >= 38 grados en tratamiento activo -> URGENCIA (posible neutropenia febril).",
          "nivel": "urgencia",
          "condicion": { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "fiebre", "valor_num_gte": 38 }
        },
        {
          "clave": "diarrea_intensa",
          "nombre": "Diarrea intensa",
          "descripcion": "[PENDIENTE CLÍNICO] Diarrea intensa/persistente (intensidad >= 7) -> contactar.",
          "nivel": "contactar",
          "condicion": { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "diarrea", "valor_num_gte": 7 }
        },
        {
          "clave": "vomitos_ingesta",
          "nombre": "Vómitos que impiden la ingesta",
          "descripcion": "[PENDIENTE CLÍNICO] Vómitos que impiden ingesta (intensidad >= 7) -> contactar.",
          "nivel": "contactar",
          "condicion": { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "vomitos", "valor_num_gte": 7 }
        },
        {
          "clave": "dolor_sostenido",
          "nombre": "Dolor alto sostenido",
          "descripcion": "[PENDIENTE CLÍNICO] Dolor >= 7 durante 2 días seguidos -> contactar.",
          "nivel": "contactar",
          "condicion": { "tipo": "tendencia", "dominio": "dolor", "valor_num_gte": 7, "dias_consecutivos": 2 }
        }
      ]
    },
    "instrumentos": { "termometro_distres": { "activo": false, "frecuencia": "semanal" } }
  }'::jsonb,
  true
)
on conflict (clave) do nothing;
