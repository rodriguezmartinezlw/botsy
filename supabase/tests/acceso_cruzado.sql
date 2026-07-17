-- =====================================================================
-- Botsy — Prueba de ACCESO CRUZADO en vivo (WP-08, punto a).
--
-- Verifica la RLS de WP-01 contra datos reales simulando la identidad de cada
-- usuario (rol `authenticated` + su JWT `sub`). Comprueba que:
--   1. Un paciente NO lee datos de otro paciente por ninguna tabla.
--   2. Un paciente SÍ lee lo suyo.
--   3. Un paciente NO lee reglas_escalado ni puede auto-prescribirse.
--   4. Un profesional solo ve a SUS pacientes asignados (no los de otro).
--   5. El anónimo (anon, sin sesión) NO lee nada.
--
-- Nota: tras el seed oncológico de WP-17, …0003 = María y …0004 = Carmen (ambas
-- pacientes de la Dra. García, cáncer de mama). Los escenarios 1-6 siguen siendo
-- válidos (son por ID). Se añaden los escenarios 7-8 (patrocinador, WP-17).
--
-- CÓMO EJECUTAR (requiere un entorno Supabase con las migraciones + ambos seeds):
--   supabase db reset                       # aplica 0001..0010 + supabase/seed.sql
--   psql "$DATABASE_URL" -f supabase/seed_wp06_segundo_profesional.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/acceso_cruzado.sql
--
-- Debe imprimir varias líneas «OK: …» y terminar con «ACCESO CRUZADO: TODO OK».
-- Cualquier fallo aborta con un mensaje «FALLO: …». Se ejecuta como el rol
-- `authenticated`/`anon` (NO como superusuario) para que la RLS se aplique.
-- Todo va en una transacción que hace ROLLBACK al final: no altera los datos.
-- =====================================================================

begin;

-- --- Escenario 1: Paciente A (Luis) NO lee datos de Paciente B (Carmen) ------
do $$
declare
  v_carmen uuid := '00000000-0000-4000-8000-000000000004';
  n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) into n from public.observaciones where paciente_id = v_carmen;
  assert n = 0, 'FALLO: Luis ve observaciones de Carmen';
  select count(*) into n from public.checkins where paciente_id = v_carmen;
  assert n = 0, 'FALLO: Luis ve check-ins de Carmen';
  select count(*) into n from public.tomas_medicacion where paciente_id = v_carmen;
  assert n = 0, 'FALLO: Luis ve tomas de Carmen';
  select count(*) into n from public.alertas where paciente_id = v_carmen;
  assert n = 0, 'FALLO: Luis ve alertas de Carmen';
  select count(*) into n from public.pacientes where id = v_carmen;
  assert n = 0, 'FALLO: Luis ve la ficha de Carmen';

  reset role;
  raise notice 'OK: un paciente NO lee datos de otro paciente';
end $$;

-- --- Escenario 2: Luis SÍ lee lo suyo ---------------------------------------
do $$
declare
  v_luis uuid := '00000000-0000-4000-8000-000000000003';
  n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) into n from public.observaciones where paciente_id = v_luis;
  assert n > 0, 'FALLO: Luis no ve sus propias observaciones';
  select count(*) into n from public.alertas where paciente_id = v_luis;
  assert n > 0, 'FALLO: Luis no ve sus propias alertas';

  reset role;
  raise notice 'OK: un paciente SÍ lee sus propios datos';
end $$;

-- --- Escenario 3: Luis NO lee reglas y NO se auto-prescribe ------------------
do $$
declare
  v_luis uuid := '00000000-0000-4000-8000-000000000003';
  n int;
  inserto_permitido boolean := false;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) into n from public.reglas_escalado;
  assert n = 0, 'FALLO: Luis lee reglas_escalado (debería no tener acceso)';

  -- Intento de auto-prescripción: la RLS debe bloquearlo (sin política de INSERT
  -- del paciente sobre pautas_medicacion).
  begin
    insert into public.pautas_medicacion (paciente_id, farmaco, momentos, critica)
    values (v_luis, 'Fármaco no autorizado', array['mañana'], false);
    inserto_permitido := true;
  exception when others then
    inserto_permitido := false; -- esperado: RLS lo rechaza
  end;
  assert inserto_permitido = false, 'FALLO: Luis pudo auto-prescribirse una pauta';

  reset role;
  raise notice 'OK: un paciente NO lee reglas ni se auto-prescribe';
end $$;

-- --- Escenario 4: la Dra. García ve a SUS pacientes, no a los de otro --------
do $$
declare
  v_luis   uuid := '00000000-0000-4000-8000-000000000003';
  v_carmen uuid := '00000000-0000-4000-8000-000000000004';
  v_marta  uuid := '00000000-0000-4000-8000-000000000006';
  n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) into n from public.pacientes where id = v_luis;
  assert n = 1, 'FALLO: la Dra. García no ve a su paciente Luis';
  select count(*) into n from public.pacientes where id = v_carmen;
  assert n = 1, 'FALLO: la Dra. García no ve a su paciente Carmen';
  select count(*) into n from public.pacientes where id = v_marta;
  assert n = 0, 'FALLO: la Dra. García ve a Marta (paciente de otro profesional)';
  select count(*) into n from public.alertas where paciente_id = v_marta;
  assert n = 0, 'FALLO: la Dra. García ve alertas de Marta';
  select count(*) into n from public.observaciones where paciente_id = v_marta;
  assert n = 0, 'FALLO: la Dra. García ve observaciones de Marta';

  reset role;
  raise notice 'OK: un profesional solo ve a SUS pacientes asignados';
