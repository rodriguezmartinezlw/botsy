# Entrega WP-08 — Hardening y preparación de salida

**Fecha:** 2026-07-16 · **Implementador:** Opus (agente) · **Estado:** completo.
`npm run build`, `npm run lint` y `npm test` en **verde** (**113 tests**: los 96 de
WP-07 intactos + 4 de señal genérica + 13 de auditoría de seguridad). Ninguna
feature nueva: se endurece, audita, documenta y se deja listo para desplegar.

Este WP recoge la **lista acumulada de 7 puntos** de la revisión de WP-07 y el
alcance a-h de `docs/wp/WP-08-hardening.md`. **No se necesitó ninguna migración
nueva**: la revisión de RLS política-por-política contra la matriz de WP-01 **no
encontró defectos que corregir** (ver §a).

---

## 0. Resumen ejecutivo

- **Seguridad:** RLS revisada política por política (sin defectos); auditoría de
  acceso cruzado como **test estático en CI** (`auditoria.test.ts`, 13 tests) +
  **script SQL en vivo** (`supabase/tests/acceso_cruzado.sql`); `grep` del bundle
  `.next/static` confirma **cero** secretos/service-role en el cliente.
- **Hueco clínico cerrado:** las **señales genéricas sin regla** ya materializan
  alerta al profesional (antes el paciente veía "contacta con tu médico" y el
  profesional no se enteraba), idempotente y coherente con `/mensaje` y `/voz/tool`.
- **Demo:** seed ampliado a **45 días** de Luis (resuelve el desfase de 14 días de
  WP-07) con tendencias creíbles y **alertas en los 4 estados**; Carmen con 12
  días; historial de consentimientos. Seed del 2º profesional intacto.
- **Robustez:** sesión expirada → login **conservando destino**; estados de
  error/vacío verificados en todas las pantallas.
- **Accesibilidad, disclaimers, docs:** skip-link de teclado; `[PENDIENTE LEGAL]`
  añadido al informe; `docs/DESPLIEGUE.md` ejecutable + sección "Desarrollo local"
  en `README.md`; `.env.example` verificado completo (12/12 variables).

---

## 1. Checklist de los puntos a-h (con hallazgos y cómo se corrigieron)

### a) Auditoría de seguridad

**Acceso cruzado (paciente A/B, profesional no asignado, anónimo).** No hay
Supabase en el entorno (igual que en todos los WP anteriores), así que la
verificación es en **tres capas**:

1. **Test estático en CI** — `src/lib/seguridad/auditoria.test.ts` (13 tests): lee
   `0002_rls.sql` y el código fuente y **congela** la matriz de WP-01 y las
   invariantes de secretos. Corre en cada `npm test` (regresión-proof).
2. **Script SQL en vivo** — `supabase/tests/acceso_cruzado.sql`: simula la
   identidad de cada usuario (rol `authenticated`/`anon` + su JWT `sub`) sobre los
   datos del seed y **asserta** el aislamiento. Listo para ejecutar con `psql`
   tras `supabase db reset` (documentado en `DESPLIEGUE.md` §3).
3. **Revisión manual** de los Route Handlers y Server Actions (abajo).

**`grep` de secretos en el código y el bundle.**
- Código fuente: `service_role`/`SERVICE_ROLE` **solo** en `src/lib/supabase/admin.ts`;
  sin claves `sk-...` hardcodeadas; `crearClienteAdmin`/`openai-realtime` solo en
  código de servidor (import dinámico). Congelado por `auditoria.test.ts`.
- **Bundle `.next/static`** (build limpio): `service_role`, `SERVICE_ROLE`,
  `OPENAI_API_KEY`, `sk-...`, `crearClienteAdmin`, `openai-realtime` → **0
  ocurrencias**. Sí aparecen en `.next/server` (correcto: solo servidor).

**Route Handlers (8).** Los 8 comprueban autorización **dentro** del handler
(regla Next 16): 7 con `auth.getUser()` + verificación de pertenencia
(`.eq("paciente_id", user.id)` → 404 si es ajeno); el cron con `CRON_SECRET`
(Bearer). Todos validan el body con **Zod** (`safeParse`) y devuelven
`{ error: string }` con status apropiado **sin** filtrar internos ni stack traces.
Congelado por dos tests de `auditoria.test.ts` ("comprueba sesión/secreto" y
"valida el cuerpo con Zod"). **Sin hallazgos.**

