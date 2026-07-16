# Entrega WP-07 — Informes imprimibles + recordatorios + consentimientos completos

**Fecha:** 2026-07-16 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde (**96 tests**, +29 sobre los 67 de WP-06). Migración nueva validada con el parser real de Postgres (libpg_query).

---

## 1. Qué se hizo

Los tres flujos de salida/retención/cumplimiento de WP-07, sobre WP-01/05/06:

### A. Informe imprimible por paciente (RF-DB-06, F1)
- **Ruta `(panel)/pacientes/[id]/informe?desde&hasta`** — Server Component protegido con `obtenerSesionPanel` (solo profesional/admin) y, vía el cliente de sesión, con la **RLS de WP-01** (si el paciente no es suyo → `cargarDatosInforme` devuelve `null` → **404**).
- **Documento** optimizado para imprimir (`@media print` en `globals.css`, estilo `/print` de la casa): cabecera con logo Botsy + datos del paciente + período; **resumen ejecutivo por LLM**; **tablas/gráficos** de dolor (stats + sparkline SVG), ánimo/ansiedad/estrés (tabla) y **adherencia por fármaco** (% + tomadas/omitidas + fila L–D); **alertas del período** con su estado/resolución y evidencia; síntomas/observaciones destacadas; **consentimientos vigentes**; pie *"Documento de seguimiento generado por Botsy. No constituye diagnóstico."* + fecha.
- **Selector de período** con presets (7/30/90 días) y **botón Imprimir** (`window.print()`), ocultos en impresión (`data-no-print`).
- **Resumen persistido** en tabla nueva **`informes`** (migración `0004`, con RLS) para trazabilidad. Si OpenAI falla → informe **sin** resumen, con aviso, y no se persiste resumen.
- **Botón "Ver informe"** de la ficha 360º (WP-06) conectado (antes deshabilitado).

### B. Recordatorio de check-in (RF-CV-07, F1 ligero)
- **`GET /api/cron/recordatorios`** protegido por `CRON_SECRET` (`Authorization: Bearer`). Busca pacientes cuya `hora_checkin` ya pasó **en su zona** y **sin check-in hoy**, y envía email cálido en español (Resend) con enlace al check-in. **No reenvía** si ya se envió hoy (consulta a `eventos_auditoria`). Registra cada envío en `eventos_auditoria` (`accion='recordatorio_enviado'`).
- **`vercel.json`** con el cron horario en la franja diurna.
- Push web/nativo = **F2** (documentado abajo).

### C. Consentimientos completos
- **`(paciente)/consentimientos`** mejorada: **texto completo por tipo** (`[PENDIENTE LEGAL]` v0-borrador con estructura real: responsable, finalidad, base, conservación, derechos, revocación), **historial de cambios visible**, **revocación con confirmación** y **efecto inmediato**.
- **Interstitial obligatorio de consentimiento** (`conversacion`): en `/checkin`, `/checkin/voz` (ya existía en voz) y `/inicio`; sin ese consentimiento la app **explica el porqué y no permite conversar**. Gate reforzado en servidor (`/api/checkin/iniciar` y `/api/voz/sesion` → 403).
- **Integración con WP-03**: revocar `voz_grabacion` hace que la **siguiente** sesión de voz no grabe (la ruta recalcula el estado vigente en cada sesión; `PantallaVoz` solo instancia `MediaRecorder` si el flag viene `true`).
- El profesional ve el estado en la ficha 360º: WP-06 ya muestra el **historial** en la línea temporal (respetado); se añade además un panel compacto **"Consentimientos vigentes" (solo lectura)**.

**Reglas cumplidas:** el resumen del informe **no inventa ni diagnostica** y **solo usa cifras existentes** (garantía en dos capas, §6); auth **dentro** de cada handler / Server Action (el cron por `CRON_SECRET`, no por sesión); validación **Zod**; secretos solo por env (`.env.example` actualizado); la tabla nueva va con **RLS + políticas en la misma migración**; TypeScript estricto **sin `any`**.

---

## 2. Archivos