end $$;

-- --- Escenario 5: el Dr. Ruiz ve a Marta, no a Luis/Carmen ------------------
do $$
declare
  v_luis  uuid := '00000000-0000-4000-8000-000000000003';
  v_marta uuid := '00000000-0000-4000-8000-000000000006';
  n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) into n from public.pacientes where id = v_marta;
  assert n = 1, 'FALLO: el Dr. Ruiz no ve a su paciente Marta';
  select count(*) into n from public.pacientes where id = v_luis;
  assert n = 0, 'FALLO: el Dr. Ruiz ve a Luis (paciente de otro profesional)';

  reset role;
  raise notice 'OK: el segundo profesional solo ve a su paciente';
end $$;

-- --- Escenario 6: el anónimo (sin sesión) NO lee nada -----------------------
do $$
declare
  n int;
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;

  select count(*) into n from public.pacientes;
  assert n = 0, 'FALLO: el anónimo lee pacientes';
  select count(*) into n from public.observaciones;
  assert n = 0, 'FALLO: el anónimo lee observaciones';
  select count(*) into n from public.alertas;
  assert n = 0, 'FALLO: el anónimo lee alertas';
  select count(*) into n from public.checkins;
  assert n = 0, 'FALLO: el anónimo lee check-ins';

  reset role;
  raise notice 'OK: el anónimo NO lee ningún dato';
end $$;

-- --- Escenario 7: el PATROCINADOR no lee NINGUNA tabla de pacientes (WP-17) ---
-- El usuario patrocinador del seed (…0009) no tiene ninguna política de lectura
-- sobre las tablas clínicas: debe ver 0 filas en todas. Su único acceso son las
-- RPC de agregados (escenario 8).
do $$
declare
  v_patro uuid := '00000000-0000-4000-8000-000000000009';
  n int;
begin
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_patro), true);
  set local role authenticated;

  select count(*) into n from public.pacientes;
  assert n = 0, 'FALLO: el patrocinador lee pacientes';
  select count(*) into n from public.observaciones;
  assert n = 0, 'FALLO: el patrocinador lee observaciones';
  select count(*) into n from public.checkins;
  assert n = 0, 'FALLO: el patrocinador lee check-ins';
  select count(*) into n from public.alertas;
  assert n = 0, 'FALLO: el patrocinador lee alertas';
  select count(*) into n from public.disposiciones;
  assert n = 0, 'FALLO: el patrocinador lee disposiciones';
  select count(*) into n from public.tomas_medicacion;
  assert n = 0, 'FALLO: el patrocinador lee tomas de medicación';
  select count(*) into n from public.pautas_medicacion;
  assert n = 0, 'FALLO: el patrocinador lee pautas de medicación';
  select count(*) into n from public.mensajes;
  assert n = 0, 'FALLO: el patrocinador lee mensajes';

  reset role;
  raise notice 'OK: el patrocinador NO lee ninguna tabla de pacientes';
end $$;

-- --- Escenario 8: las RPC de agregados aplican k-anonimato (>= 5) -------------
-- La cohorte combinada (10) devuelve agregados; el corte «Tratamiento activo»
-- (4 pacientes < 5) se OMITE / marca datos_insuficientes. El patrocinador nunca
-- obtiene un corte < 5.
do $$
declare
  v_patro   uuid := '00000000-0000-4000-8000-000000000009';
  v_oral    uuid;
  v_activo  uuid;
  v_n       int;
  v_insuf   boolean;
  v_filas   int;
begin
  select id into v_oral   from public.programas where clave = 'mama_terapia_oral' limit 1;
  select id into v_activo from public.programas where clave = 'mama_tratamiento_activo' limit 1;

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_patro), true);
  set local role authenticated;

  -- Cohorte combinada: >= 5 => hay agregados (persistencia devuelve filas).
  select count(*) into v_filas from public.patro_persistencia(null);
  assert v_filas > 0, 'FALLO: la cohorte combinada (>=5) no devuelve persistencia';

  -- «Terapia oral» (6 >= 5) => resumen suficiente.
  select n_pacientes, datos_insuficientes into v_n, v_insuf
    from public.patro_resumen_cohorte(v_oral);
  assert v_insuf = false, 'FALLO: «Terapia oral» (6) marcada como insuficiente';
  assert v_n >= 5, 'FALLO: «Terapia oral» no revela n >= 5';

  -- «Tratamiento activo» (4 < 5) => datos_insuficientes, n oculto (NULL), y la
  -- persistencia de ese corte se OMITE (0 filas).
  select n_pacientes, datos_insuficientes into v_n, v_insuf
    from public.patro_resumen_cohorte(v_activo);
  assert v_insuf = true, 'FALLO: «Tratamiento activo» (4) NO marcada insuficiente';
  assert v_n is null, 'FALLO: «Tratamiento activo» (4) revela el conteo exacto';
  select count(*) into v_filas from public.patro_persistencia(v_activo);
  assert v_filas = 0, 'FALLO: se devuelve persistencia de un corte < 5';

  reset role;
  raise notice 'OK: las RPC de agregados omiten cortes < 5 (k-anonimato)';
end $$;

do $$
begin
  raise notice '=====================================';
  raise notice 'ACCESO CRUZADO: TODO OK';
  raise notice '=====================================';
end $$;

rollback;