**Server Actions (5).** Las 3 del panel (`alertas`, `configuracion`,
`pacientes/[id]`) validan Zod + `obtenerSesionPanel()` (server-only; cierra la
puerta a paciente/anónimo) + RLS por-paciente; la de consentimientos y la de
escalado/contacto validan Zod + `getUser()`. Todas auditan. **Sin hallazgos.**

**RLS política por política contra la matriz de WP-01.** Revisadas las 11 tablas
de `0002_rls.sql`. Coinciden exactamente con la matriz de WP-01 (§6 de su
entrega), incluida la corrección del director (el paciente **no** se
auto-prescribe: `pautas_medicacion` solo `select_propio`). Verificado además:
`alertas` sin INSERT de paciente; `reglas_escalado` sin acceso de paciente;
`consentimientos`/`eventos_auditoria` append-only (sin UPDATE/DELETE); todas las
políticas `to authenticated` (anon sin acceso). **No se encontró ningún defecto →
no se necesita migración nueva.** (Regla de CLAUDE.md: si hubiera hecho falta
corregir RLS, habría sido en un `0005_*.sql`, nunca editando `0002`.)

**Observación de defensa en profundidad (no defecto, anotada para F2):** la
política `auditoria_insert_autenticado` permite a cualquier autenticado INSERT en
`eventos_auditoria` (append-only, no legible salvo admin). Coincide con la matriz
de WP-01 ("✓ autenticado"), así que **no es un defecto vs. la matriz**; un usuario
malicioso solo podría añadir ruido de auditoría que no puede leer ni borrar. Se
podría endurecer a `with check (actor_id = auth.uid() or actor_id is null)` en F2
(los inserts de usuario ya ponen su propio id; el motor usa service-role).

### b) Señales genéricas sin regla → materialización de alerta

**Decisión: SÍ materializan alerta al profesional.** Era un hueco real (anotado
por la revisión de WP-04): si el LLM emite `senal_alarma` con un `tipo` que **no
casa con ninguna regla** `senal`, `evaluarSenal` lo clasifica como `contactar`
(mínimo conservador), sube `checkins.riesgo` y el paciente ve la pantalla de
contacto/urgencia — **pero** `evaluarCheckin` no dispara ninguna regla
(`reglasDisparadas` vacío), así que **no se creaba ninguna fila `alertas`** ni en
vivo ni al cierre. El profesional quedaba a ciegas ante una señal que al paciente
se le pidió actuar. Clínicamente inaceptable (mismo tipo de bug que el director ya
corrigió una vez en WP-04).

**Implementación** (idempotente y coherente con la materialización inmediata ya
existente):
- `src/lib/escalado/motor.ts`: `EvaluacionCheckin` gana `senalesDetectadas: string[]`
  (los códigos de las señales del check-in, ya cargados en `datos.senales`).
- `src/lib/escalado/acciones.ts`: nueva `aplicarEscaladoSenalGenerica(evaluacion, repo)`
  — crea **una** alerta con `regla_id = null`, `motivo = "Señal de alarma sin regla
  configurada"`, nivel = riesgo en vivo (`contactar`/`urgencia`), evidencia =
  señales + últimos mensajes; audita. **Idempotente** por nueva `alertaSinReglaExiste`
  (`.is("regla_id", null)`): una sola alerta genérica por check-in.
- Cableada en los **tres** puntos, con el mismo patrón `if (regla) aplicarEscalado
  else aplicarEscaladoSenalGenerica`: `/api/checkin/mensaje`, `/api/voz/tool`
  (`materializarEscalado`) y `finalizar.ts` (cierre). Best-effort (nunca tumba la
  respuesta) y sin re-escribir el riesgo (ya lo subió el turno en vivo).
- Tests: 4 nuevos en `motor.test.ts` (crea 1 alerta sin regla; idempotente; no
  actúa si ya disparó una regla; no actúa si el riesgo no llegó a contactar).

Nota: en la práctica una señal que va por la vía genérica **siempre** va por ahí
(las reglas no cambian a mitad de check-in), así que no hay doble-alerta con la vía
por-regla; la idempotencia lo cubre igualmente.

### c) Seed ampliado a demo completa

`supabase/seed.sql` reescrito (aditivo en espíritu; mismos ids fijos):
- **Luis: 45 días** (resuelve el desfase de 14 días anotado por WP-07). Dolor
  descendente 7→2 con **dos brotes** puntuales (días -33 y -20), ánimo 5→8 con un
  **bajón sostenido** de 3 días (-8..-6), ansiedad/estrés a la baja, sueño al alza;
  se añaden observaciones de **5 dominios** para que el perfil (WP-05) tenga todas
  las tarjetas con datos. `racha_actual/maxima = 45`.
