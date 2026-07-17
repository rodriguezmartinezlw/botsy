-- =====================================================================
-- Botsy — seed.sql: cohorte DEMO ONCOLÓGICA (cáncer de mama) para la demo
-- vendible (WP-17). Sustituye al seed cardiovascular/geriátrico de F1.
--
-- Usuarios demo (contraseña común): Botsy1234!
--   admin@botsy.local          (admin)
--   dra.garcia@botsy.local     (profesional — Dra. García, oncóloga; Institución A)
--   dr.vega@botsy.local        (profesional — Dr. Vega; MULTI-INSTITUCIÓN A+B, WP-22)
--   patrocinador@botsy.local   (patrocinador — "Laboratorio Demo"; SOLO agregados)
--   maria@botsy.local          (paciente — María, terapia oral · PROTAGONISTA)
--   carmen@botsy.local         (paciente — Carmen, terapia oral)
--   rosa@botsy.local           (paciente — Rosa, terapia oral)
--   lucia@botsy.local          (paciente — Lucía, terapia oral)
--   elena@botsy.local          (paciente — Elena, terapia oral · DISCONTINÚA: toxicidad)
--   pilar@botsy.local          (paciente — Pilar, terapia oral)
--   sofia@botsy.local          (paciente — Sofía, tratamiento activo)
--   isabel@botsy.local         (paciente — Isabel, tratamiento activo · DISCONTINÚA: decisión)
--   nuria@botsy.local          (paciente — Nuria, tratamiento activo)
--   beatriz@botsy.local        (paciente — Beatriz, tratamiento activo)
--
-- Los usuarios se crean en auth.users con crypt(); el trigger on_auth_user_created
-- (0001, redefinido en 0009 para admitir 'patrocinador') crea su fila en perfiles
-- (y en pacientes si el rol es paciente); aquí completamos lo clínico.
--
-- Cohorte: 10 pacientes de mama. 6 en «Mama · Terapia oral», 4 en «Mama ·
-- Tratamiento activo». El patrocinador financia AMBOS programas -> la cohorte
-- combinada (10) muestra agregados; por-programa, «Tratamiento activo» (4 < 5)
-- queda SUPRIMIDO por k-anonimato (demostración de privacidad por diseño).
--
-- IMPORTANTE: NO toca supabase/seed_wp06_segundo_profesional.sql (Dr. Ruiz +
-- Marta, IDs ...0005/...0006), que sigue demostrando el aislamiento por
-- profesional (WP-06). Los IDs ...0003/...0004 se conservan como pacientes de la
-- Dra. García (los usa supabase/tests/acceso_cruzado.sql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Usuarios en auth.users + identidades email.
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'admin@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"admin","nombre":"Admin Botsy"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'dra.garcia@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"profesional","nombre":"Dra. García"}'::jsonb, now(), now(), '', '', '', '', ''),
  -- Dr. Vega (WP-22): profesional MULTI-INSTITUCIÓN (trabaja en A y en B); ejercita
  -- que un profesional en varias instituciones ve a los pacientes de todas ellas.
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007',
   'authenticated', 'authenticated', 'dr.vega@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"profesional","nombre":"Dr. Vega"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000009',
   'authenticated', 'authenticated', 'patrocinador@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"patrocinador","nombre":"Laboratorio Demo"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'maria@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"María"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'carmen@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Carmen"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000011',
   'authenticated', 'authenticated', 'rosa@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Rosa"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000012',
   'authenticated', 'authenticated', 'lucia@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Lucía"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000013',
   'authenticated', 'authenticated', 'elena@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Elena"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000014',
   'authenticated', 'authenticated', 'pilar@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Pilar"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000015',
   'authenticated', 'authenticated', 'sofia@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Sofía"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000016',
   'authenticated', 'authenticated', 'isabel@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Isabel"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000017',
   'authenticated', 'authenticated', 'nuria@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Nuria"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000018',
   'authenticated', 'authenticated', 'beatriz@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Beatriz"}'::jsonb, now(), now(), '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.id in (
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000015',
  '00000000-0000-4000-8000-000000000016','00000000-0000-4000-8000-000000000017',
  '00000000-0000-4000-8000-000000000018'
)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2) Patrocinador (organización) + enlace del usuario + cohortes financiadas.
-- ---------------------------------------------------------------------
insert into public.patrocinadores (id, nombre, tipo, activo)
values ('00000000-0000-4000-8000-000000000a01', 'Laboratorio Demo (sintético)', 'laboratorio', true)
on conflict (id) do nothing;

