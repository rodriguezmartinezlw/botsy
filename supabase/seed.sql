-- =====================================================================
-- Botsy — seed.sql: datos demo para desarrollo local (`supabase db reset`).
--
-- Usuarios demo (contraseña común): Botsy1234!
--   admin@botsy.local        (admin)
--   dra.garcia@botsy.local   (profesional — Dra. García)
--   luis@botsy.local         (paciente  — Luis, 68, cardiovascular)
--   carmen@botsy.local       (paciente  — Carmen, 74, geriátrica)
--
-- Nota: los usuarios se crean directamente en auth.users con crypt().
-- El trigger on_auth_user_created (0001) crea automáticamente su fila en
-- `perfiles` (y en `pacientes` si el rol es paciente) leyendo rol/nombre
-- de raw_user_meta_data; aquí solo completamos los campos clínicos.
-- Alternativa si este bloque falla por cambios del esquema de GoTrue:
-- crear los usuarios con la Auth Admin API y luego ejecutar solo los
-- UPDATE/INSERT clínicos de más abajo.
--
-- WP-08: demo AMPLIADA. Luis pasa de 14 a 45 días de historial con
-- tendencias creíbles (dolor descendente con dos brotes, ánimo/ansiedad/
-- estrés/sueño evolucionando) y alertas en los CUATRO estados de gestión
-- (nueva / vista / resuelta / descartada). Se añade historial clínico a
-- Carmen y un historial de consentimientos con cambios. El seed del segundo
-- profesional (supabase/seed_wp06_segundo_profesional.sql) NO se toca.
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
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'luis@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Luis"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'carmen@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Carmen"}'::jsonb, now(), now(), '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   '{"sub":"00000000-0000-4000-8000-000000000001","email":"admin@botsy.local"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002',
   '{"sub":"00000000-0000-4000-8000-000000000002","email":"dra.garcia@botsy.local"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003',
   '{"sub":"00000000-0000-4000-8000-000000000003","email":"luis@botsy.local"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004',
   '{"sub":"00000000-0000-4000-8000-000000000004","email":"carmen@botsy.local"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2) Completar perfiles (el trigger ya creó las filas base).
-- ---------------------------------------------------------------------
update public.perfiles set telefono = '+34600111222'
  where id = '00000000-0000-4000-8000-000000000002'; -- Dra. García
update public.perfiles set telefono = '+34611000001'
  where id = '00000000-0000-4000-8000-000000000003'; -- Luis
update public.perfiles set telefono = '+34611000002'
  where id = '00000000-0000-4000-8000-000000000004'; -- Carmen

-- ---------------------------------------------------------------------
-- 3) Datos clínicos de los pacientes (el trigger ya creó las filas base).
-- ---------------------------------------------------------------------
update public.pacientes set
  fecha_nacimiento = '1958-04-12',
  sexo             = 'masculino',
  vertical         = 'cardiovascular',
  condiciones      = array['Hipertensión', 'Fibrilación auricular'],
  profesional_id   = '00000000-0000-4000-8000-000000000002',
  telefono_medico  = '+34600111222',
  hora_checkin     = '09:30',
  racha_actual     = 45,
  racha_maxima     = 45,
  ultimo_checkin   = current_date
  where id = '00000000-0000-4000-8000-000000000003'; -- Luis

update public.pacientes set
  fecha_nacimiento = '1952-09-03',
  sexo             = 'femenino',
  vertical         = 'geriatrica',
  condiciones      = array['Artrosis', 'Deterioro cognitivo leve'],
  profesional_id   = '00000000-0000-4000-8000-000000000002',
  telefono_medico  = '+34600111222',
  hora_checkin     = '11:00',
  racha_actual     = 12,
  racha_maxima     = 12,
  ultimo_checkin   = current_date
  where id = '00000000-0000-4000-8000-000000000004'; -- Carmen

-- ---------------------------------------------------------------------
-- 4) Pautas de medicación de Luis: AAS (no crítica) + warfarina (crítica).
-- ---------------------------------------------------------------------
insert into public.pautas_medicacion (id, paciente_id, farmaco, dosis, momentos, critica, activa, creada_por)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000003',
   'Ácido acetilsalicílico', '100 mg', array['mañana'], false, true,
   '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000003',
   'Warfarina', '5 mg', array['noche'], true, true,
   '00000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- Pauta de Carmen (analgésico para la artrosis, no crítico).