- **Alertas en los 4 estados:** `descartada` (brote antiguo, con motivo_descarte),
  `resuelta` (brote medio, gestionada), `vista` (bajón de ánimo), `nueva`
  (fármaco crítico omitido 2 noches, hoy — se conserva el escenario de escalado).
- **Carmen: 12 días** (geriátrica estable, cognición/ánimo/dolor articular,
  adherencia buena a paracetamol) para poblar la lista del profesional con un 2º
  paciente con datos.
- **Historial de consentimientos** con `registrado_en` explícito: Luis otorga
  conversación+grabación (hace 45 d) y prueba/revoca biomarcadores (30 d / 10 d),
  demostrando la vista de historial de WP-07. Estado vigente coherente.
- **Seed del 2º profesional intacto** (`seed_wp06_segundo_profesional.sql` no se
  toca; ids 005/006 y pauta 103 no colisionan con 101/102/104).

Validado con el parser real de Postgres (libpg_query): `seed.sql` → 12 statements
OK; el resto de migraciones + el 2º seed también OK (§4). Pendiente de `db reset`
en vivo (misma salvedad de GoTrue de todos los WP).

### d) Robustez

- **Estados de error y vacío:** verificados en todas las pantallas. Chat (`cargando`
  / `no_disponible` / 503 amable / revertir burbuja optimista), voz (`fallo` con
  salida a texto; 403/503/micrófono), panel (`BandejaAlertas` y `ListaPacientes`
  con vacío y "ningún resultado"), informe (secciones "sin registros"), ficha
  (`notFound()` 404 si no es su paciente), perfil (`EstadoVacioGrafico`). Sin env
  de OpenAI el check-in devuelve 503 con mensaje ES amable (ya existía).
- **Sesión expirada → login conservando destino (nuevo):** el login acepta
  `?next=<ruta>` (solo rutas relativas seguras, anti open-redirect) y redirige allí
  tras autenticar. Los flujos interactivos (chat y voz) que reciben **401** de la
  API redirigen a `/login?next=<ruta actual>`. Así, si el token caduca mientras se
  usa la app, el paciente vuelve exactamente a donde estaba tras reautenticarse.
  Limitación consciente: las navegaciones **directas de servidor** con cookie
  caducada siguen yendo a `/login` sin `next` (los guards de layout no leen el
  path; preservarlo requeriría middleware, deferido en F1 — coherente con la nota
  H de la revisión de WP-01). El caso realista (caducidad en uso) sí se cubre.

### e) Accesibilidad (perfil geriátrico)

- **Teclado:** `:focus-visible` global (3px) ya existía; **añadido** un skip-link
  "Saltar al contenido" en el layout del paciente (visible al tabular).
- **aria-label** en botones de icono: verificados (enviar, terminar, colgar, nav,
  toggles). **Contraste AA:** texto principal `#1f2937` sobre `#faf9f6` y `texto-tenue`
  `#6b7280` sobre blanco (~4.6:1) cumplen AA. **Fuente base ≥16px:** `html { 16px }`
  + `body { 1rem }`; los ejes de gráfico a 14px son texto secundario (aceptado en
  WP-05). **Targets táctiles ≥44px** en la nav del paciente: cada ítem `py-3` +
  icono 24px + etiqueta ≈ 70px de alto; botones de acción h-12/h-14/h-16 y send
  48×48. **Zoom permitido** (`maximumScale: 5`, favorece accesibilidad).

### f) Contenido / disclaimers

- **Presentes:** landing ("Botsy no diagnostica ni sustituye a tu médico"), cierre
  con riesgo (`TarjetaContactar`/`PantallaUrgencia`/`PantallaCierre` distinguen
  "señal" de "diagnóstico"), urgencia (`avisoLegal` con `[PENDIENTE LEGAL]`),
  consentimientos (`[PENDIENTE LEGAL]` v0-borrador). Textos ES correctos, tono
  cálido, sin jerga al paciente (verificado + tests clínicos de `textos.ts`).
- **Añadido:** línea `[PENDIENTE LEGAL]` al **pie del informe** (documento que el
  profesional puede compartir): aviso de que no sustituye el juicio clínico y de
  confidencialidad RGPD, pendiente de redacción jurídica real.