### Creados — lógica pura (testeada)
- `src/lib/consentimientos/estado.ts` — `estadoVigenteConsentimientos`, `puedeConversar`, `debeGrabarVoz`, `historialDeTipo` (+ `estado.test.ts`, 8 tests).
- `src/lib/informes/resumen.ts` — `construirHechos`, `cifrasPermitidas`, `extraerCifras`, `validarResumenSinCifrasInventadas`, `construirPromptResumen`, `generarResumenEjecutivo` (cliente OpenAI inyectable) (+ `resumen.test.ts`, 8 tests).
- `src/lib/recordatorios/core.ts` — `autorizarCron`, `debeRecordar`, `procesarRecordatorios` (deps inyectables), helpers de fecha/hora (+ `core.test.ts`, 10 tests).

### Creados — consentimientos / informes (datos y textos)
- `src/lib/consentimientos/textos.ts` — textos legales borrador por tipo.
- `src/lib/informes/tipos.ts` — tipos presentacionales del informe.
- `src/lib/informes/datos.ts` — `cargarDatosInforme` (server-only; RLS; reutiliza `@/lib/agregados`).
- `src/lib/recordatorios/email.ts` — `plantillaRecordatorio` (pura) + `enviarEmailResend`.

### Creados — rutas / páginas / componentes
- `src/app/api/cron/recordatorios/route.ts` (+ `route.test.ts`, 3 tests del handler).
- `src/app/(panel)/pacientes/[id]/informe/page.tsx`.
- `src/components/informe/InformeVista.tsx`, `BarraInforme.tsx`, `MiniSparkline.tsx`.
- `src/components/paciente/InterstitialConsentimiento.tsx`.
- `src/components/panel/ficha/ConsentimientosVigentes.tsx`.

### Creados — migración / config
- `supabase/migrations/0004_informes.sql` — tabla `informes` + RLS + 3 políticas.
- `vercel.json` — cron `/api/cron/recordatorios` (`0 6-20 * * *`).

### Modificados
- `src/types/db.ts` — tipos `Informe`/`InformeInsert` + entrada en `BaseDatos`.
- `src/app/(paciente)/consentimientos/page.tsx` — carga historial completo + estado vigente.
- `src/app/(paciente)/consentimientos/PanelConsentimientos.tsx` — texto completo, historial, revocación con confirmación, efecto inmediato.
- `src/app/(paciente)/consentimientos/acciones.ts` — revalida rutas afectadas por el gating.
- `src/app/(paciente)/checkin/page.tsx` — interstitial si falta `conversacion`.
- `src/app/(paciente)/checkin/voz/page.tsx` — usa el helper de estado vigente.
- `src/app/(paciente)/inicio/page.tsx` — interstitial si falta `conversacion`.
- `src/app/api/checkin/iniciar/route.ts` — gate 403 por `conversacion`.
- `src/app/api/voz/sesion/route.ts` — usa el helper de estado vigente.
- `src/components/panel/ficha/CabeceraFicha.tsx` — "Ver informe" enlazado.
- `src/components/panel/ficha/FichaPacienteTabs.tsx` — añade panel de consentimientos vigentes.
- `src/app/globals.css` — estilos `@media print` del informe.
- `.env.example` — `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL`.

### No tocados
`docs/` salvo este archivo. Se reutilizaron **sin modificar** `@/lib/agregados`, `@/components/graficos/*` (`PuntosAdherencia`), `@/components/panel/{BadgeNivel,EvidenciaAlerta}`, `@/lib/ia/openai` (cliente inyectable), `@/lib/panel/sesion-panel` y los clientes/tipos de WP-01.

---

## 3. Decisiones propias (no especificadas en el WP)