insert into public.pautas_medicacion (id, paciente_id, farmaco, dosis, momentos, critica, activa, creada_por)
values
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000004',
   'Paracetamol', '1 g', array['mañana', 'noche'], false, true,
   '00000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5) 45 días de check-ins, observaciones y tomas de Luis.
--    - Dolor descendente 7 -> 2 con dos brotes puntuales (día -33 y día -20).
--    - Ánimo mejorando 5 -> 8, con un bajón sostenido de 3 días (días -8..-6).
--    - Ansiedad y estrés a la baja; sueño mejorando.
--    - Warfarina omitida en un día aislado (día -25) y las 2 últimas noches.
--    - Alertas en los CUATRO estados: descartada (brote antiguo), resuelta
--      (brote medio), vista (bajón de ánimo), nueva (fármaco crítico, hoy).
-- ---------------------------------------------------------------------
do $$
declare
  v_luis        uuid := '00000000-0000-4000-8000-000000000003';
  v_garcia      uuid := '00000000-0000-4000-8000-000000000002';
  v_pauta_aas   uuid := '00000000-0000-4000-8000-000000000101';
  v_pauta_warf  uuid := '00000000-0000-4000-8000-000000000102';
  v_regla_farm  uuid;
  v_regla_dolor uuid;
  v_regla_animo uuid;
  d             int;
  v_fecha       date;
  v_checkin     uuid;
  v_canal       text;
  v_dolor       numeric;
  v_animo       numeric;
  v_ansiedad    numeric;
  v_estres      numeric;
  v_sueno       numeric;
  v_estado_warf text;