### g) Deuda menor anotada

- **`desactivada_en` en pautas / exponer auditoría al profesional (de WP-06):**
  **decisión = deferir a F2.** El profesional ve el estado `activa` de la pauta,
  pero no un evento fechado de desactivación en la línea temporal (el esquema no
  tiene `desactivada_en` y `eventos_auditoria` solo lo lee admin por RLS).
  Resolverlo exige o una columna nueva (migración) o exponer un subconjunto de
  auditoría al profesional (nueva política RLS) — ambas más allá del hardening y ya
  calificadas de "limitación menor y coherente con la RLS" por la revisión de WP-06.
  Etiquetado `TODO F2`.
- **Dedup de informes (de WP-07):** **deferido a F2.** Cada visita del informe
  inserta una fila en `informes` (traza de cada emisión). Deduplicar conviene
  hacerlo con una acción explícita "Generar informe", que es un cambio de UX, no de
  hardening. Etiquetado `TODO F2`.
- **`npm audit`:** **2 moderadas**, documentadas, **sin `audit fix --force`**. El
  hallazgo actual es `postcss < 8.5.10` (XSS en CSS stringify) traído
  **transitivamente por `next@16`**; el "fix" que propone npm es `next@9.3.3` (un
  downgrade catastrófico, breaking). Es tooling de **build**, no runtime con entrada
  de usuario (Botsy no pasa CSS de usuario por postcss stringify). Se deja como
  deuda consciente hasta que Next actualice su postcss embebido. (Nota: la revisión
  de WP-07 lo situaba en la cadena de `vitest`; el árbol actual lo reporta en la de
  `next` — en ambos casos, 2 moderadas dev/build, no explotables en producción.)

### h) Demo y despliegue

- **`docs/DESPLIEGUE.md`** (nuevo): pasos EXACTOS y ejecutables por alguien sin
  contexto — crear proyecto Supabase, aplicar migraciones `0001..0004` **en orden**
  (CLI o SQL Editor), seed + 2º seed + script de acceso cruzado, storage, **primer
  usuario admin** (metadata `rol` + trigger, o UPDATE en `perfiles`), despliegue en
  Vercel con la **tabla completa de variables** desde `.env.example`, **cron con la
  nota de plan Pro**, y comprobación post-despliegue + troubleshooting.
- **`README.md`:** sección **"Desarrollo local"** (requisitos, `.env.local`,
  `npm run dev/build/lint/test`, DB local con Supabase CLI, enlace a DESPLIEGUE).
- **`.env.example` verificado completo:** `grep` de `process.env.*` en el código →
  **12 variables**, las 12 presentes en `.env.example`. Sin variables usadas y no
  documentadas.

---

## 2. Archivos

### Creados
- `src/lib/seguridad/auditoria.test.ts` — 13 tests de auditoría de seguridad (RLS,
  secretos, service-role, Route Handlers).
- `supabase/tests/acceso_cruzado.sql` — script de acceso cruzado en vivo (6
  escenarios) para `psql`.
- `docs/DESPLIEGUE.md` — guía de despliegue paso a paso.
- `docs/wp/entregas/WP-08-entrega.md` — esta entrega.

### Modificados (código)
- `src/lib/escalado/motor.ts` — `EvaluacionCheckin.senalesDetectadas`.
- `src/lib/escalado/acciones.ts` — `aplicarEscaladoSenalGenerica` + `alertaSinReglaExiste`
  (interfaz + impl Supabase con `.is("regla_id", null)`).
- `src/lib/escalado/motor.test.ts` — repo en memoria con el método nuevo + 4 tests.
- `src/app/api/checkin/mensaje/route.ts` — rama de señal genérica.
- `src/app/api/voz/tool/route.ts` — rama de señal genérica en `materializarEscalado`.
- `src/lib/ia/finalizar.ts` — rama de señal genérica al cierre.
- `src/app/(auth)/login/page.tsx` + `FormularioLogin.tsx` — `?next=` (destino seguro).
- `src/app/(paciente)/checkin/ChatCheckin.tsx` — redirección a login en 401.
- `src/app/(paciente)/checkin/voz/PantallaVoz.tsx` — redirección a login en 401.
- `src/app/(paciente)/layout.tsx` — skip-link de teclado.
- `src/components/informe/InformeVista.tsx` — línea `[PENDIENTE LEGAL]` al pie.