1. **Garantía "sin cifras inventadas" en dos capas.** No basta con pedírselo al modelo: (a) el prompt solo recibe una lista de **hechos** ya calculados (cifras reales); (b) un **validador determinista** revisa el texto y, si aparece cualquier cifra ajena al conjunto permitido, **descarta el resumen** (informe sin resumen). Así, aunque el LLM alucine un número, nunca llega al informe. Es la base de la demostración de aceptación (a) (§6).
2. **Informe sin Recharts, a propósito.** Los gráficos con `ResponsiveContainer`/`ResizeObserver` pueden romperse en `@media print`. El informe usa un **sparkline SVG estático** propio (`MiniSparkline`) y **tablas** + el widget CSS `PuntosAdherencia` de WP-05: todo se imprime de forma fiable. Los números del informe salen de `@/lib/agregados` (los mismos que el perfil de WP-05 y los que ve el LLM).
3. **Persistencia del informe en el render (best-effort).** Cada visualización del informe inserta una fila en `informes` (paciente, período, resumen, `generado_por`, modelo) para trazabilidad; envuelto en try/catch (nunca rompe el render). Consecuencia: refrescar genera otra fila (traza de cada emisión). Si se prefiere "una fila por generación explícita", se movería a un botón/acción en un WP futuro (anotado, no cambiado).
4. **Cron protegido por `CRON_SECRET`, con imports dinámicos.** El handler valida el secreto **primero** y solo entonces importa dinámicamente Supabase service-role y Resend. Ventaja: la autorización es barata y el handler es **testeable** sin infraestructura ni `server-only` en el grafo de carga (el test del 401 no toca Supabase).
5. **El cron usa service-role** (`admin.ts`): es un job sin usuario que consulta a todos los pacientes y lee/inserta en `eventos_auditoria` (solo-admin por RLS). Es el uso legítimo de service-role documentado en WP-01.
6. **Franja del cron en UTC.** Vercel ejecuta los crons en **UTC**; se define `0 6-20 * * *` (cubre ~8–21 Europe/Madrid en verano e invierno). El gate fino por paciente lo hace `debeRecordar` con **su** zona y **su** `hora_checkin`, así que ejecutar alguna hora de más es inocuo (no envía si no toca).
7. **Email como canal F1**, sender/URL por env (`RESEND_FROM`, `APP_URL`) además de `RESEND_API_KEY`/`CRON_SECRET` (el WP pedía estas dos; las otras dos son necesarias para un email real y quedan documentadas).
8. **Centralización del estado de consentimientos.** La lógica "histórico append-only → vigente = último por tipo" estaba duplicada en 3 sitios (página de consentimientos, ruta y página de voz). Se extrajo a `@/lib/consentimientos/estado` (puro, testeado) y se reusó en todos, incluida la nueva página de check-in por texto y el informe.
9. **Interstitial en 3 puntos** (`/inicio`, `/checkin`, `/checkin/voz`) + **gate de servidor** en ambos handlers de check-in, para que no haya forma de conversar sin el consentimiento `conversacion` (ni por UI ni forzando la API).
10. **Ficha 360º:** se respeta el historial de consentimientos que ya pinta la línea temporal de WP-06 y se **añade** un panel compacto "vigentes" (solo lectura) derivado de esa misma timeline, sin consultas nuevas.
11. **`informes`: sin acceso para el paciente.** El informe es una herramienta del profesional; las políticas dan SELECT/INSERT al profesional asignado (y admin), no al paciente. Si se quisiera que el paciente vea sus informes, es una política de una línea (anotado).

---

## 4. Verificación (salida literal)

### `npm run lint` (exit 0)
```
> botsy@0.1.0 lint
> eslint

```
(Sin salida: ningún error ni warning.)

### `npm test` (exit 0)
```
 ✓ src/lib/panel/panel.test.ts (16 tests) 1184ms
 ✓ src/lib/escalado/motor.test.ts (17 tests) 68ms
 ✓ src/lib/ia/voz-tool.test.ts (7 tests) 25ms
 ✓ src/lib/agregados.test.ts (19 tests) 143ms
 ✓ src/lib/ia/checkin-texto.test.ts (8 tests) 37ms
 ✓ src/lib/recordatorios/core.test.ts (10 tests) 145ms
 ✓ src/lib/informes/resumen.test.ts (8 tests) 34ms
 ✓ src/lib/consentimientos/estado.test.ts (8 tests) 47ms
 ✓ src/app/api/cron/recordatorios/route.test.ts (3 tests) 44ms

 Test Files  9 passed (9)
      Tests  96 passed (96)
```
Los 67 tests previos siguen verdes; +29 nuevos (consentimientos 8, informes 8, recordatorios core 10, cron handler 3). En el test "DESCARTA el resumen…" aparece un `console.warn` esperado: `Resumen ejecutivo descartado: cifras no presentes en los datos: 42`.

