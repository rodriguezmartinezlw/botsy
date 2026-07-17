-- =====================================================================
-- Botsy — Seed ADITIVO de WP-06: segundo profesional + su paciente.
--
-- Objetivo: poder demostrar el AISLAMIENTO por profesional que exige el
-- criterio de aceptación de WP-06 (un profesional no ve pacientes de otro).
-- El seed base (supabase/seed.sql) sólo tiene a la Dra. García con Luis y
-- Carmen; aquí se añade al Dr. Ruiz con su paciente Marta.
--
-- Ejecutar DESPUÉS de supabase/seed.sql (p.ej. `psql -f` este archivo tras el
-- reset, o añadirlo a la orden de seed). Es idempotente (on conflict do nothing).
-- NO modifica el seed base de WP-01.
--
-- Usuarios nuevos (contraseña común): Botsy1234!
--   dr.ruiz@botsy.local   (profesional — Dr. Ruiz)
--   marta@botsy.local     (paciente  — Marta, 59, salud mental; de Dr. Ruiz)
--
-- Comprobación esperada (con RLS activa, cada uno logueado como sí mismo).
-- Desde WP-22 la visibilidad es POR INSTITUCIÓN (no por profesional_id):
--   - Dra. García (Institución A): ve a los pacientes de A; NO ve a Marta (B).
--   - Dr. Ruiz (Institución B):    ve SÓLO a Marta; NO ve a los pacientes de A.
--   - Dr. Ruiz:    `select * from alertas`    → SÓLO la alerta de Marta.
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
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005',
   'authenticated', 'authenticated', 'dr.ruiz@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"profesional","nombre":"Dr. Ruiz"}'::jsonb, now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006',
   'authenticated', 'authenticated', 'marta@botsy.local',
   crypt('Botsy1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rol":"paciente","nombre":"Marta"}'::jsonb, now(), now(), '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005',
   '{"sub":"00000000-0000-4000-8000-000000000005","email":"dr.ruiz@botsy.local"}'::jsonb, 'email', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006',
   '{"sub":"00000000-0000-4000-8000-000000000006","email":"marta@botsy.local"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2) Perfiles (el trigger ya creó las filas base).
-- ---------------------------------------------------------------------
update public.perfiles set telefono = '+34600333444'
  where id = '00000000-0000-4000-8000-000000000005'; -- Dr. Ruiz
update public.perfiles set telefono = '+34611000006'
  where id = '00000000-0000-4000-8000-000000000006'; -- Marta

-- ---------------------------------------------------------------------
-- 3) Datos clínicos de Marta, asignada al Dr. Ruiz.
-- ---------------------------------------------------------------------
update public.pacientes set
  fecha_nacimiento = '1967-02-20',
  sexo             = 'femenino',
  vertical         = 'mental',
  condiciones      = array['Trastorno de ansiedad'],
  profesional_id   = '00000000-0000-4000-8000-000000000005',                 -- médico responsable
  institucion_id   = '00000000-0000-4000-8000-000000000b02',                 -- WP-22: Marta -> Institución B
  telefono_medico  = '+34600333444',
  hora_checkin     = '10:00',
  racha_actual     = 5,
  racha_maxima     = 9,
  ultimo_checkin   = current_date
  where id = '00000000-0000-4000-8000-000000000006'; -- Marta

-- ---------------------------------------------------------------------
-- 3b) Membresía del Dr. Ruiz en la Institución B (WP-22). La institución B se
--     crea en supabase/seed.sql (sección 2b), que corre antes que este archivo.
--     Con la RLS por institución (es_profesional_de reescrita), esta membresía es
--     lo que da a Ruiz acceso a Marta (y a ningún paciente de la Institución A).
-- ---------------------------------------------------------------------
insert into public.profesionales_instituciones (profesional_id, institucion_id, activa) values
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000b02', true) -- Ruiz -> B
on conflict (profesional_id, institucion_id) do nothing;

-- ---------------------------------------------------------------------
-- 4) Pauta de Marta (no crítica).
-- ---------------------------------------------------------------------
insert into public.pautas_medicacion (id, paciente_id, farmaco, dosis, momentos, critica, activa, creada_por)
values
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000006',
   'Sertralina', '50 mg', array['mañana'], false, true,
   '00000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5) 5 días de check-ins de Marta (ánimo bajo sostenido) + 1 alerta nueva
--    de nivel 'vigilancia' (regla global "Ánimo bajo sostenido").
-- ---------------------------------------------------------------------
do $$
declare
  v_marta      uuid := '00000000-0000-4000-8000-000000000006';
  v_pauta      uuid := '00000000-0000-4000-8000-000000000103';
  v_regla      uuid;
  d            int;
  v_fecha      date;
  v_checkin    uuid;
begin
  select id into v_regla from public.reglas_escalado
    where nombre = 'Ánimo bajo sostenido' limit 1;

  for d in 0..4 loop
    v_fecha   := current_date - (4 - d);
    v_checkin := gen_random_uuid();

    insert into public.checkins (
      id, paciente_id, fecha, canal, estado, dominios_cubiertos, resumen,
      riesgo, duracion_seg, finalizado_en
    ) values (
      v_checkin, v_marta, v_fecha, 'texto', 'completado',
      '{"animo": true, "adherencia": true}'::jsonb,
      'Check-in diario completado.',
      case when d = 4 then 'vigilancia' else 'normal' end,
      110 + d * 4,
      (v_fecha + time '10:05')::timestamptz
    );

    -- Ánimo bajo (<= 3) sostenido, dispara la regla de vigilancia.
    insert into public.observaciones (checkin_id, paciente_id, dominio, codigo, valor_num, confianza, origen)
    values (v_checkin, v_marta, 'animo', 'animo_estado', 3, 0.8, 'conversacion');

    insert into public.tomas_medicacion (pauta_id, paciente_id, checkin_id, fecha, momento, estado)
    values (v_pauta, v_marta, v_checkin, v_fecha, 'mañana', 'tomada');

    if d = 4 then
      insert into public.mensajes (checkin_id, rol, contenido, orden) values
        (v_checkin, 'asistente', 'Hola Marta, ¿cómo te sientes hoy?', 1),
        (v_checkin, 'paciente',  'Sigo con el ánimo por los suelos estos días.', 2);

      insert into public.alertas (
        paciente_id, checkin_id, regla_id, nivel, motivo, evidencia, estado
      ) values (
        v_marta, v_checkin, v_regla, 'vigilancia', 'Ánimo bajo sostenido',
        jsonb_build_object(
          'detalle', jsonb_build_array('Ánimo <= 3 durante 5 días consecutivos.'),
          'observaciones', jsonb_build_array(
            jsonb_build_object('dominio','animo','codigo','animo_estado','valor_num',3)
          ),
          'fragmento', 'Sigo con el ánimo por los suelos estos días.'
        ),
        'nueva'
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6) Consentimiento vigente de Marta.
-- ---------------------------------------------------------------------
insert into public.consentimientos (paciente_id, tipo, otorgado, version_texto)
values
  ('00000000-0000-4000-8000-000000000006', 'conversacion', true, 'v0-borrador');
