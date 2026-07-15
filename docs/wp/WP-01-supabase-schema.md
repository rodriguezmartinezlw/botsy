# WP-01 — Esquema Supabase: migraciones + RLS + seed + clientes + auth

**Depende de:** WP-00 · **Desbloquea:** WP-02, WP-05

## Objetivo

Modelo de datos completo de F1 como migraciones SQL versionadas, con RLS estricta, seed de demo, tipos TypeScript y clientes Supabase. La autenticación de la app (login/registro) queda funcional a falta de proyecto Supabase remoto (aún sin crear: las credenciales llegarán por env).

## Tareas

### 1. Migración `supabase/migrations/0001_esquema_inicial.sql`

Crea (todas con `id uuid primary key default gen_random_uuid()`, `creado_en timestamptz default now()` salvo indicación):

- **`perfiles`** — `id uuid PK` (= `auth.users.id`, FK on delete cascade), `rol text check in ('paciente','profesional','admin')`, `nombre text not null`, `telefono text`, `avatar_url text`, `idioma text default 'es'`, `zona_horaria text default 'Europe/Madrid'`.
- **`pacientes`** — `id uuid PK` (= perfiles.id, FK), `fecha_nacimiento date`, `sexo text`, `vertical text check in ('cardiovascular','cronica','geriatrica','mental','ocupacional','general') default 'general'`, `condiciones text[] default '{}'`, `profesional_id uuid FK perfiles`, `telefono_medico text`, `hora_checkin time default '10:00'`, `racha_actual int default 0`, `racha_maxima int default 0`, `ultimo_checkin date`.
- **`pautas_medicacion`** — `paciente_id FK`, `farmaco text not null`, `dosis text`, `momentos text[] not null` (valores: mañana|mediodía|noche), `critica boolean default false` (p. ej. anticoagulantes), `activa boolean default true`, `creada_por uuid FK perfiles`.
- **`checkins`** — `paciente_id FK`, `fecha date not null`, `canal text check in ('texto','voz')`, `estado text check in ('en_curso','completado','abandonado') default 'en_curso'`, `dominios_cubiertos jsonb default '{}'`, `resumen text`, `riesgo text check in ('normal','vigilancia','contactar','urgencia')`, `duracion_seg int`, `audio_path text`, `finalizado_en timestamptz`. UNIQUE `(paciente_id, fecha)`.
- **`mensajes`** — `checkin_id FK on delete cascade`, `rol text check in ('asistente','paciente')`, `contenido text not null`, `orden int not null`.
- **`observaciones`** — `checkin_id FK`, `paciente_id FK` (desnormalizado para consultas), `dominio text check in ('dolor','sintoma_fisico','animo','ansiedad','estres','sueno','cognicion','adherencia','tratamiento','habitos')`, `codigo text not null` (etiqueta corta, p. ej. `dolor_cabeza`), `valor_num numeric`, `valor_texto text`, `confianza numeric check (confianza between 0 and 1)`, `origen text check in ('conversacion','reconciliacion') default 'conversacion'`.
- **`tomas_medicacion`** — `pauta_id FK`, `paciente_id FK`, `checkin_id FK null`, `fecha date not null`, `momento text not null`, `estado text check in ('tomada','omitida','desconocido')`. UNIQUE `(pauta_id, fecha, momento)`.
- **`reglas_escalado`** — `paciente_id uuid null FK` (null = regla global), `vertical text null`, `nombre text not null`, `descripcion text`, `condicion jsonb not null` (formato definido en WP-04), `nivel text check in ('vigilancia','contactar','urgencia')`, `activa boolean default true`.
- **`alertas`** — `paciente_id FK`, `checkin_id FK null`, `regla_id FK null`, `nivel text check in ('vigilancia','contactar','urgencia')`, `motivo text not null`, `evidencia jsonb default '{}'` (fragmentos de conversación, observaciones), `estado text check in ('nueva','vista','resuelta','descartada') default 'nueva'`, `motivo_descarte text`, `gestionada_por uuid FK perfiles`, `gestionada_en timestamptz`.
- **`consentimientos`** — `paciente_id FK`, `tipo text check in ('conversacion','voz_grabacion','voz_biomarcadores')`, `otorgado boolean not null`, `version_texto text not null`, `registrado_en timestamptz default now()`. Histórico append-only (el vigente es el último por tipo).
- **`eventos_auditoria`** — `actor_id uuid null`, `accion text not null`, `entidad text`, `entidad_id uuid`, `detalle jsonb default '{}'`. Solo INSERT (sin UPDATE/DELETE por políticas).