update public.perfiles
  set patrocinador_id = '00000000-0000-4000-8000-000000000a01', telefono = '+34600999000'
  where id = '00000000-0000-4000-8000-000000000009';

update public.perfiles set telefono = '+34600111222'
  where id = '00000000-0000-4000-8000-000000000002'; -- Dra. García

-- El patrocinador financia AMBOS programas de mama (toda la cohorte: sin acotar
-- por país/institución -> pais_codigo/institucion_id quedan NULL = todo, WP-22 §6).
insert into public.programas_patrocinados (patrocinador_id, programa_id, etiqueta_cohorte, activo)
select '00000000-0000-4000-8000-000000000a01', p.id, p.nombre, true
from public.programas p
where p.clave in ('mama_terapia_oral', 'mama_tratamiento_activo')
on conflict (patrocinador_id, programa_id) do nothing;

-- ---------------------------------------------------------------------
-- 2b) País, instituciones y membresías (WP-22).
--   País: PE (Perú) + CO/BR/ES para el catálogo.
--   Institución A: "Clínica Oncológica Lima" (PE) -> Dra. García y SUS pacientes.
--   Institución B: "Centro Oncológico Norte" (PE) -> Dr. Ruiz y Marta (seed_wp06).
--   Membresías: García->A; Vega->A y B (multi-institución). Ruiz->B en seed_wp06.
--   Coherente con las asignaciones actuales: se conserva el aislamiento que
--   verifica acceso_cruzado.sql (García/A no ve a Marta/B; Ruiz/B no ve a los de A).
-- ---------------------------------------------------------------------
insert into public.paises (codigo, nombre) values
  ('PE', 'Perú'),
  ('CO', 'Colombia'),
  ('BR', 'Brasil'),
  ('ES', 'España')
on conflict (codigo) do nothing;

insert into public.instituciones (id, nombre, tipo, pais_codigo, activa) values
  ('00000000-0000-4000-8000-000000000b01', 'Clínica Oncológica Lima',  'centro_oncologico', 'PE', true),
  ('00000000-0000-4000-8000-000000000b02', 'Centro Oncológico Norte',  'centro_oncologico', 'PE', true)
on conflict (id) do nothing;

-- Membresías: García -> A; Vega -> A y B (multi-institución).
insert into public.profesionales_instituciones (profesional_id, institucion_id, activa) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000b01', true), -- García -> A
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000b01', true), -- Vega -> A
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000b02', true)  -- Vega -> B
on conflict (profesional_id, institucion_id) do nothing;

update public.perfiles set telefono = '+34600555777'
  where id = '00000000-0000-4000-8000-000000000007'; -- Dr. Vega

-- ---------------------------------------------------------------------
-- 3) Cohorte + 45 días de historial HASTA AYER (WP-24 §D: el día actual
--    queda LIBRE para la demo — el check-in de hoy lo hace la persona en
--    vivo). Un DO block recorre las 10 pacientes: datos clínicos, pauta oral
--    (con inicio fechado y 2 discontinuaciones codificadas), asignación de
--    programa, y 45 días de check-ins / observaciones (ánimo/ansiedad/estrés
--    = distrés variado) / tomas (adherencia por paciente). Deterministic
--    (hashtext) => reproducible.
-- ---------------------------------------------------------------------
do $$
declare
  v_garcia      uuid := '00000000-0000-4000-8000-000000000002';
  v_inst_a      uuid := '00000000-0000-4000-8000-000000000b01'; -- Clínica Oncológica Lima (WP-22)
  v_prog_oral   uuid;
  v_prog_activo uuid;
  v_pac    uuid[] := array[
    '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000014',
    '00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000016',
    '00000000-0000-4000-8000-000000000017','00000000-0000-4000-8000-000000000018']::uuid[];
  v_pauta  uuid[] := array[
    '00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-000000000206',
    '00000000-0000-4000-8000-000000000207','00000000-0000-4000-8000-000000000208',
    '00000000-0000-4000-8000-000000000209','00000000-0000-4000-8000-000000000210']::uuid[];
  v_prog   text[] := array['oral','oral','oral','oral','oral','oral','activo','activo','activo','activo'];
  v_farm   text[] := array['Tamoxifeno','Letrozol','Anastrozol','Tamoxifeno','Letrozol','Exemestano','Palbociclib','Ribociclib','Palbociclib','Abemaciclib'];
  v_dosis  text[] := array['20 mg','2,5 mg','1 mg','20 mg','2,5 mg','25 mg','125 mg','600 mg','125 mg','150 mg'];
  v_nace   text[] := array['1969-03-11','1961-07-02','1975-01-20','1958-11-05','1966-09-14','1972-04-30','1980-06-18','1954-02-25','1963-12-01','1977-08-08'];
  v_inicio int[]  := array[200,120,300,240,150,90,75,130,180,60];
  v_disc   int[]  := array[null,null,null,null,22,null,null,10,null,null]::int[];
  v_motivo text[] := array['','','','','toxicidad','','','decision_paciente','',''];
  v_adher  numeric[] := array[0.90,0.95,0.88,0.85,0.70,0.92,0.90,0.60,0.87,0.91];
  v_cumpl  numeric[] := array[0.93,0.90,0.87,0.88,0.80,0.95,0.92,0.78,0.90,0.86];
  i int; d int;
  v_prog_id  uuid;
  v_motivo_id uuid;
  v_disc_date date;
  v_activa   boolean;
  v_fecha    date;
  v_dias_atras int;
  v_checkin  uuid;
  v_canal    text;
  v_animo    numeric; v_ansiedad numeric; v_estres numeric;
  v_activa_dia boolean;
  v_tomada   boolean;