### `npm run build` (exit 0)
```
▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 17.5s
  Running TypeScript ...
  Finished TypeScript in 28.7s ...
✓ Generating static pages using 3 workers (22/22) in 1555ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /alertas
├ ƒ /api/checkin/finalizar
├ ƒ /api/checkin/iniciar
├ ƒ /api/checkin/mensaje
├ ƒ /api/cron/recordatorios      ← nuevo (cron)
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
├ ƒ /pacientes/[id]/informe      ← nuevo (informe)
├ ƒ /perfil
└ ○ /registro
```

### Validación de la migración nueva (parser real de Postgres — libpg_query)
No hay Supabase CLI/Docker en el entorno (igual que WP-01/06). Validado con `pg-query-emscripten` (ya presente en `node_modules`):
```
OK   supabase/migrations/0001_esquema_inicial.sql — 19 statements
OK   supabase/migrations/0002_rls.sql — 66 statements
OK   supabase/migrations/0003_reglas_semilla.sql — 1 statements
OK   supabase/migrations/0004_informes.sql — 6 statements   ← nueva
OK   supabase/seed.sql — 10 statements
```
`0004` = `create table` + `create index` + `alter table … enable rls` + 3 `create policy`. Pendiente de `supabase db reset` en vivo (misma salvedad de siempre).

---

## 5. Criterios de aceptación

- **Build + lint + tests verdes** → **OK** (§4).
- **Informe imprime bien; resumen sin cifras inventadas** → §6. La demostración de "solo cifras reales" y "sin resumen si el LLM inventa o falla" está automatizada en `resumen.test.ts`.
- **Cron: secret correcto → email/auditado; incorrecto → 401** → §7. `route.test.ts` prueba el 401 del handler; `core.test.ts` prueba el envío+auditoría con dependencias simuladas.
- **Consentimiento: paciente nuevo no puede iniciar check-in; al otorgarlo sí; revocar `voz_grabacion` impide grabar** → §8, `estado.test.ts`.

---

## 6. Demostración: resumen ejecutivo sin cifras inventadas

**Diseño.** `construirHechos(datos)` produce frases con cifras **reales** (período, nº de check-ins, dolor media/pico/mínimo, medias de ánimo/ansiedad/estrés, adherencia global y por fármaco, alertas por nivel). Es **lo único** que recibe el modelo (`construirPromptResumen`). Tras la respuesta, `validarResumenSinCifrasInventadas` extrae **todas** las cifras del texto y comprueba que estén en `cifrasPermitidas` (las de los hechos + componentes de las fechas del período + edad). Si hay alguna intrusa → `generarResumenEjecutivo` devuelve `{estado:'sin_resumen', motivo:'cifras_invalidas'}` y el informe sale sin resumen (con aviso).

**Tests (`src/lib/informes/resumen.test.ts`, mock del cliente OpenAI de WP-02, sin red):**
1. *"al armar el prompt SÓLO pasa cifras reales"* — captura la entrada enviada al cliente y verifica que **toda** cifra del mensaje de usuario está en `cifrasPermitidas`.
2. *"acepta un resumen que sólo usa cifras existentes"* — el mock devuelve un resumen con 30/14/5/10/8/2/93/86/1 (todas reales) → `estado:'ok'`.
3. *"DESCARTA el resumen si el LLM introduce una cifra inventada"* — el mock devuelve "…mejoró un **42%**…" (42 no existe en los datos) → `estado:'sin_resumen', motivo:'cifras_invalidas'`.
4. *"sale sin resumen si el proveedor falla"* — el mock lanza → `motivo:'error_proveedor'`.
5. *"no llama al LLM si no hay datos"* — `totalCheckins:0` → `motivo:'sin_datos'`, sin invocar al cliente.

Es decir: **por construcción y por validación** el resumen no puede contener una cifra ausente en los datos.

## 7. Demostración: cron (401 y envío auditado)