begin
  select id into v_regla_farm  from public.reglas_escalado where nombre = 'Fármaco crítico omitido' limit 1;
  select id into v_regla_dolor from public.reglas_escalado where nombre = 'Dolor intenso' limit 1;
  select id into v_regla_animo from public.reglas_escalado where nombre = 'Ánimo bajo sostenido' limit 1;

  for d in 0..44 loop
    v_fecha := current_date - (44 - d);
    v_canal := case when d % 3 = 0 then 'voz' else 'texto' end;

    -- Dolor: descenso 7->2 con dos brotes (d=12 y d=25 => días -33 y -20).
    v_dolor := case
      when d in (12, 25) then 9
      else greatest(2, round(7 - (d * 5.0 / 44)))
    end;
    -- Ánimo: mejora 5->8 con bajón sostenido de 3 días (d=36,37,38 => -8..-6).
    v_animo := case
      when d in (36, 37, 38) then 3
      else least(9, round(5 + (d * 3.0 / 44)))
    end;
    v_ansiedad := greatest(2, round(6 - (d * 3.0 / 44)));  -- 6 -> 3
    v_estres   := greatest(2, round(6 - (d * 3.0 / 44)));  -- 6 -> 3
    v_sueno    := least(9, round(5 + (d * 2.0 / 44)));     -- 5 -> 7

    v_checkin := gen_random_uuid();

    insert into public.checkins (
      id, paciente_id, fecha, canal, estado, dominios_cubiertos, resumen,
      riesgo, duracion_seg, audio_path, finalizado_en
    ) values (
      v_checkin, v_luis, v_fecha, v_canal, 'completado',
      '{"dolor": true, "animo": true, "sueno": true, "adherencia": true}'::jsonb,
      'Check-in diario completado. Dolor ' || v_dolor::text || '/10, ánimo ' || v_animo::text || '/10.',
      case
        when d = 44 then 'contactar'                 -- hoy: fármaco crítico
        when d = 25 then 'contactar'                 -- brote medio (resuelto)
        when d = 12 then 'contactar'                 -- brote antiguo (descartado)
        when d in (36, 37, 38) then 'vigilancia'     -- bajón de ánimo
        else 'normal'
      end,
      120 + (d % 7) * 8,
      case when v_canal = 'voz' then v_luis::text || '/' || v_fecha::text || '.webm' else null end,
      (v_fecha + time '09:35')::timestamptz
    );

    -- Observaciones del día (dolor, ánimo, ansiedad, estrés, sueño).
    insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen) values
      (v_checkin, v_luis, 'dolor',    'dolor_generalizado', v_dolor,    0.9, 'conversacion'),
      (v_checkin, v_luis, 'animo',    'animo_estado',       v_animo,    0.8, 'conversacion'),
      (v_checkin, v_luis, 'ansiedad', 'ansiedad_estado',    v_ansiedad, 0.8, 'conversacion'),
      (v_checkin, v_luis, 'estres',   'estres_estado',      v_estres,   0.8, 'conversacion'),
      (v_checkin, v_luis, 'sueno',    'horas_sueno',        v_sueno,    0.8, 'conversacion');

    -- En los días de brote, una molestia física puntual (sin dolor_toracico/disnea
    -- para no simular el patrón de urgencia cardiovascular).
    if d in (12, 25) then
      insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_texto, confianza, origen)
      values (v_checkin, v_luis, 'sintoma_fisico', 'molestia_general',
              'Molestias generalizadas y cansancio.', 0.7, 'conversacion');
    end if;

    -- Toma de AAS (mañana): siempre tomada.
    insert into public.tomas_medicacion (pauta_id, paciente_id, checkin_id, fecha, momento, estado)
    values (v_pauta_aas, v_luis, v_checkin, v_fecha, 'mañana', 'tomada');

    -- Warfarina (noche): omitida en un día aislado (d=19) y las 2 últimas noches.
    v_estado_warf := case when d in (19, 43, 44) then 'omitida' else 'tomada' end;
    insert into public.tomas_medicacion (pauta_id, paciente_id, checkin_id, fecha, momento, estado)
    values (v_pauta_warf, v_luis, v_checkin, v_fecha, 'noche', v_estado_warf);

    -- --- Alertas en distintos estados de gestión --------------------------

    -- Brote antiguo (día -33): alerta DESCARTADA con motivo.
    if d = 12 then
      insert into public.alertas (
        paciente_id, checkin_id, regla_id, nivel, motivo, evidencia, estado,
        motivo_descarte, gestionada_por, gestionada_en
      ) values (
        v_luis, v_checkin, v_regla_dolor, 'contactar', 'Dolor intenso',
        jsonb_build_object(
          'detalle', jsonb_build_array('Dolor reportado 9/10 (escala 0-10).'),
          'observaciones', jsonb_build_array(
            jsonb_build_object('dominio','dolor','codigo','dolor_generalizado','valor_num',9)
          )
        ),
        'descartada',
        'Contactado el paciente: brote puntual por sobreesfuerzo, ya remitido. Falso positivo clínico.',
        v_garcia, (v_fecha + time '12:10')::timestamptz
      );
    end if;

    -- Brote medio (día -20): alerta RESUELTA.
    if d = 25 then
      insert into public.alertas (
        paciente_id, checkin_id, regla_id, nivel, motivo, evidencia, estado,
        gestionada_por, gestionada_en
      ) values (
        v_luis, v_checkin, v_regla_dolor, 'contactar', 'Dolor intenso',
        jsonb_build_object(
          'detalle', jsonb_build_array('Dolor reportado 9/10 (escala 0-10).'),
          'observaciones', jsonb_build_array(
            jsonb_build_object('dominio','dolor','codigo','dolor_generalizado','valor_num',9)
          )
        ),
        'resuelta',
        v_garcia, (v_fecha + time '13:00')::timestamptz
      );
    end if;

    -- Bajón de ánimo sostenido (día -6): alerta VISTA (aún sin resolver).
    if d = 38 then
      insert into public.mensajes (checkin_id, rol, contenido, orden) values
        (v_checkin, 'asistente', 'Hola Luis, ¿cómo llevas el ánimo estos días?', 1),
        (v_checkin, 'paciente',  'La verdad es que estoy bastante bajo desde hace días.', 2);
      insert into public.alertas (
        paciente_id, checkin_id, regla_id, nivel, motivo, evidencia, estado,
        gestionada_por, gestionada_en
      ) values (
        v_luis, v_checkin, v_regla_animo, 'vigilancia', 'Ánimo bajo sostenido',
        jsonb_build_object(
          'detalle', jsonb_build_array('Ánimo <= 3 durante 3 días consecutivos.'),
          'observaciones', jsonb_build_array(
            jsonb_build_object('dominio','animo','codigo','animo_estado','valor_num',3)
          ),
          'fragmento', 'La verdad es que estoy bastante bajo desde hace días.'
        ),
        'vista',
        v_garcia, (v_fecha + time '12:30')::timestamptz
      );
    end if;

    -- Hoy (día 0): conversación de ejemplo + alerta NUEVA (fármaco crítico).
    if d = 44 then
      insert into public.mensajes (checkin_id, rol, contenido, orden) values
        (v_checkin, 'asistente', 'Hola Luis, ¿cómo te encuentras hoy?', 1),
        (v_checkin, 'paciente',  'Bastante mejor del dolor, casi no me molesta.', 2),
        (v_checkin, 'asistente', '¿Tomaste anoche la pastilla de la warfarina?', 3),
        (v_checkin, 'paciente',  'Anoche se me volvió a olvidar.', 4);

      insert into public.alertas (
        paciente_id, checkin_id, regla_id, nivel, motivo, evidencia, estado
      ) values (
        v_luis, v_checkin, v_regla_farm, 'contactar', 'Fármaco crítico omitido',
        jsonb_build_object(
          'detalle', jsonb_build_array('Warfarina (crítica) omitida 2 noches consecutivas.'),
          'fechas_omitidas', jsonb_build_array((current_date - 1)::text, current_date::text),
          'fragmento', 'Anoche se me volvió a olvidar.'
        ),
        'nueva'
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5b) 12 días de check-ins de Carmen (geriátrica, estable, sin alertas).
--     Cognición y ánimo estables; adherencia buena al paracetamol.
-- ---------------------------------------------------------------------
do $$
declare
  v_carmen   uuid := '00000000-0000-4000-8000-000000000004';
  v_pauta    uuid := '00000000-0000-4000-8000-000000000104';
  d          int;
  v_fecha    date;
  v_checkin  uuid;
