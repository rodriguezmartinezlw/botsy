-- =====================================================================
-- Botsy — Migración 0007: disposición estructurada obligatoria (WP-11 v2 §B)
-- Regla de oro 3: toda alerta se cierra con decisión + motivo codificado +
-- desenlace programado. NO retrofiteable -> entra en el primer sprint.
-- Migración ADITIVA. No edita migraciones ya entregadas.
--
--   - `catalogo_motivos`  : catálogo codificado de motivos (disposición /
--                           descarte / discontinuación). Seed [PENDIENTE CLÍNICO].
--   - `disposiciones`     : una por alerta (UNIQUE). Decisión + motivo + días de
--                           seguimiento + desenlace.
--   - `pautas_medicacion.motivo_discontinuacion` : FK al catálogo (§C.4);
--                           `desactivada_en` ya existe (WP-10).
--
-- RLS + políticas EN ESTA MISMA migración. Nuevo helper `paciente_de_alerta`.
-- Formato según PLAN-TECNICO-PILOTO §4.1-2.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: paciente dueño de una alerta (para RLS de disposiciones).
-- ---------------------------------------------------------------------
create or replace function public.paciente_de_alerta(p_alerta uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select paciente_id from public.alertas where id = p_alerta;
$$;

-- ---------------------------------------------------------------------
-- catalogo_motivos — motivos codificados por ámbito.
-- ---------------------------------------------------------------------
create table public.catalogo_motivos (
  id        uuid primary key default gen_random_uuid(),
  ambito    text not null check (ambito in ('disposicion', 'descarte', 'discontinuacion')),
  codigo    text not null,
  etiqueta  text not null,
  activo    boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (ambito, codigo)
);

-- ---------------------------------------------------------------------
-- disposiciones — cierre estructurado de una alerta (1:1 con alerta).
-- `motivo_codigo` referencia el catálogo (FK a la fila del catálogo; se
-- conserva el nombre del PLAN aunque apunte al id de la fila).
-- ---------------------------------------------------------------------
create table public.disposiciones (
  id                      uuid primary key default gen_random_uuid(),
  alerta_id               uuid not null unique references public.alertas (id) on delete cascade,
  decision                text not null
                            check (decision in ('contactado_paciente', 'ajuste_pauta',
                                                'derivado_consulta', 'derivado_urgencias',
                                                'observacion', 'sin_accion_justificada')),
  motivo_codigo           uuid references public.catalogo_motivos (id) on delete set null,
  motivo_texto            text,
  dias_seguimiento        int not null default 7 check (dias_seguimiento >= 0),
  desenlace               text not null default 'pendiente'
                            check (desenlace in ('pendiente', 'resuelto_sin_evento',
                                                 'visita_no_programada', 'urgencias',
                                                 'hospitalizacion', 'discontinuacion', 'otro')),
  desenlace_nota          text,
  desenlace_registrado_en timestamptz,
  creada_por              uuid references public.perfiles (id) on delete set null,
  creado_en               timestamptz not null default now()
);

create index idx_disposiciones_desenlace
  on public.disposiciones (desenlace, creado_en);

-- ---------------------------------------------------------------------
-- pautas_medicacion.motivo_discontinuacion (WP-11 v2 §C.4).
-- Complementa a `desactivada_en` (WP-10): distingue "discontinuar" (con motivo
-- codificado, alimenta curvas de persistencia) de "desactivar por error".
-- ---------------------------------------------------------------------
alter table public.pautas_medicacion
  add column if not exists motivo_discontinuacion uuid
    references public.catalogo_motivos (id) on delete set null;

comment on column public.pautas_medicacion.motivo_discontinuacion is
  'Motivo codificado de discontinuación (catalogo_motivos, ambito discontinuacion). '
  'NULL si sigue activa o si fue baja por error. Alimenta la persistencia (WP-17).';

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.catalogo_motivos enable row level security;
alter table public.disposiciones    enable row level security;

-- --- catalogo_motivos: lectura profesional/admin; escritura admin --------
create policy catalogo_motivos_select on public.catalogo_motivos
  for select to authenticated using (public.es_profesional_o_admin());
create policy catalogo_motivos_admin_todo on public.catalogo_motivos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- --- disposiciones: profesional del paciente escribe; paciente NO lee ----
-- (dato de gestión clínica). Admin lee (es_profesional_de ya incluye admin).
create policy disposiciones_select_profesional on public.disposiciones
  for select to authenticated
  using (public.es_profesional_de(public.paciente_de_alerta(alerta_id)));
create policy disposiciones_insert_profesional on public.disposiciones
  for insert to authenticated
  with check (
    public.es_profesional_de(public.paciente_de_alerta(alerta_id))
    and creada_por = auth.uid()
  );
create policy disposiciones_update_profesional on public.disposiciones
  for update to authenticated
  using (public.es_profesional_de(public.paciente_de_alerta(alerta_id)))
  with check (public.es_profesional_de(public.paciente_de_alerta(alerta_id)));
create policy disposiciones_admin_todo on public.disposiciones
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- Seed: catálogo de motivos [PENDIENTE CLÍNICO] — el psicooncólogo lo depura.
-- =====================================================================
insert into public.catalogo_motivos (ambito, codigo, etiqueta, activo) values
  -- Motivos de disposición (por qué se cerró así una alerta gestionada).
  ('disposicion', 'sintoma_leve_autolimitado', '[PENDIENTE CLÍNICO] Síntoma leve y autolimitado', true),
  ('disposicion', 'contactado_sin_hallazgos',  '[PENDIENTE CLÍNICO] Contactado el paciente, sin hallazgos relevantes', true),
  ('disposicion', 'ajuste_realizado',          '[PENDIENTE CLÍNICO] Ajuste de pauta/soporte realizado', true),
  ('disposicion', 'derivacion_realizada',      '[PENDIENTE CLÍNICO] Derivación a consulta/urgencias realizada', true),
  ('disposicion', 'seguimiento_programado',    '[PENDIENTE CLÍNICO] Seguimiento programado', true),
  ('disposicion', 'esperado_por_tratamiento',  '[PENDIENTE CLÍNICO] Efecto esperado del tratamiento', true),
  -- Motivos de descarte (por qué la alerta no requería acción).
  ('descarte', 'falso_positivo',        '[PENDIENTE CLÍNICO] Falso positivo', true),
  ('descarte', 'dato_erroneo',          '[PENDIENTE CLÍNICO] Dato mal capturado', true),
  ('descarte', 'duplicada',             '[PENDIENTE CLÍNICO] Alerta duplicada', true),
  ('descarte', 'gestionada_fuera',      '[PENDIENTE CLÍNICO] Ya gestionada por otra vía', true),
  ('descarte', 'no_relevante',          '[PENDIENTE CLÍNICO] No clínicamente relevante', true),
  -- Motivos de discontinuación de pauta (persistencia, WP-17).
  ('discontinuacion', 'toxicidad',        '[PENDIENTE CLÍNICO] Toxicidad / efectos adversos', true),
  ('discontinuacion', 'decision_paciente','[PENDIENTE CLÍNICO] Decisión del paciente', true),
  ('discontinuacion', 'coste_acceso',     '[PENDIENTE CLÍNICO] Coste / acceso', true),
  ('discontinuacion', 'progresion',       '[PENDIENTE CLÍNICO] Progresión de la enfermedad', true),
  ('discontinuacion', 'indicacion_medica','[PENDIENTE CLÍNICO] Indicación médica', true),
  ('discontinuacion', 'fin_tratamiento',  '[PENDIENTE CLÍNICO] Fin de tratamiento planificado', true)
on conflict (ambito, codigo) do nothing;
