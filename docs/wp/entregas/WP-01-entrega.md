# Entrega WP-01 — Esquema Supabase: migraciones + RLS + seed + clientes + auth

**Fecha:** 2026-07-15 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build` y `npm run lint` en verde. SQL validado con el parser real de Postgres (libpg_query) + revisión manual (no hay Supabase CLI/Docker en el entorno).

---

## 1. Qué se hizo

Modelo de datos completo de F1 como migraciones SQL versionadas con RLS estricta, reglas semilla, seed de demo, tipos TypeScript, los tres clientes Supabase y la autenticación (login/registro + route guards + consentimientos) conectada a Supabase Auth. Todo compila sin proyecto Supabase remoto: los clientes leen env en tiempo de petición y, si faltan, fallan de forma controlada con mensaje claro (nunca rompen el build).

- **`supabase/migrations/0001_esquema_inicial.sql`** — extensión `pgcrypto`; las 11 tablas (`perfiles`, `pacientes`, `pautas_medicacion`, `checkins`, `mensajes`, `observaciones`, `tomas_medicacion`, `reglas_escalado`, `alertas`, `consentimientos`, `eventos_auditoria`) con sus `check`, `unique`, FKs con `on delete` apropiado, los 5 índices del WP, y el trigger `on_auth_user_created` → `gestionar_nuevo_usuario()` (crea `perfiles`, y `pacientes` si rol=paciente, leyendo rol/nombre de `raw_user_meta_data`).
- **`supabase/migrations/0002_rls.sql`** — `enable row level security` en las 11 tablas; funciones helper `es_admin()`, `es_profesional_de(uuid)`, `paciente_de_checkin(uuid)` (todas `security definer` para no recursar con la propia RLS); el juego completo de políticas por rol (paciente/profesional/admin); y el bucket privado de storage `audios-checkin` con sus políticas de subida (paciente a su carpeta) y lectura (profesional asignado/admin).
- **`supabase/migrations/0003_reglas_semilla.sql`** — las 5 reglas globales del WP, con `condicion` en el **formato JSONB de WP-04** (tipos `combinacion`/`observacion`/`senal`/`adherencia_critica`/`tendencia`).
- **`supabase/seed.sql`** — 4 usuarios demo en `auth.users` (+ `auth.identities`) con contraseña `Botsy1234!`, el trigger crea sus perfiles/pacientes, y luego se completan datos clínicos: Luis (68, cardiovascular, AAS + warfarina crítica) con **14 días** de check-ins/observaciones/tomas (dolor descendente 8→2, warfarina omitida las 2 últimas noches), conversación de ejemplo y **1 alerta `contactar` nueva**; Carmen (74, geriátrica); consentimientos vigentes.
- **`src/lib/supabase/`** — `config.ts` (lectura de env con fallo controlado), `client.ts` (`createBrowserClient`), `server.ts` (`createServerClient` con cookies, `async` por Next 16), `admin.ts` (service-role, `import "server-only"`).
- **`src/types/db.ts`** — tipos a mano espejo del SQL (enums + `Row`/`Insert`/`Update` de las 11 tablas) y `BaseDatos` con la forma que exigen los genéricos de supabase-js, cableado en los tres clientes para que las consultas queden tipadas.
- **Auth** — `login`/`registro` conectados a Supabase Auth (email+contraseña) con redirección por rol; route guards de servidor en los layouts `(paciente)` y `(panel)`; pantalla `(paciente)/consentimientos` funcional (3 tipos con interruptor, texto `[PENDIENTE LEGAL]` versión `v0-borrador`, escribe en `consentimientos` vía Server Action validada con Zod).

---

## 2. Archivos

### Creados

- `supabase/migrations/0001_esquema_inicial.sql`
- `supabase/migrations/0002_rls.sql`
- `supabase/migrations/0003_reglas_semilla.sql`
- `supabase/seed.sql`
- `src/lib/supabase/config.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/auth/roles.ts` — `rutaPorRol()` (puro, cliente-seguro).
- `src/lib/auth/sesion.ts` — `obtenerRolSesion()` (servidor; nunca lanza, `null` ante cualquier fallo).
- `src/types/db.ts`
- `src/app/(auth)/login/FormularioLogin.tsx` — formulario cliente conectado a Auth.
- `src/app/(auth)/registro/FormularioRegistro.tsx` — íd.
- `src/app/(paciente)/consentimientos/acciones.ts` — Server Action (`"use server"`) con validación Zod.
- `src/app/(paciente)/consentimientos/constantes.ts` — constante/tipo (fuera del módulo `"use server"`).
- `src/app/(paciente)/consentimientos/PanelConsentimientos.tsx` — panel cliente con interruptores.

### Modificados

- `src/app/(auth)/login/page.tsx` — ahora renderiza `<FormularioLogin/>` (mantiene el encabezado server que lee `?rol=profesional`).
- `src/app/(auth)/registro/page.tsx` — ahora renderiza `<FormularioRegistro/>`.
- `src/app/(paciente)/layout.tsx` — route guard: exige sesión de paciente (sin sesión → `/login`; profesional/admin → `/pacientes`).
- `src/app/(panel)/layout.tsx` — route guard: exige profesional/admin (paciente → `/inicio`).
- `src/app/(paciente)/consentimientos/page.tsx` — Server Component que lee el estado vigente por tipo y delega en el panel.
- Eliminados `src/lib/supabase/.gitkeep` y `src/types/.gitkeep` (esas carpetas ya tienen contenido real).

### No tocados

`.env.example` ya contenía las 3 variables de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) que usan los clientes; WP-01 no añade variables nuevas, así que no se modificó. `docs/` no se tocó salvo este archivo.

---

## 3. Decisiones propias (no especificadas en el WP)

1. **Tipos como `type` y no `interface`.** Los genéricos de supabase-js exigen que cada `Row` sea asignable a `Record<string, unknown>`; las `interface` **no** obtienen firma de índice implícita y colapsaban todo el esquema a `never` (las consultas perdían el tipo). Con alias de tipo (`type X = {…}`) funciona. En `BaseDatos`, los campos vacíos (`Views`/`Functions`/`Enums`/`CompositeTypes`) usan `Record<never, never>` (no `Record<string, never>`, que introduce una firma de índice y colapsa `Tables & Views` a `never`).
2. **Helpers extra además de `es_profesional_de`:** `es_admin()` (gate de admin) y `paciente_de_checkin()` (resuelve el dueño en `mensajes`, que no tiene `paciente_id`). Todas `security definer` para evitar recursión de RLS.
3. **Políticas acotadas a `to authenticated`** (el rol `anon` no tiene acceso a ninguna tabla).
4. **`config.ts` separado** para leer env en funciones (no en el módulo), de modo que el build no evalúe env y la app compile sin proyecto remoto; si faltan en runtime, `Error` claro. La service-role se lee solo en `admin.ts`.
5. **`constantes.ts` separado de `acciones.ts`:** un módulo `"use server"` solo puede exportar funciones async; la constante `VERSION_TEXTO_CONSENTIMIENTO` y el tipo de resultado viven aparte.
6. **`eventos_auditoria.actor_id` sin FK** a propósito: la traza se conserva aunque el usuario se borre (buena práctica de auditoría). Documentado en la migración.
7. **`obtenerRolSesion()` nunca lanza:** ante sin-sesión/env-ausente/red devuelve `null`, y el guard redirige a `/login` (no hay 500 aunque no haya backend).
8. **Alcance de "Admin: todo" vs. tablas append-only** (ver §5, punto A). Se añadieron políticas `admin_todo` (ALL) a las tablas operativas (`pautas_medicacion`, `checkins`, `mensajes`, `observaciones`, `tomas_medicacion`) además de las que el WP citaba, para que el admin tenga CRUD completo. En `consentimientos` y `eventos_auditoria` se **preserva el append-only** (el admin puede leer e insertar, pero nadie puede UPDATE/DELETE), por prevalecer la instrucción explícita "histórico append-only" / "solo INSERT (sin UPDATE/DELETE)" del propio WP.
9. **Credenciales demo:** todos los usuarios del seed usan la contraseña `Botsy1234!`.

---

## 4. Cómo se validaron las migraciones

No hay Supabase CLI ni Docker en el entorno (verificado), así que **no** se pudo correr `supabase db reset`. La validación fue en dos capas:

1. **Parser real de Postgres (libpg_query vía `pg-query-emscripten@5.1.0`)** ejecutado sobre los 4 archivos. Valida la gramática completa (dollar-quoting, `create policy`, `security definer`, bloque `DO`, `on conflict`, etc.). Resultado:

   ```
   OK   0001_esquema_inicial.sql: 19 statements parsed
   OK   0002_rls.sql: 68 statements parsed
   OK   0003_reglas_semilla.sql: 1 statements parsed
   OK   seed.sql: 10 statements parsed
   ```

2. **Revisión manual** de lo que un parser no comprueba: orden de creación de FKs (cada `references` apunta a una tabla ya creada: `perfiles`→`pacientes`→…→`eventos_auditoria`), tipos y `check` de cada columna, `unique` (`checkins(paciente_id,fecha)`, `tomas(pauta_id,fecha,momento)`), `on delete` (cascade en dependencias fuertes, set null en referencias débiles como `profesional_id`, `regla_id`, `gestionada_por`, `creada_por`, `checkin_id` de tomas/alertas), y que **ninguna de las 11 tablas quede sin RLS + al menos una política** (ver matriz §6).

> **Pendiente de verificación en vivo:** el bloque de `auth.users`/`auth.identities` del seed depende del esquema interno de GoTrue (columnas como `confirmation_token`, `email_confirmed_at`). Es sintácticamente válido y sigue el patrón estándar de seeds locales de Supabase, pero solo se puede confirmar con `supabase db reset` o creando los usuarios con la Auth Admin API. Se documenta la alternativa en el propio `seed.sql`.

---

## 5. Dudas / riesgos detectados

- **A. "Admin: todo" vs. append-only (posible tensión en el WP).** El WP dice "Admin: todo" y, a la vez, marca `consentimientos` como "histórico append-only" y `eventos_auditoria` como "solo INSERT (sin UPDATE/DELETE por políticas)". Son incompatibles al pie de la letra. Se resolvió a favor de la integridad append-only en esas dos tablas (admin lee/inserta, nadie actualiza/borra) y CRUD completo de admin en el resto. Si el director prefiere que el admin también pueda editar/borrar consentimientos/auditoría, es un cambio de una línea por tabla (nueva migración).
- **B. Paciente puede INSERT/UPDATE sus `pautas_medicacion`.** La regla general del WP ("Paciente: SELECT/INSERT/UPDATE de sus propias filas") solo exceptúa `alertas` y `reglas_escalado`. Aplicada literalmente, deja que el paciente cree/edite sus propias pautas (auto-prescripción), lo cual clínicamente es discutible dado que existe `creada_por` y el profesional es quien prescribe. Se implementó **según el WP** (paciente + profesional pueden insertar/actualizar pautas de sus filas). Recomendación: si debe ser solo del profesional, retirar las políticas `pautas_*_propio` de escritura del paciente.
- **C. Storage: lectura de audios excluye al propio paciente.** El WP dice "lectura solo profesional asignado/admin", así que el paciente **no** puede releer su propio audio. Se implementó tal cual; si se quiere permitir que el paciente escuche lo suyo, añadir una política de SELECT `((storage.foldername(name))[1])::uuid = auth.uid()`.
- **D. `reglas_escalado`: profesional solo escribe reglas de sus pacientes.** El WP dice "suyas o de sus pacientes" (ambiguo; no hay `creada_por` en reglas). Se interpretó: el profesional **ve** las globales + las de sus pacientes, pero solo **crea/edita** reglas con `paciente_id` de sus pacientes; las globales las gestiona el admin.
- **E. `consentimientos` tiene dos timestamps.** El WP especifica `registrado_en timestamptz default now()`; la regla general del WP da a todas las tablas `creado_en`. Se dejaron **ambas** (`registrado_en` como columna semántica —"el vigente es el último por tipo", usada para ordenar— y `creado_en` por consistencia/auditoría). Si sobra una, quitar `creado_en` de esta tabla.
- **F. `reglas_escalado.vertical` sin `check`.** El WP la define como `text null` sin restricción; se dejó libre (no se acotó al enum de verticales) para no sobre-restringir respecto al WP.
- **G. `import "server-only"` se resuelve por el alias que Next incluye** (`next/dist/compiled/server-only`); no es un paquete instalado en `package.json`. Build y lint lo aceptan. Si un cambio de tooling quitara ese alias, habría que `npm install server-only`.
- **H. Sin middleware de refresco de sesión.** El WP pide guards en layouts (implementado) y no menciona middleware; no se añadió (además, en Next 16 el middleware no intercepta `/api`). `getUser()` valida el token en cada request; el refresco proactivo de tokens se puede añadir en un WP posterior si hace falta.

---

## 6. Matriz de acceso (RLS)

Convenciones: **✓** permitido · **✗** denegado (sin política) · **propio** = solo filas del propio usuario (`auth.uid() = paciente_id`/`id`) · **asig** = solo pacientes asignados (`es_profesional_de`). La creación de `alertas` la hace el motor de escalado con service-role (salta RLS), no un rol de usuario. Ningún rol de usuario tiene DELETE salvo el admin en las tablas con `admin_todo`.

### Rol `paciente`

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| perfiles | ✓ propio | ✗ (lo crea el trigger) | ✓ propio | ✗ |
| pacientes | ✓ propio | ✓ propio | ✓ propio | ✗ |
| pautas_medicacion | ✓ propio | ✓ propio | ✓ propio | ✗ |
| checkins | ✓ propio | ✓ propio | ✓ propio | ✗ |
| mensajes | ✓ propio | ✓ propio | ✓ propio | ✗ |
| observaciones | ✓ propio | ✓ propio | ✓ propio | ✗ |
| tomas_medicacion | ✓ propio | ✓ propio | ✓ propio | ✗ |
| reglas_escalado | ✗ | ✗ | ✗ | ✗ |
| alertas | ✓ propio | ✗ | ✗ | ✗ |
| consentimientos | ✓ propio | ✓ propio | ✗ (append-only) | ✗ |
| eventos_auditoria | ✗ | ✓ (autenticado) | ✗ | ✗ |

### Rol `profesional` (sobre sus pacientes asignados)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| perfiles | ✓ asig + propio | ✗ | ✓ propio | ✗ |
| pacientes | ✓ asig | ✗ | ✗ | ✗ |
| pautas_medicacion | ✓ asig | ✓ asig | ✓ asig | ✗ |
| checkins | ✓ asig | ✗ | ✗ | ✗ |
| mensajes | ✓ asig | ✗ | ✗ | ✗ |
| observaciones | ✓ asig | ✗ | ✗ | ✗ |
| tomas_medicacion | ✓ asig | ✗ | ✗ | ✗ |
| reglas_escalado | ✓ globales + asig | ✓ asig | ✓ asig | ✗ |
| alertas | ✓ asig | ✗ (motor) | ✓ asig (gestión) | ✗ |
| consentimientos | ✓ asig | ✗ | ✗ | ✗ |
| eventos_auditoria | ✗ | ✓ (autenticado) | ✗ | ✗ |

### Rol `admin`

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| perfiles, pacientes, pautas_medicacion, checkins, mensajes, observaciones, tomas_medicacion, reglas_escalado, alertas | ✓ | ✓ | ✓ | ✓ |
| consentimientos | ✓ | ✓ | ✗ (append-only) | ✗ (append-only) |
| eventos_auditoria | ✓ | ✓ | ✗ (append-only) | ✗ (append-only) |

### Storage — bucket privado `audios-checkin`

| Rol | Subir (INSERT) | Leer (SELECT) |
|---|---|---|
| paciente | ✓ a `{su_id}/…` | ✗ (por diseño del WP) |
| profesional | ✗ | ✓ del paciente asignado |
| admin | (vía `es_profesional_de`) | ✓ todos |

---

## 7. Verificación

### `npm run build` (exit 0)

```
> botsy@0.1.0 build
> next build

▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 12.2s
  Running TypeScript ...
  Finished TypeScript in 14.4s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/13) ...
  Generating static pages using 3 workers (3/13) 
  Generating static pages using 3 workers (6/13) 
  Generating static pages using 3 workers (9/13) 
✓ Generating static pages using 3 workers (13/13) in 809ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /alertas
├ ƒ /checkin
├ ƒ /configuracion
├ ƒ /consentimientos
├ ƒ /inicio
├ ƒ /login
├ ƒ /pacientes
├ ƒ /perfil
└ ○ /registro


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

> Nota: las rutas de `(paciente)` y `(panel)` pasan de estáticas (○, WP-00) a dinámicas (ƒ) porque los route guards leen la sesión con `cookies()`, lo que activa render dinámico. Es el comportamiento correcto y esperado.

### `npm run lint` (exit 0)

```
> botsy@0.1.0 lint
> eslint

```

(Sin salida: ningún error ni warning.)

### Criterios de aceptación del WP

- Migraciones sintácticamente válidas y auto-contenidas (aplicables en orden sobre proyecto vacío) → validado con libpg_query + revisión manual (§4). **OK** (con la salvedad §4 sobre el seed de GoTrue, pendiente de `db reset` en vivo).
- Ninguna tabla sin RLS + políticas en la misma entrega → **OK** (11/11 con RLS y política; ver matriz §6).
- `npm run build` y `npm run lint` verdes, la app compila sin proyecto remoto → **OK**.
- `.env.example` actualizado → **OK** (ya contenía las variables necesarias; WP-01 no añade ninguna).

---

## 8. Credenciales del seed (para pruebas del director)

Contraseña común: **`Botsy1234!`**

| Email | Rol | Notas |
|---|---|---|
| `admin@botsy.local` | admin | Admin Botsy |
| `dra.garcia@botsy.local` | profesional | Dra. García (profesional asignado de Luis y Carmen) |
| `luis@botsy.local` | paciente | 68, cardiovascular; 14 días de datos; 1 alerta `contactar` |
| `carmen@botsy.local` | paciente | 74, geriátrica |