begin
  for d in 0..11 loop
    v_fecha   := current_date - (11 - d);
    v_checkin := gen_random_uuid();

    insert into public.checkins (
      id, paciente_id, fecha, canal, estado, dominios_cubiertos, resumen,
      riesgo, duracion_seg, finalizado_en
    ) values (
      v_checkin, v_carmen, v_fecha, 'texto', 'completado',
      '{"animo": true, "cognicion": true, "adherencia": true}'::jsonb,
      'Check-in diario completado. Todo estable.',
      'normal', 95 + (d % 5) * 6,
      (v_fecha + time '11:05')::timestamptz
    );

    insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen) values
      (v_checkin, v_carmen, 'animo',     'animo_estado',      6, 0.8, 'conversacion'),
      (v_checkin, v_carmen, 'cognicion', 'orientacion',       7, 0.7, 'conversacion'),
      (v_checkin, v_carmen, 'dolor',     'dolor_articular',   4, 0.8, 'conversacion');

    -- Paracetamol mañana y noche: buena adherencia (una omisión aislada).
    insert into public.tomas_medicacion (pauta_id, paciente_id, checkin_id, fecha, momento, estado) values
      (v_pauta, v_carmen, v_checkin, v_fecha, 'mañana',
       case when d = 5 then 'omitida' else 'tomada' end),
      (v_pauta, v_carmen, v_checkin, v_fecha, 'noche', 'tomada');
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6) Consentimientos (append-only; vigente = último por tipo).
--    Se registran con `registrado_en` explícito para que el HISTORIAL sea
--    coherente y demostrable en la pantalla de consentimientos (WP-07).
--    Estado vigente resultante:
--      Luis   -> conversacion: sí · voz_grabacion: sí · voz_biomarcadores: no
--      Carmen -> conversacion: sí
-- ---------------------------------------------------------------------
insert into public.consentimientos (paciente_id, tipo, otorgado, version_texto, registrado_en)
values
  -- Luis: otorga conversación y grabación al empezar (hace 45 días).
  ('00000000-0000-4000-8000-000000000003', 'conversacion',      true,  'v0-borrador', now() - interval '45 days'),
  ('00000000-0000-4000-8000-000000000003', 'voz_grabacion',     true,  'v0-borrador', now() - interval '45 days'),
  -- Luis: prueba biomarcadores hace 30 días y los revoca hace 10 (historial).
  ('00000000-0000-4000-8000-000000000003', 'voz_biomarcadores', true,  'v0-borrador', now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000000003', 'voz_biomarcadores', false, 'v0-borrador', now() - interval '10 days'),
  -- Carmen: solo conversación.
  ('00000000-0000-4000-8000-000000000004', 'conversacion',      true,  'v0-borrador', now() - interval '12 days');