- **401 (handler)** — `src/app/api/cron/recordatorios/route.test.ts`: `GET` sin cabecera → **401**; con `Authorization: Bearer <incorrecto>` → **401**; con el correcto **no** devuelve 401 (pasa la autorización). El secreto se compara contra `process.env.CRON_SECRET` **dentro** del handler.
- **Envío + auditoría (lógica)** — `src/lib/recordatorios/core.test.ts`: con 3 candidatos (uno con hora pasada y sin check-in, uno que ya hizo check-in, uno con hora aún no llegada), `procesarRecordatorios` envía email y audita **solo** al primero (`{candidatos:3, enviados:1, omitidos:2, errores:0}`). Otro test verifica que **no reenvía** si `yaEnviadoHoy` es `true`.

## 8. Demostración: bloqueo por consentimiento

`src/lib/consentimientos/estado.test.ts`:
- Paciente **nuevo** (sin filas) → `puedeConversar` **false** (no puede iniciar check-in). En servidor, `/api/checkin/iniciar` y `/api/voz/sesion` devuelven **403**; en UI se muestra el interstitial.
- Al **otorgar** `conversacion` → `puedeConversar` **true**.
- Al **revocar** `conversacion` (última fila) → `puedeConversar` **false**.
- Al **revocar** `voz_grabacion` (última fila) → `debeGrabarVoz` **false** mientras `puedeConversar` sigue **true**: en la **siguiente** sesión de voz, `/api/voz/sesion` recalcula el estado vigente y devuelve `voz_grabacion:false`, por lo que `PantallaVoz` (WP-03) **no** instancia `MediaRecorder`. Integración con WP-03 verificada por lectura del código (la grabación está condicionada a `datos.consentimientos.voz_grabacion`).

---

## 9. Dudas / riesgos detectados (anotados, no "arreglados")

- **A. El seed de Luis tiene 14 días de datos, no 30.** El criterio de aceptación menciona "Informe de Luis (seed, 30 días)". El seed de WP-01 crea **14** días. El informe a 30 días muestra correctamente esos 14 días (los demás días salen "sin registro"). No es un fallo de WP-07; es el volumen del seed de WP-01. Un informe a 7 días también funciona.
- **B. Persistencia del informe en cada render.** Ver decisión §3.3: cada visita inserta una fila en `informes`. Es trazabilidad de cada emisión; si se quiere deduplicar, conviene una acción explícita "Generar informe" (WP futuro).
- **C. Crons horarios requieren plan Vercel Pro.** El plan Hobby limita los crons a **1/día**. `vercel.json` expresa la cadencia deseada (`0 6-20 * * *`); en Hobby habría que reducirla o usar otro scheduler. Es un tema de despliegue, no de código.
- **D. `RESEND_FROM` debe ser un dominio verificado** en Resend para producción; el valor por defecto (`recordatorios@botsy.local`) es solo un placeholder de `.env.example`.
- **E. El validador de cifras podría rechazar de más.** Si el modelo introduce un número legítimo pero no listado (p. ej. una fecha que le pedimos no mencionar), el resumen se descarta por prudencia. Es el lado seguro (mejor sin resumen que con una cifra no verificable); el prompt pide explícitamente no introducir cifras ni fechas nuevas.
- **F. `informes` sin acceso del paciente** por diseño (ver decisión §3.11); revisar si se desea lo contrario.
- **G. Migración pendiente de `db reset` en vivo** (misma salvedad de GoTrue/entorno de WP-01/06); validada con parser real y sigue los patrones ya revisados (helpers `es_profesional_de`/`es_admin`).
- **H. No detecté errores en el WP ni en el plan** que exijan corrección; los puntos anteriores son decisiones/observaciones, no fallos a "arreglar" (según CLAUDE.md).

---

## 10. Variables de entorno nuevas (`.env.example`)

| Variable | Uso |
|---|---|
| `CRON_SECRET` | Autoriza `GET /api/cron/recordatorios` (`Authorization: Bearer`). |
| `RESEND_API_KEY` | Clave de Resend para enviar los emails de recordatorio (solo servidor). |
| `RESEND_FROM` | Remitente de los emails (dominio verificado en producción). |
| `APP_URL` | URL base para el enlace del check-in en el email. |
