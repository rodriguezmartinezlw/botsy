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
  racha_actual     = 14,
  racha_maxima     = 14,
  ultimo_checkin   = current_date
  where id = '00000000-0000-4000-8000-000000000003'; -- Luis

update public.pacientes set
  fecha_nacimiento = '1952-09-03',
  sexo             = 'femenino',
  vertical         = 'geriatrica',
  condiciones      = array['Artrosis', 'Deterioro cognitivo leve'],
  profesional_id   = '00000000-0000-4000-8000-000000000002',
  telefono_medico  = '+34600111222',
  hora_checkin     = '11:00'
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

-- ---------------------------------------------------------------------
-- 5) 14 días de check-ins, observaciones y tomas de Luis.
--    Dolor descendente (8 -> 2). Warfarina omitida los 2 últimos días.
--    Al día más reciente: mensajes de ejemplo + 1 alerta 'contactar' nueva.
-- ---------------------------------------------------------------------
do $$
declare
  v_luis        uuid := '00000000-0000-4000-8000-000000000003';
  v_pauta_aas   uuid := '00000000-0000-4000-8000-000000000101';
  v_pauta_warf  uuid := '00000000-0000-4000-8000-000000000102';
  v_regla_farm  uuid;
  d             int;
  v_fecha       date;
  v_checkin     uuid;
  v_canal       text;
  v_dolor       numeric;
  v_animo       numeric;
  v_estado_warf text;
begin
  select id into v_regla_farm from public.reglas_escalado
    where nombre = 'Fármaco crítico omitido' limit 1;

  for d in 0..13 loop
    v_fecha   := current_date - (13 - d);
    v_canal   := case when d % 3 = 0 then 'voz' else 'texto' end;
    v_dolor   := round(8 - (d * 6.0 / 13));       -- 8 el día más antiguo -> 2 hoy
    v_animo   := 6 + (d % 2);                       -- 6-7, sin disparar vigilancia
    v_checkin := gen_random_uuid();

    insert into public.checkins (
      id, paciente_id, fecha, canal, estado, dominios_cubiertos, resumen,
      riesgo, duracion_seg, audio_path, finalizado_en
    ) values (
      v_checkin, v_luis, v_fecha, v_canal, 'completado',
      '{"dolor": true, "animo": true, "adherencia": true}'::jsonb,
      'Check-in diario completado. Dolor ' || v_dolor::text || '/10.',
      case when d = 13 then 'contactar' else 'normal' end,
      120 + d * 5,
      case when v_canal = 'voz' then v_luis::text || '/' || v_fecha::text || '.webm' else null end,
      (v_fecha + time '09:35')::timestamptz
    );

    -- Observación de dolor (tendencia descendente).
    insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen)
    values (v_checkin, v_luis, 'dolor', 'dolor_generalizado', v_dolor, 0.9, 'conversacion');

    -- Observación de ánimo.
    insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen)
    values (v_checkin, v_luis, 'animo', 'animo_estado', v_animo, 0.8, 'conversacion');

    -- Toma de AAS (mañana): siempre tomada.
    insert into public.tomas_medicacion (pauta_id, paciente_id, checkin_id, fecha, momento, estado)
    values (v_pauta_aas, v_luis, v_checkin, v_fecha, 'mañana', 'tomada');

    -- Toma de warfarina (noche): omitida los 2 últimos días (d = 12, 13).
    v_estado_warf := case when d >= 12 then 'omitida' else 'tomada' end;
    insert into public.tomas_medicacion (pauta_id, paciente_id, checkin_id, fecha, momento, estado)
    values (v_pauta_warf, v_luis, v_checkin, v_fecha, 'noche', v_estado_warf);

    -- Al día más reciente: conversación de ejemplo + alerta 'contactar'.
    if d = 13 then
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
          'detalle', 'Warfarina (crítica) omitida 2 noches consecutivas.',
          'fechas_omitidas', jsonb_build_array((current_date - 1)::text, current_date::text),
          'fragmento', 'Anoche se me volvió a olvidar.'
        ),
        'nueva'
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6) Consentimientos vigentes (append-only) para los pacientes demo.
-- ---------------------------------------------------------------------
insert into public.consentimientos (paciente_id, tipo, otorgado, version_texto)
values
  ('00000000-0000-4000-8000-000000000003', 'conversacion',   true, 'v0-borrador'),
  ('00000000-0000-4000-8000-000000000003', 'voz_grabacion',  true, 'v0-borrador'),
  ('00000000-0000-4000-8000-000000000004', 'conversacion',   true, 'v0-borrador');