### Modificados (datos/docs)
- `supabase/seed.sql` — reescrito (Luis 45 días, alertas en 4 estados, Carmen 12
  días, historial de consentimientos).
- `README.md` — sección "Desarrollo local".

### NO tocados
- `supabase/seed_wp06_segundo_profesional.sql` (intacto, requisito).
- Migraciones `0001..0004` (intactas: no se necesitó ninguna corrección de RLS →
  ninguna migración nueva).
- `docs/` salvo `DESPLIEGUE.md` y esta entrega.

---

## 3. Matriz de acceso probada (caso → esperado → resultado)

Leyenda de "resultado": **[static]** congelado por `auditoria.test.ts` (CI);
**[app]** verificado por lectura del handler/acción (filtro de pertenencia);
**[live]** cubierto por `acceso_cruzado.sql` (listo para `psql` contra el seed).

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| 1 | Paciente A (Luis) lee observaciones/check-ins/tomas/alertas/ficha de Paciente B (Carmen) | **Denegado** (0 filas) | RLS `*_select_propio` (=paciente_id). **[static]** matriz + **[live]** escenario 1 |
| 2 | Paciente lee lo suyo | Permitido | `*_select_propio`. **[live]** escenario 2 |
| 3 | Paciente lee `reglas_escalado` | **Denegado** (sin política) | Sin policy de paciente. **[static]** + **[live]** escenario 3 |
| 4 | Paciente hace INSERT en `pautas_medicacion` (auto-prescripción) | **Denegado** (RLS) | Sin `pautas_insert_propio`. **[static]** + **[live]** escenario 3 |
| 5 | Paciente INSERT/UPDATE de `alertas` | **Denegado** | Solo `alertas_select_propio`. **[static]** |
| 6 | Profesional (Dra. García) lee a sus pacientes (Luis, Carmen) | Permitido | `es_profesional_de`. **[live]** escenario 4 |
| 7 | Profesional lee a un paciente de OTRO profesional (Marta/Dr. Ruiz) | **Denegado** | `es_profesional_de` = false. **[app]** ficha → 404 + **[live]** escenario 4 |
| 8 | Profesional lee alertas/observaciones de paciente ajeno | **Denegado** | RLS `_select_profesional`. **[live]** escenario 4 |
| 9 | 2º profesional (Dr. Ruiz) lee solo a Marta, no a Luis | Permitido/Denegado | **[live]** escenario 5 |
| 10 | Anónimo (sin sesión) lee pacientes/observaciones/alertas/check-ins | **Denegado** (0 filas) | Políticas `to authenticated`. **[static]** + **[live]** escenario 6 |
| 11 | Route Handler sin sesión válida | 401 `{error}` | `getUser()` dentro del handler. **[app]** + **[static]** |
| 12 | Route Handler con check-in ajeno | 404 `{error}` | `.eq("paciente_id", user.id)`. **[app]** |
| 13 | Cron sin `CRON_SECRET` correcto | 401 | `autorizarCron`. **[app]** + test de WP-07 |
| 14 | Secreto/service-role en el bundle cliente | **Ausente** | `.next/static` grep = 0. **[build]** + **[static]** |

**Nota de verificación en vivo:** los casos **[live]** requieren un proyecto
Supabase; el script `supabase/tests/acceso_cruzado.sql` los ejecuta y debe
terminar con «ACCESO CRUZADO: TODO OK». En este entorno no hay Supabase (igual que
en WP-01..07), por eso las invariantes que **sí** se pueden congelar sin BD viven
como test estático en CI.

---

## 4. Verificación (salida literal)

### `npm run lint` (exit 0)
```
> botsy@0.1.0 lint
> eslint

```
(Sin salida: ningún error ni warning.)

### `npm test` (exit 0) — 113 tests
```
 ✓ src/lib/seguridad/auditoria.test.ts (13 tests) 128ms
 ✓ src/lib/recordatorios/core.test.ts (10 tests) 160ms
 ✓ src/app/api/cron/recordatorios/route.test.ts (3 tests) 56ms
 ✓ src/lib/ia/checkin-texto.test.ts (8 tests) 33ms
 ✓ src/lib/panel/panel.test.ts (16 tests) 68ms
 ✓ src/lib/consentimientos/estado.test.ts (8 tests) 36ms
 ✓ src/lib/informes/resumen.test.ts (8 tests) 25ms
 ✓ src/lib/agregados.test.ts (19 tests) 84ms
 ✓ src/lib/escalado/motor.test.ts (21 tests) 39ms
 ✓ src/lib/ia/voz-tool.test.ts (7 tests) 15ms

 Test Files  10 passed (10)
      Tests  113 passed (113)
```
Los 96 tests de WP-07 intactos; +4 de señal genérica (`motor.test.ts` pasa de 17 a
21) y +13 de auditoría de seguridad. El `console.warn` esperado del test de cifras
inventadas ("…: 42") sigue apareciendo.