Índices: `checkins(paciente_id, fecha desc)`, `observaciones(paciente_id, dominio, creado_en desc)`, `alertas(estado, nivel)`, `tomas_medicacion(paciente_id, fecha desc)`, `mensajes(checkin_id, orden)`.

Trigger `on_auth_user_created` → inserta en `perfiles` (rol y nombre desde `raw_user_meta_data`, rol por defecto `paciente`); si rol=paciente, inserta también fila en `pacientes`.

### 2. Migración `0002_rls.sql`

- `alter table ... enable row level security` en TODAS las tablas.
- Función helper `es_profesional_de(p_paciente uuid) returns boolean` (security definer): true si el usuario actual es el `profesional_id` del paciente o tiene rol admin.
- Políticas:
  - Paciente: SELECT/INSERT/UPDATE de sus propias filas (`auth.uid() = paciente_id` o `id`); nunca DELETE; no puede tocar `alertas` (solo SELECT de las suyas) ni `reglas_escalado` (nada).
  - Profesional: SELECT de perfiles/pacientes/checkins/mensajes/observaciones/tomas/alertas de sus pacientes asignados; INSERT/UPDATE de `pautas_medicacion`, `reglas_escalado` (suyas o de sus pacientes) y gestión de `alertas`.
  - Admin: todo (política por rol en perfiles).
  - `eventos_auditoria`: INSERT para autenticados; SELECT solo admin.
- Storage: bucket privado `audios-checkin`; política: el paciente sube a `{su_id}/...`; lectura solo profesional asignado/admin.

### 3. Migración `0003_reglas_semilla.sql`

Reglas de escalado globales iniciales (formato `condicion` de WP-04; coordinado — usa el formato tal cual se define allí):
1. `urgencia` — vertical cardiovascular: dolor torácico + disnea en el mismo check-in.
2. `urgencia` — global: ideación autolítica (código `ideacion_autolitica`).
3. `contactar` — global: dolor con `valor_num >= 9`.
4. `contactar` — global: fármaco `critica=true` omitido ≥2 días consecutivos.
5. `vigilancia` — global: ánimo `valor_num <= 3` (escala 0–10) durante ≥3 días seguidos.

### 4. `supabase/seed.sql`

Datos demo: 1 admin, 1 profesional (Dra. García), 2 pacientes (Luis, 68, cardiovascular, pautas de AAS + warfarina crítica; Carmen, 74, geriátrica) — usuarios en `auth.users` con contraseña demo via `crypt` o instrucciones claras si no es viable en SQL puro; 14 días de checkins/observaciones/tomas variados para Luis (con tendencia de dolor descendente y 2 omisiones de warfarina), 1 alerta `contactar` nueva.

### 5. Código

- `src/lib/supabase/client.ts` (browser, `createBrowserClient`), `server.ts` (cookies, `createServerClient`), `admin.ts` (service role, `import "server-only"`).
- `src/types/db.ts` — tipos TS de todas las tablas (a mano, espejo del SQL).
- Conectar `(auth)/login` y `(auth)/registro` con Supabase Auth (email+contraseña); tras login, redirigir por rol (`paciente` → `/inicio`, `profesional`/`admin` → `/pacientes`). Route guard en los layouts `(paciente)` y `(panel)` leyendo la sesión de servidor; recuerda que en Next 16 los Route Handlers `/api/*` comprueban sesión internamente.
- Página `(paciente)/consentimientos` funcional-mínima: muestra los 3 tipos con toggle y texto `[PENDIENTE LEGAL]` versionado `v0-borrador`; escribe en `consentimientos`.

## Fuera de alcance

Crear el proyecto Supabase remoto (lo hace el director cuando el usuario decida cuenta). Conversación/LLM. UI de panel.

## Criterios de aceptación

- Migraciones SQL sintácticamente válidas y auto-contenidas (aplicables en orden sobre un proyecto vacío). Si tienes Supabase CLI y Docker disponibles, `supabase db reset` local como prueba; si no, revisión manual + validación con un parser (p. ej. correr el SQL por `psql --dry-run` no existe: en su defecto documenta en la entrega que la validación fue por revisión).
- Ninguna tabla sin RLS + políticas en la misma entrega.
- `npm run build` y `npm run lint` verdes (la app compila aunque no haya proyecto remoto; los clientes leen env y fallan de forma controlada con mensaje claro si faltan).
- `.env.example` actualizado.