begin
  select id into v_prog_oral   from public.programas where clave = 'mama_terapia_oral' limit 1;
  select id into v_prog_activo from public.programas where clave = 'mama_tratamiento_activo' limit 1;

  for i in 1..array_length(v_pac, 1) loop
    v_prog_id := case when v_prog[i] = 'oral' then v_prog_oral else v_prog_activo end;
    v_motivo_id := null;
    if v_motivo[i] <> '' then
      select id into v_motivo_id from public.catalogo_motivos
        where ambito = 'discontinuacion' and codigo = v_motivo[i] limit 1;
    end if;
    v_disc_date := case when v_disc[i] is null then null else current_date - v_disc[i] end;
    v_activa := v_disc[i] is null;

    -- Datos clínicos de la paciente.
    update public.pacientes set
      fecha_nacimiento = v_nace[i]::date,
      sexo             = 'femenino',
      vertical         = 'general',
      condiciones      = array['Cáncer de mama'],
      profesional_id   = v_garcia,       -- médico responsable (contacto/escalado)
      institucion_id   = v_inst_a,       -- WP-22: pertenencia -> visibilidad por institución
      telefono_medico  = '+34600111222',
      hora_checkin     = '10:00',
      racha_actual     = 12,
      racha_maxima     = 30,
      ultimo_checkin   = current_date - 1  -- WP-24 §D: el seed llega hasta AYER
      where id = v_pac[i];

    -- Pauta oral (con inicio fechado y discontinuación codificada si procede).
    insert into public.pautas_medicacion (
      id, paciente_id, farmaco, dosis, momentos, critica, activa, creada_por,
      creado_en, desactivada_en, discontinuada_en, motivo_discontinuacion
    ) values (
      v_pauta[i], v_pac[i], v_farm[i], v_dosis[i], array['mañana'],
      (v_prog[i] = 'activo'),  -- las orales concomitantes del tratamiento activo se marcan importantes
      v_activa, v_garcia,
      (now() - (v_inicio[i] || ' days')::interval),
      case when v_disc_date is null then null else (v_disc_date + time '12:00')::timestamptz end,
      v_disc_date, v_motivo_id
    ) on conflict (id) do nothing;

    -- Asignación de programa (activo).
    insert into public.programas_paciente (
      paciente_id, programa_id, estado, fecha_inicio, asignado_por
    ) values (
      v_pac[i], v_prog_id, 'activo', current_date - v_inicio[i], v_garcia
    ) on conflict do nothing;

    -- 45 días de historial que terminan AYER (current_date - 1): el día
    -- actual queda libre para la demo (WP-24 §D).
    for d in 0..44 loop
      v_dias_atras := 44 - d;
      v_fecha := current_date - 1 - v_dias_atras;

      -- Cumplimiento del check-in (protagonista SIEMPRE registra ayer, para el guion).
      if not (i = 1 and d = 44)
         and (abs(hashtext(v_pac[i]::text || d::text)) % 100) >= (v_cumpl[i] * 100) then
        continue;
      end if;

      v_checkin := gen_random_uuid();
      v_canal := case when i = 1 and d = 44 then 'voz'
                      when (abs(hashtext(v_pac[i]::text || 'c' || d::text)) % 3) = 0 then 'voz'
                      else 'texto' end;

      insert into public.checkins (
        id, paciente_id, fecha, canal, estado, dominios_cubiertos, resumen,
        riesgo, duracion_seg, audio_path, finalizado_en, creado_en
      ) values (
        v_checkin, v_pac[i], v_fecha, v_canal, 'completado',
        '{"adherencia": true, "sintomas_fisicos": true, "animo": true}'::jsonb,
        'Check-in diario de seguimiento oncológico completado.',
        case when i = 1 and d = 44 then 'contactar' else 'normal' end,
        90 + (abs(hashtext(v_checkin::text)) % 60),
        case when v_canal = 'voz' then v_pac[i]::text || '/' || v_fecha::text || '.webm' else null end,
        (v_fecha + time '09:05')::timestamptz,
        (v_fecha + time '09:00')::timestamptz
      );

      -- Distrés variado: ánimo/ansiedad/estrés con base por paciente + ruido.
      v_animo    := least(9, greatest(1, 5 + (i % 4) + ((abs(hashtext(v_checkin::text || 'a')) % 3) - 1)));
      v_ansiedad := least(9, greatest(1, 6 - (i % 3) + ((abs(hashtext(v_checkin::text || 'b')) % 3) - 1)));
      v_estres   := least(9, greatest(1, 5 + (i % 3) + ((abs(hashtext(v_checkin::text || 'e')) % 3) - 1)));
      insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen) values
        (v_checkin, v_pac[i], 'animo',    'animo_estado',    v_animo,    0.8, 'conversacion'),
        (v_checkin, v_pac[i], 'ansiedad', 'ansiedad_estado', v_ansiedad, 0.8, 'conversacion'),
        (v_checkin, v_pac[i], 'estres',   'estres_estado',   v_estres,   0.8, 'conversacion');

      -- Fatiga ocasional (síntoma de ciclo).
      if (abs(hashtext(v_checkin::text || 'f')) % 100) < 25 then
        insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen)
        values (v_checkin, v_pac[i], 'sintoma_fisico', 'fatiga',
                least(8, 3 + (abs(hashtext(v_checkin::text)) % 5)), 0.7, 'conversacion');
      end if;

      -- Toma de la mañana (solo mientras la pauta está activa).
      v_activa_dia := v_disc[i] is null or v_dias_atras > v_disc[i];
      if v_activa_dia then
        v_tomada := (abs(hashtext(v_pac[i]::text || 'toma' || d::text)) % 100) < (v_adher[i] * 100);
        insert into public.tomas_medicacion (pauta_id, paciente_id, checkin_id, fecha, momento, estado)
        values (v_pauta[i], v_pac[i], v_checkin, v_fecha, 'mañana',
                case when v_tomada then 'tomada' else 'omitida' end);
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4) Alertas en los CUATRO estados + disposiciones con desenlace.
--    Cubre: nueva (María, fiebre AYER — el día actual queda libre, WP-24 §D),
--    vista (Lucía), resuelta (varias con
--    disposición + desenlace) y descartada (Beatriz). >= 5 disposiciones y 4
--    "resuelto_sin_evento" sobre contactar/urgencia (proxy de urgencias
--    evitadas del ROI). Los tiempos permiten señal->alerta y alerta->disposición.
-- ---------------------------------------------------------------------
do $$
declare
  v_garcia   uuid := '00000000-0000-4000-8000-000000000002';
  v_mot_disp uuid;
  v_mot_desc uuid;
  v_ck uuid; v_al uuid; v_pac uuid; v_fecha date;
