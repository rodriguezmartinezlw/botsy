# Despliegue de Botsy (F1)

Guía ejecutable paso a paso para poner Botsy en producción desde cero: proyecto
Supabase (base de datos + auth + storage) y app Next.js en Vercel. Pensada para
una persona **sin contexto previo**: sigue los pasos en orden.

> **Antes de pacientes reales**, faltan tareas no técnicas: textos legales reales
> (marcados `[PENDIENTE LEGAL]` en el código), EIPD/DPIA, DPA con OpenAI/Resend y
> validación clínica de guiones y banderas rojas. Ver `docs/PLAN-MAESTRO.md` §6.

## 0. Requisitos

- Cuenta de [Supabase](https://supabase.com) y de [Vercel](https://vercel.com).
- Cuenta de [OpenAI](https://platform.openai.com) con acceso a la API Realtime.
- Cuenta de [Resend](https://resend.com) (emails de recordatorio) con un dominio verificado.
- Node.js 20+ y `git` en local. Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli).

---

## 1. Crear el proyecto Supabase

1. En [app.supabase.com](https://app.supabase.com) → **New project**. Elige
   organización, nombre (p. ej. `botsy`), contraseña de base de datos (guárdala)
   y región cercana a tus usuarios (p. ej. `eu-west-3` para España).
2. Cuando termine de aprovisionarse, ve a **Project Settings → API** y anota:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (¡secreta!) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Aplicar las migraciones (0001..0004, EN ORDEN)

Las migraciones son SQL versionado en `supabase/migrations/`. **El orden importa**
(las FKs y las políticas dependen de tablas ya creadas):

```
0001_esquema_inicial.sql   → 11 tablas + índices + trigger de alta de usuario
0002_rls.sql               → RLS + políticas + bucket de audios
0003_reglas_semilla.sql    → 5 reglas de escalado globales
0004_informes.sql          → tabla informes + RLS
```

Opción A — **Supabase CLI** (recomendada, aplica todo en orden):

```bash
supabase link --project-ref <TU_PROJECT_REF>
supabase db push          # aplica todas las migraciones de supabase/migrations
```

Opción B — **SQL Editor del panel**: abre cada archivo de `supabase/migrations/`
en orden numérico y ejecútalo (Run). No saltes ninguno ni cambies el orden.

> No hay migraciones de RLS adicionales en F1: la RLS entera vive en `0002` (la
> auditoría de WP-08 no encontró correcciones que aplicar). Si en el futuro hay
> que corregir una política, se hace en una **migración nueva** (`0005_...`),
> nunca editando una ya aplicada.

## 3. Cargar el seed de demo (opcional pero recomendado para probar)

El seed crea usuarios demo (contraseña común `Botsy1234!`) y datos clínicos
coherentes (Luis con 45 días de historial, Carmen, alertas en varios estados).

```bash
# Con la CLI, el reset aplica migraciones + supabase/seed.sql de una vez:
supabase db reset

# El segundo profesional (para demostrar aislamiento entre profesionales) es
# aditivo y se aplica aparte:
psql "$DATABASE_URL" -f supabase/seed_wp06_segundo_profesional.sql
```

> El bloque de `auth.users` del seed depende del esquema interno de GoTrue. Si
> falla por un cambio de versión, crea los usuarios con la **Auth Admin API** y
> ejecuta solo los `UPDATE/INSERT` clínicos del seed (ver cabecera de `seed.sql`).

**Usuarios demo** (todos con contraseña `Botsy1234!`):

| Email | Rol | Notas |
|---|---|---|
| `admin@botsy.local` | admin | Acceso total |
| `dra.garcia@botsy.local` | profesional | Atiende a Luis y Carmen |
| `luis@botsy.local` | paciente | 68, cardiovascular; 45 días de datos; alertas variadas |
| `carmen@botsy.local` | paciente | 74, geriátrica; 12 días de datos |
| `dr.ruiz@botsy.local` | profesional | Atiende a Marta (2º seed) |
| `marta@botsy.local` | paciente | 59, salud mental (2º seed) |

### Verificar el aislamiento por RLS (opcional)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/acceso_cruzado.sql
# Debe imprimir varias líneas «OK: …» y terminar con «ACCESO CRUZADO: TODO OK».
```

## 4. Storage

La migración `0002` crea el bucket privado `audios-checkin` con sus políticas
(el paciente sube a su carpeta; solo su profesional/admin lee). No hay que
configurarlo a mano.

## 5. Crear el primer usuario admin (producción real, sin seed)

Sin el seed no hay admin. El **rol** se lee de `raw_user_meta_data.rol` al crear
el usuario (lo usa el trigger `on_auth_user_created`). Opciones:

- **Auth → Users → Add user** en el panel, y luego en el **SQL Editor**:

  ```sql
  update public.perfiles set rol = 'admin'
  where id = (select id from auth.users where email = 'tu-admin@tu-dominio.com');
  ```

- O crea el usuario con la Auth Admin API pasando
  `user_metadata: { "rol": "admin", "nombre": "..." }`.

Los **profesionales** se crean igual (`rol = 'profesional'`) y se asignan
pacientes con `update public.pacientes set profesional_id = '<id_profesional>'
where id = '<id_paciente>'`. Los **pacientes** se registran desde `/registro`
(rol `paciente` por defecto).

## 6. Desplegar la app en Vercel

1. Sube el repositorio a GitHub y en Vercel → **Add New → Project** → importa el repo.
2. Framework: **Next.js** (autodetectado). No hace falta tocar el build command.
3. **Environment Variables**: añade TODAS las de `.env.example` con valores reales
   (ver tabla abajo). Márcalas para *Production* (y *Preview* si lo usas).
4. **Deploy**.

### Variables de entorno (todas las de `.env.example`)

| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | público | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | Clave anónima (la seguridad la da la RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreto** | Service-role; solo servidor. Salta RLS |
| `OPENAI_API_KEY` | **secreto** | Clave de OpenAI (texto + Realtime) |
| `OPENAI_TEXT_MODEL` | servidor | Modelo de extracción (por defecto `gpt-5-mini`) |
| `OPENAI_REALTIME_MODEL` | servidor | Modelo de voz (por defecto `gpt-realtime-2.1-mini`) |
| `OPENAI_REALTIME_VOICE` | servidor | Timbre TTS (por defecto `alloy`) |
| `VOZ_MAX_MINUTOS` | servidor | Límite de minutos por sesión de voz (por defecto `8`) |
| `CRON_SECRET` | **secreto** | Autoriza el cron de recordatorios (Bearer) |
| `RESEND_API_KEY` | **secreto** | Clave de Resend para los emails |
| `RESEND_FROM` | servidor | Remitente (dominio verificado en Resend) |
| `APP_URL` | servidor | URL pública de la app (sin barra final), para los enlaces del email |

> Nunca pongas secretos en variables `NEXT_PUBLIC_*`: esas se incrustan en el
> bundle del navegador. Solo `NEXT_PUBLIC_SUPABASE_URL` y `..._ANON_KEY` son
> públicas por diseño.

## 7. Cron de recordatorios (requiere Vercel Pro)

`vercel.json` define el cron `GET /api/cron/recordatorios` (`0 6-20 * * *`, en
UTC). El handler comprueba `CRON_SECRET` (Vercel lo inyecta automáticamente en
los crons del proyecto) y envía por Resend un recordatorio a los pacientes cuya
hora de check-in ya pasó y aún no lo han hecho hoy.

> **Aviso:** el plan **Hobby** de Vercel limita los crons a **1/día**. Para la
> cadencia horaria del `vercel.json` hace falta el plan **Pro**. En Hobby: reduce
> la frecuencia a diaria o usa un scheduler externo (GitHub Actions, cron-job.org)
> que llame a la URL con la cabecera `Authorization: Bearer <CRON_SECRET>`.

## 8. Comprobación post-despliegue

1. Abre la URL de Vercel → landing de Botsy.
2. Regístrate como paciente (`/registro`) o entra con un usuario del seed.
3. Haz un check-in por texto (necesita `OPENAI_API_KEY`) y comprueba que el
   resumen y la racha se guardan.
4. Entra como profesional (`dra.garcia@botsy.local`) y revisa la lista de
   pacientes, la ficha 360º, la bandeja de alertas y el informe imprimible.
5. (Opcional) Prueba la voz en un dispositivo con micrófono (necesita la API
   Realtime).

## Solución de problemas

- **La app compila pero las páginas dan error 500**: revisa que las variables de
  Supabase están puestas en Vercel (la app compila sin ellas, pero las peticiones
  fallan de forma controlada si faltan en runtime).
- **El check-in responde 503**: falta `OPENAI_API_KEY` o el proveedor está caído.
- **La voz da 503**: falta la clave o el modelo Realtime; la UI ofrece el chat de texto.
- **No llegan recordatorios**: revisa `CRON_SECRET`, `RESEND_API_KEY`, el dominio
  verificado en `RESEND_FROM` y que el cron esté activo (plan Pro).