### `npm run build` (exit 0)
```
▲ Next.js 16.2.10 (Turbopack)
✓ Compiled successfully in 29.6s
  Running TypeScript ...
  Finished TypeScript in 22.6s ...
✓ Generating static pages using 3 workers (22/22) in 1012ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /alertas
├ ƒ /api/checkin/finalizar
├ ƒ /api/checkin/iniciar
├ ƒ /api/checkin/mensaje
├ ƒ /api/cron/recordatorios
├ ƒ /api/escalado/contacto
├ ƒ /api/voz/finalizar
├ ƒ /api/voz/sesion
├ ƒ /api/voz/tool
├ ƒ /checkin
├ ƒ /checkin/voz
├ ƒ /configuracion
├ ƒ /consentimientos
├ ƒ /inicio
├ ƒ /login
├ ƒ /pacientes
├ ƒ /pacientes/[id]
├ ƒ /pacientes/[id]/informe
├ ƒ /perfil
└ ○ /registro
```

### `grep` del bundle cliente (`.next/static`)
```
service_role / SERVICE_ROLE      → 0 ocurrencias
sk-... (claves OpenAI)           → 0 ocurrencias
OPENAI_API_KEY / crearClienteAdmin / openai-realtime → 0 ocurrencias
(control) OPENAI_API_KEY en .next/server → presente (correcto: solo servidor)
```

### Validación SQL (parser real de Postgres — libpg_query)
```
OK   migrations/0001_esquema_inicial.sql — 19 statements
OK   migrations/0002_rls.sql — 66 statements
OK   migrations/0003_reglas_semilla.sql — 1 statements
OK   migrations/0004_informes.sql — 6 statements
OK   seed.sql — 12 statements                       ← reescrito (45 días + alertas)
OK   seed_wp06_segundo_profesional.sql — 8 statements
OK   tests/acceso_cruzado.sql — 9 statements         ← nuevo
```

---

## 5. Deuda consciente para F2 (etiquetada)

1. **`desactivada_en` en `pautas_medicacion` / auditoría al profesional** (`TODO F2`):
   la línea temporal no muestra la fecha de desactivación de una pauta. Requiere
   columna nueva (migración) o política RLS que exponga un subconjunto de auditoría
   al profesional. No es un defecto de F1.
2. **Dedup de informes** (`TODO F2`): mover la persistencia de `informes` a una
   acción explícita "Generar informe" en lugar de en cada render.
3. **`npm audit`: 2 moderadas** (postcss vía next, build-only): esperar a que Next
   actualice su postcss embebido; **no** aplicar `audit fix --force` (downgrade a
   next@9). Revisar en cada bump de Next.
4. **Endurecer `eventos_auditoria` INSERT** (defensa en profundidad): `with check
   (actor_id = auth.uid() or actor_id is null)` para evitar ruido de auditoría
   forjado por un autenticado malicioso. Requiere migración nueva.
5. **Preservar destino en navegaciones directas de servidor con cookie caducada**:
   necesitaría middleware de auth (deferido en F1). El caso de caducidad en uso ya
   se cubre vía `?next=` en los flujos interactivos.
6. **Validador de cifras del informe** (heredado de WP-07): no detecta números
   escritos con letras; suficiente para F1.

---

## 6. Notas y decisiones propias (no "arregladas" fuera de alcance)

- **Sin migración nueva:** la RLS ya era correcta contra la matriz de WP-01. Se
  documenta explícitamente para que no se lea como omisión.
- **La materialización de la señal genérica reutiliza la maquinaria idempotente
  existente** (mismo `RepositorioAcciones`, mismo patrón best-effort), para no
  divergir del comportamiento por-regla ya revisado.
- **El seed usa `registrado_en` explícito** en consentimientos para que el historial
  sea demostrable; el estado vigente resultante es coherente con lo que espera
  `estadoVigenteConsentimientos`.
- **No detecté errores de fondo** en el WP ni en el plan que exijan corrección; los
  puntos anteriores son decisiones/deuda, no fallos a arreglar (CLAUDE.md).