begin
  select id into v_mot_disp from public.catalogo_motivos where ambito = 'disposicion' and codigo = 'contactado_sin_hallazgos' limit 1;
  select id into v_mot_desc from public.catalogo_motivos where ambito = 'descarte'    and codigo = 'falso_positivo'        limit 1;

  -- ===== María (…003): fiebre AYER -> contactar NUEVA (sin disposición) =====
  v_pac := '00000000-0000-4000-8000-000000000003'; v_fecha := current_date - 1;
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen)
  values (v_ck, v_pac, 'sintoma_fisico', 'fiebre', 38.2, 0.9, 'conversacion');
  insert into public.mensajes (checkin_id, rol, contenido, orden) values
    (v_ck, 'asistente', 'Hola María, ¿cómo te encuentras hoy? ¿Te has tomado la temperatura?', 1),
    (v_ck, 'paciente',  'Me noto destemplada, me he puesto el termómetro y tengo treinta y ocho y dos.', 2),
    (v_ck, 'asistente', 'Gracias por contármelo. Voy a avisar a tu equipo para que te contacten. Mantente en reposo y con líquidos.', 3);
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, creado_en)
  values (v_pac, v_ck, 'contactar', 'Fiebre en terapia oral',
    jsonb_build_object('detalle', jsonb_build_array('Fiebre 38.2 °C reportada en el último check-in.'),
      'fragmento', 'tengo treinta y ocho y dos'), 'nueva', (v_fecha + time '09:30')::timestamptz);

  -- ===== Rosa (…011): contactar 15 d -> RESUELTA, resuelto_sin_evento =====
  v_pac := '00000000-0000-4000-8000-000000000011'; v_fecha := current_date - 15;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'texto', 'completado', '{"sintomas_fisicos": true}'::jsonb, 'Check-in con síntoma digestivo.', 'contactar', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'contactar', 'Diarrea intensa',
      jsonb_build_object('detalle', jsonb_build_array('Diarrea intensa reportada (intensidad 7/10).')),
      'resuelta', v_garcia, (v_fecha + time '14:30')::timestamptz, (v_fecha + time '09:30')::timestamptz)
    returning id into v_al;
  insert into public.disposiciones (alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, desenlace_nota, desenlace_registrado_en, creada_por, creado_en)
    values (v_al, 'contactado_paciente', v_mot_disp, 3, 'resuelto_sin_evento', 'Contactada; hidratación y ajuste de dieta. Sin necesidad de acudir a urgencias.', (v_fecha + time '18:00')::timestamptz, v_garcia, (v_fecha + time '14:00')::timestamptz);

  -- ===== Carmen (…004): contactar 25 d -> RESUELTA, resuelto_sin_evento =====
  v_pac := '00000000-0000-4000-8000-000000000004'; v_fecha := current_date - 25;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'voz', 'completado', '{"dolor": true}'::jsonb, 'Check-in con dolor.', 'contactar', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'contactar', 'Dolor alto sostenido',
      jsonb_build_object('detalle', jsonb_build_array('Dolor 7/10 durante 2 días.')),
      'resuelta', v_garcia, (v_fecha + time '12:20')::timestamptz, (v_fecha + time '09:30')::timestamptz)
    returning id into v_al;
  insert into public.disposiciones (alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, desenlace_nota, desenlace_registrado_en, creada_por, creado_en)
    values (v_al, 'contactado_paciente', v_mot_disp, 5, 'resuelto_sin_evento', 'Analgesia pautada; mejora al seguimiento.', (v_fecha + time '17:00')::timestamptz, v_garcia, (v_fecha + time '12:00')::timestamptz);

  -- ===== Pilar (…014): vigilancia 20 d -> RESUELTA, visita_no_programada =====
  v_pac := '00000000-0000-4000-8000-000000000014'; v_fecha := current_date - 20;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'texto', 'completado', '{"animo": true}'::jsonb, 'Check-in con ánimo bajo.', 'vigilancia', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'vigilancia', 'Ánimo bajo sostenido',
      jsonb_build_object('detalle', jsonb_build_array('Ánimo <= 3 durante 3 días.')),
      'resuelta', v_garcia, (v_fecha + time '11:30')::timestamptz, (v_fecha + time '09:30')::timestamptz)
    returning id into v_al;
  insert into public.disposiciones (alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, desenlace_nota, desenlace_registrado_en, creada_por, creado_en)
    values (v_al, 'derivado_consulta', v_mot_disp, 7, 'visita_no_programada', 'Derivada a psicooncología; acude a visita.', (v_fecha + time '16:00')::timestamptz, v_garcia, (v_fecha + time '11:00')::timestamptz);

  -- ===== Elena (…013): contactar 24 d -> RESUELTA, discontinuacion (toxicidad) =====
  v_pac := '00000000-0000-4000-8000-000000000013'; v_fecha := current_date - 24;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'texto', 'completado', '{"sintomas_fisicos": true}'::jsonb, 'Check-in con toxicidad.', 'contactar', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'contactar', 'Toxicidad mantenida',
      jsonb_build_object('detalle', jsonb_build_array('Toxicidad digestiva y fatiga mantenidas.')),
      'resuelta', v_garcia, (v_fecha + time '13:10')::timestamptz, (v_fecha + time '09:30')::timestamptz)
    returning id into v_al;
  insert into public.disposiciones (alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, desenlace_nota, desenlace_registrado_en, creada_por, creado_en)
    values (v_al, 'ajuste_pauta', v_mot_disp, 7, 'discontinuacion', 'Se discontinúa por toxicidad; pendiente de cambio de línea.', (v_fecha + time '20:00')::timestamptz, v_garcia, (v_fecha + time '13:00')::timestamptz);

  -- ===== Lucía (…012): vigilancia 5 d -> VISTA (sin disposición aún) =====
  v_pac := '00000000-0000-4000-8000-000000000012'; v_fecha := current_date - 5;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'texto', 'completado', '{"animo": true}'::jsonb, 'Check-in con ánimo bajo.', 'vigilancia', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.mensajes (checkin_id, rol, contenido, orden) values
    (v_ck, 'asistente', 'Hola Lucía, ¿cómo llevas el ánimo estos días?', 1),
    (v_ck, 'paciente',  'Un poco baja, la verdad.', 2);
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'vigilancia', 'Ánimo bajo sostenido',
      jsonb_build_object('detalle', jsonb_build_array('Ánimo <= 3 durante 3 días.'),
        'fragmento', 'Un poco baja, la verdad.'),
      'vista', v_garcia, (v_fecha + time '10:30')::timestamptz, (v_fecha + time '09:30')::timestamptz);

  -- ===== Sofía (…015): fiebre 12 d -> URGENCIA (neutropenia febril), resuelta =====
  v_pac := '00000000-0000-4000-8000-000000000015'; v_fecha := current_date - 12;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'voz', 'completado', '{"sintomas_fisicos": true}'::jsonb, 'Check-in con fiebre en tratamiento activo.', 'urgencia', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen)
    values (v_ck, v_pac, 'sintoma_fisico', 'fiebre', 38.6, 0.9, 'conversacion');
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'urgencia', 'Fiebre en tratamiento activo',
      jsonb_build_object('detalle', jsonb_build_array('Fiebre 38.6 °C: posible neutropenia febril.')),
      'resuelta', v_garcia, (v_fecha + time '10:00')::timestamptz, (v_fecha + time '09:30')::timestamptz)
    returning id into v_al;
  insert into public.disposiciones (alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, desenlace_nota, desenlace_registrado_en, creada_por, creado_en)
    values (v_al, 'derivado_urgencias', v_mot_disp, 2, 'resuelto_sin_evento', 'Valorada de urgencia; hemograma normal, alta el mismo día.', (v_fecha + time '15:00')::timestamptz, v_garcia, (v_fecha + time '10:00')::timestamptz);

  -- ===== Nuria (…017): contactar 9 d -> RESUELTA, resuelto_sin_evento =====
  v_pac := '00000000-0000-4000-8000-000000000017'; v_fecha := current_date - 9;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'texto', 'completado', '{"sintomas_fisicos": true}'::jsonb, 'Check-in con náuseas.', 'contactar', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'contactar', 'Vómitos que impiden la ingesta',
      jsonb_build_object('detalle', jsonb_build_array('Vómitos que dificultan la ingesta (7/10).')),
      'resuelta', v_garcia, (v_fecha + time '12:40')::timestamptz, (v_fecha + time '09:30')::timestamptz)
    returning id into v_al;
  insert into public.disposiciones (alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, desenlace_nota, desenlace_registrado_en, creada_por, creado_en)
    values (v_al, 'contactado_paciente', v_mot_disp, 3, 'resuelto_sin_evento', 'Antiemético reforzado; tolera ingesta al día siguiente.', (v_fecha + time '16:30')::timestamptz, v_garcia, (v_fecha + time '12:00')::timestamptz);

  -- ===== Beatriz (…018): contactar 18 d -> DESCARTADA (falso positivo) =====
  v_pac := '00000000-0000-4000-8000-000000000018'; v_fecha := current_date - 18;
  insert into public.checkins (paciente_id, fecha, canal, estado, dominios_cubiertos, resumen, riesgo, finalizado_en, creado_en)
    values (v_pac, v_fecha, 'texto', 'completado', '{"sintomas_fisicos": true}'::jsonb, 'Check-in con dato dudoso.', 'contactar', (v_fecha + time '09:05')::timestamptz, (v_fecha + time '09:00')::timestamptz)
    on conflict (paciente_id, fecha) where tipo = 'checkin' do nothing; -- índice único parcial (0020)
  select id into v_ck from public.checkins where paciente_id = v_pac and fecha = v_fecha limit 1;
  insert into public.alertas (paciente_id, checkin_id, nivel, motivo, evidencia, estado, motivo_descarte, gestionada_por, gestionada_en, creado_en)
    values (v_pac, v_ck, 'contactar', 'Diarrea intensa',
      jsonb_build_object('detalle', jsonb_build_array('Intensidad reportada dudosa; probable dato mal capturado.')),
      'descartada', 'Dato mal capturado durante el check-in; sin diarrea real.', v_garcia, (v_fecha + time '11:15')::timestamptz, (v_fecha + time '09:30')::timestamptz)
    returning id into v_al;
  insert into public.disposiciones (alerta_id, decision, motivo_codigo, dias_seguimiento, desenlace, desenlace_nota, desenlace_registrado_en, creada_por, creado_en)
    values (v_al, 'sin_accion_justificada', v_mot_desc, 0, 'otro', 'Falso positivo; sin acción clínica.', (v_fecha + time '11:20')::timestamptz, v_garcia, (v_fecha + time '11:15')::timestamptz);
end $$;

-- ---------------------------------------------------------------------
-- 5) Consentimientos (append-only; vigente = último por tipo).
--    Todas otorgan conversación; grabación de voz las 6 de terapia oral;
--    uso_secundario (opt-in separado) María y Rosa; Beatriz lo revoca (historial).
-- ---------------------------------------------------------------------
insert into public.consentimientos (paciente_id, tipo, otorgado, version_texto, registrado_en)
select v_pac, 'conversacion', true, 'v0-borrador', now() - interval '45 days'
from unnest(array[
  '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000014',
  '00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000016',
  '00000000-0000-4000-8000-000000000017','00000000-0000-4000-8000-000000000018'
]::uuid[]) as v_pac;

insert into public.consentimientos (paciente_id, tipo, otorgado, version_texto, registrado_en)
select v_pac, 'voz_grabacion', true, 'v0-borrador', now() - interval '45 days'
from unnest(array[
  '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000014'
]::uuid[]) as v_pac;

insert into public.consentimientos (paciente_id, tipo, otorgado, version_texto, registrado_en)
values
  -- Opt-in de uso secundario (María, Rosa).
  ('00000000-0000-4000-8000-000000000003', 'uso_secundario', true,  'v0-borrador', now() - interval '40 days'),
  ('00000000-0000-4000-8000-000000000011', 'uso_secundario', true,  'v0-borrador', now() - interval '30 days'),
  -- Beatriz prueba uso secundario y lo revoca (historial demostrable).
  ('00000000-0000-4000-8000-000000000018', 'uso_secundario', true,  'v0-borrador', now() - interval '20 days'),
  ('00000000-0000-4000-8000-000000000018', 'uso_secundario', false, 'v0-borrador', now() - interval '8 days');

-- =====================================================================
-- Materialización de las reglas de escalado del programa asignado
-- (WP-09 — corrección del director). El panel materializa las reglas al
-- ASIGNAR el programa (sincronizarReglasPrograma); como el seed inserta las
-- asignaciones directamente, replicamos aquí esa lógica para que las reglas
-- oncológicas (fiebre, distrés, etc.) existan por paciente y el escalado
-- funcione en un check-in real. Idempotente: no duplica por nombre+asignación.
-- =====================================================================
insert into public.reglas_escalado
  (paciente_id, vertical, nombre, descripcion, condicion, nivel, activa, programa_paciente_id)
select pp.paciente_id, null, r->>'nombre', r->>'descripcion', r->'condicion',
       (r->>'nivel')::text, true, pp.id
from public.programas_paciente pp
join public.programas p on p.id = pp.programa_id
cross join lateral jsonb_array_elements(p.config->'escalado'->'reglas_clave') as r
where pp.estado = 'activo'
  and not exists (
    select 1 from public.reglas_escalado re
    where re.programa_paciente_id = pp.id and re.nombre = r->>'nombre'
  );
