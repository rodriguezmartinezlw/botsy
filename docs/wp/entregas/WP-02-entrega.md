# Entrega WP-02 — Motor conversacional + check-in por TEXTO

**Fecha:** 2026-07-15 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde. Verificado con MOCK inyectable del cliente OpenAI (no hay `OPENAI_API_KEY` ni Supabase remoto en el entorno); guion E2E real documentado abajo para cuando haya env.

---

## 1. Qué se hizo

El corazón conversacional de Botsy en su transporte de texto: builder compartido de instrucciones+tools+checklist (una sola vez, reutilizable por WP-03/voz), loop de tool-calls con persistencia validada por Zod, reconciliación post-sesión, tres Route Handlers `/api/checkin/*` con autorización dentro del handler, y la UI móvil-first (chat + checklist de dominios + pantalla de cierre con resumen, racha y recomendación del día). Todo compila y se testea sin proveedor de IA ni BD remota gracias a la inyección del cliente OpenAI.

Arquitectura de módulos (con la separación clave: lo **puro/cliente-safe** vs. lo **servidor**):

- **`src/lib/ia/dominios.ts`** — `DOMINIOS_CHECKIN` (los 7 dominios de la checklist §2.2), `DominioCheckin`, `esDominioCheckin`. Puro, importable desde componentes cliente (la checklist visual) sin arrastrar código de servidor.
- **`src/lib/ia/schemas.ts`** — validación Zod de **todos** los argumentos de tools, de la salida de reconciliación y de los cuerpos de las API. `aEsquemaJson()` deriva el JSON Schema de los parámetros de cada tool **desde** el esquema Zod (`z.toJSONSchema`), de modo que definición-para-el-LLM y validación tienen una única fuente de verdad y no pueden divergir.
- **`src/lib/ia/openai.ts`** — interfaz `ClienteOpenAI` + implementación real contra Chat Completions vía `fetch` (modelo por `OPENAI_TEXT_MODEL`, clave leída en tiempo de petición). Inyectable: el loop, la reconciliación y las rutas dependen solo de la interfaz; los tests inyectan un mock guionizado.
- **`src/lib/ia/conversacion.ts`** — `construirContexto(pacienteId)` (memoria longitudinal RF-CV-05), `construirApertura`, `construirInstrucciones` (system prompt §2.2 + reglas clínicas), `TOOLS_CHECKIN` (neutras) + mappers `toolsParaChat` / `toolsParaRealtime`, `calcularRacha`, `construirResumen`, `fechaHoyEnZona`, `parsearDominiosCubiertos`.
- **`src/lib/ia/loop.ts`** — `RepositorioCheckin` (puerto de persistencia) + `ejecutarTurno` (loop de tool-calls: valida con Zod, persiste si es válido, devuelve el error al modelo si no, y **nunca** inserta a ciegas).
- **`src/lib/ia/repositorio-supabase.ts`** — implementación de `RepositorioCheckin` con el cliente de servidor (como el paciente autenticado, RLS `propio`; sin service-role).
- **`src/lib/ia/extraccion.ts`** — `reconciliarNucleo` (puro, testeable con mock) + `reconciliar(checkinId)` (lee transcript + códigos existentes de Supabase, extrae y de-duplica, inserta con `origen='reconciliacion'`).
- **`src/lib/escalado/senales.ts`** — **stub F1** `evaluarSenal` + `nivelMaximoRiesgo`. Punto de integración de `senal_alarma`; el motor completo es WP-04.
- **API:** `POST /api/checkin/iniciar`, `POST /api/checkin/mensaje`, `POST /api/checkin/finalizar`.
- **UI:** `(paciente)/checkin` (chat cliente `ChatCheckin.tsx` + página server), `recomendaciones.ts`, y `(paciente)/inicio` actualizado (estado del check-in de hoy, racha, CTA).

---

## 2. Archivos

### Creados

- `src/lib/ia/dominios.ts`
- `src/lib/ia/schemas.ts`
- `src/lib/ia/openai.ts`
- `src/lib/ia/conversacion.ts`
- `src/lib/ia/loop.ts`
- `src/lib/ia/repositorio-supabase.ts`
- `src/lib/ia/extraccion.ts`
- `src/lib/ia/checkin-texto.test.ts` — test del loop (mock + repo en memoria).
- `src/lib/escalado/senales.ts`
- `src/lib/http.ts` — helpers `respuestaError` / `respuestaOk` para los Route Handlers.
- `src/app/api/checkin/iniciar/route.ts`
- `src/app/api/checkin/mensaje/route.ts`
- `src/app/api/checkin/finalizar/route.ts`
- `src/app/(paciente)/checkin/ChatCheckin.tsx` — chat cliente (checklist, burbujas, "escribiendo…", banner de riesgo, cierre con confeti/racha/recomendación).
- `src/app/(paciente)/checkin/recomendaciones.ts` — recomendación del día estática por vertical (`TODO F2`).
- `vitest.config.ts`

### Modificados

- `src/app/(paciente)/checkin/page.tsx` — de placeholder a Server Component que resuelve la vertical y renderiza `<ChatCheckin>`.
- `src/app/(paciente)/inicio/page.tsx` — saludo con nombre, estado del check-in de hoy (pendiente/en curso/completado), racha actual y CTA grande.
- `src/app/globals.css` — keyframes `confeti-caer` + `.confeti-pieza` (respeta `prefers-reduced-motion`).
- `package.json` — script `"test": "vitest run"`; `vitest` añadido a `devDependencies` (vía `npm install -D`).
- Eliminados `src/lib/ia/.gitkeep` y `src/lib/escalado/.gitkeep` (esas carpetas ya tienen contenido real).

### No tocados

`.env.example` ya contenía `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL` (=`gpt-5-mini`) y `OPENAI_REALTIME_MODEL`; WP-02 no añade variables nuevas. `docs/` no se tocó salvo este archivo. Los clientes/migraciones/tipos de WP-01 se usaron tal cual, sin modificarlos.

---

## 3. Decisiones propias (no especificadas en el WP)

1. **Transporte: respuesta JSON completa, NO streaming SSE.** El WP lo deja a mi criterio. Elegí respuesta completa porque: (a) el turno es un **loop de múltiples round-trips** con el modelo (tool-calls → persistencia → nueva llamada); hacer streaming de texto *mientras* se resuelven tool-calls intermedios (que además no son texto para el usuario) complica mucho el protocolo y el manejo de errores; (b) con el mock y sin env la respuesta completa es determinista y trivialmente testeable; (c) para un check-in geriátrico los turnos son cortos y el indicador "Botsy está escribiendo…" cubre la espera percibida. Queda como mejora futura envolver la **última** llamada (la que sí produce texto) en SSE si hiciera falta.
2. **Cliente OpenAI por `fetch`, sin el SDK `openai`.** Evita una dependencia pesada, da control total de la forma de la petición, es trivialmente inyectable/mockeable, y las tools neutras mapean igual a Realtime (WP-03). La respuesta del proveedor se **valida con Zod** (`esquemaRespuestaOpenAI`) antes de usarse.
3. **`z.toJSONSchema` como fuente única de verdad** de los parámetros de tools (en `aEsquemaJson`). Elimina la posibilidad de que la definición para el LLM y la validación Zod diverjan.
4. **Apertura determinista** (`construirApertura`) en `/iniciar`, sin llamar al LLM. Iniciar el check-in funciona siempre, sin coste ni dependencia de env; la personalización (nombre) basta para el saludo cálido del §2.2. Solo `/mensaje` (y la reconciliación) necesitan el LLM.
5. **`senal_alarma` (stub F1): toda señal → `contactar` como mínimo**, con mensaje calmado que sugiere contactar al médico. La clasificación fina (p. ej. elevar a `urgencia` la combinación dolor torácico + disnea en cardiovascular, que es literalmente la regla #1 del seed `0003`) es de WP-04; el stub `evaluarSenal` deja ese punto marcado con `TODO WP-04`. `nivelMaximoRiesgo` garantiza que el riesgo del check-in solo **sube**, nunca baja.
6. **Separación `dominios.ts` (puro) ↔ `conversacion.ts`.** El `DOMINIOS_CHECKIN` canónico vive en `dominios.ts` (importable por el cliente sin arrastrar servidor) y se re-exporta desde `conversacion.ts` (así este último cumple el WP: exporta `DOMINIOS_CHECKIN`). Además `construirContexto` carga el cliente de servidor por **dynamic import**, para que `conversacion.ts` no arrastre `next/headers` a bundles de cliente ni a los tests.
7. **Dos vocabularios de dominio, a propósito.** `DOMINIOS_CHECKIN` (7) es la checklist de la conversación (lo que marca `marcar_dominio_cubierto` y se guarda en `checkins.dominios_cubiertos`). `registrar_observacion.dominio` usa el enum fino de la BD (`observaciones.dominio`, 10 valores: dolor, sintoma_fisico, animo, ansiedad, estres, sueno, cognicion, adherencia, tratamiento, habitos). Un dominio de checklist agrupa varios de observación (p. ej. "animo" agrupa ánimo/ansiedad/estrés/sueño).
8. **Persistencia de mensajes tras un turno correcto.** `/mensaje` calcula el orden, ejecuta el turno (que persiste observaciones/tomas/señales durante el loop) y **solo entonces** inserta los mensajes de usuario y asistente juntos. Si el turno falla (falta clave OpenAI, red), no quedan mensajes huérfanos y la UI revierte la burbuja optimista; el usuario reintenta.
9. **Códigos de señal alineados con el seed de reglas.** El guion de prueba usa `dominio='sintoma_fisico'` con códigos `dolor_toracico`/`disnea`, exactamente los de la regla #1 de `0003_reglas_semilla.sql`, para que WP-04 dispare sin fricción de vocabulario.
10. **Fechas por zona horaria del paciente** (`fechaHoyEnZona`, `Intl.DateTimeFormat('en-CA')`, por defecto `Europe/Madrid`), para que la unicidad `checkins(paciente_id,fecha)` y la lógica de días consecutivos de la racha sean correctas respecto al día local del paciente.
11. **Resumen de cierre determinista** (`construirResumen`), generado en `/finalizar` a partir de las observaciones/tomas del día (no del LLM), para robustez sin env y para que no dependa de que el modelo llamara `finalizar_checkin`. `finalizar_checkin` sí se soporta en el loop (marca intención + `resumenSugerido`), pero el resumen persistido lo genera el endpoint.
12. **Recomendación del día estática por vertical** (`recomendaciones.ts`), marcada `TODO F2: motor de recomendaciones`, con textos orientativos no terapéuticos que no contradicen la pauta del profesional.

---

## 4. Cumplimiento de las reglas de CLAUDE.md (verificables en revisión)

- **Autorización DENTRO de cada Route Handler (Next 16, sin middleware).** Los tres handlers hacen `crearClienteServidor()` + `supabase.auth.getUser()`; `iniciar` exige además rol `paciente`.
- **Pertenencia verificada antes de escribir.** `mensaje` y `finalizar` seleccionan el checkin con `.eq("id", checkinId).eq("paciente_id", user.id)`; si no existe → 404. `mensaje` además rechaza (409) si el checkin no está `en_curso`. El repositorio de Supabase re-filtra por `paciente_id`/`checkin_id` en cada escritura (defensa en profundidad; RLS `propio` de WP-01 es la barrera real).
- **TypeScript estricto, cero `any`.** `grep` de `any` en `src/lib/ia` y `src/app/api` → sin coincidencias. Entradas externas tipadas como `unknown` + narrowing/Zod.
- **Toda salida estructurada del LLM se valida con Zod y, si no valida, se descarta.** En el loop, un argumento inválido no se persiste: se devuelve el error al modelo para que corrija (demostrado en el test "validación Zod"). La respuesta del proveedor también se valida antes de usarse.
- **Sin service-role para escribir datos del paciente.** El motor escribe como el paciente autenticado (nota de WP-01-revisión aplicada). `admin.ts` no se importa en WP-02.
- **Reglas clínicas.** El system prompt prohíbe diagnosticar, recomendar fármacos/dosis y minimizar señales de alarma; ante dudas médicas fuera de registro → "consúltalo con tu médico" (RF-CV-08). La UI distingue "señal detectada" de "diagnóstico" (banner de riesgo y resumen lo dicen explícitamente), mantiene tono calmado y no dramatiza. Fuentes ≥16px, botones `h-12`/`h-14`, `aria-live`/`role="log"`/labels, respeta `prefers-reduced-motion`.
- **Errores:** los handlers devuelven `{ error: string }` con status apropiado (400/401/403/404/409/500/503) y **nunca** filtran mensajes internos ni stack traces.
- **Secretos:** nada hardcodeado; `OPENAI_API_KEY`/`OPENAI_TEXT_MODEL` por env, con fallo controlado si faltan (503 amable en `/mensaje`).

---

## 5. Guion de prueba

### 5.1 Resultado con el MOCK (criterio de aceptación sin env) — `npm test`, 8/8 en verde

El test `src/lib/ia/checkin-texto.test.ts` ejercita el **loop real** (`ejecutarTurno`) con un `ClienteOpenAI` guionizado y un `RepositorioCheckin` en memoria:

- **Escenario A (WP):** el paciente dice *"me duele un poco la cabeza, un 4 de 10, y ya me tomé la aspirina de esta mañana"*. El modelo (mock) extrae en el mismo turno: `registrar_observacion(dolor/dolor_cabeza, valor_num=4)`, `registrar_toma(pauta, mañana, tomada)`, `marcar_dominio_cubierto(dolor)` y `marcar_dominio_cubierto(adherencia)`; luego responde preguntando por lo **pendiente** (un síntoma nuevo) sin repreguntar dolor ni aspirina. Se verifica: 1 observación (dolor=4), 1 toma (tomada), dominios cubiertos `{dolor, adherencia}`, y —mecanismo del "no repreguntar"— que al reconstruir `construirInstrucciones` con esos dominios cubiertos, dolor/adherencia **salen** de la sección PENDIENTES y aparecen en YA cubiertos. La racha pasa de 4 (con `ultimo_checkin` ayer) a 5.
- **Escenario B (WP):** *"me duele el pecho y me falta el aire"* → el modelo llama `senal_alarma(...)`; el loop invoca `evaluarSenal` (stub) → el checkin queda con **riesgo `contactar`** y el asistente responde con calma sugiriendo contactar al médico (se verifica que el texto contiene "médico" y una expresión calmada, sin dramatizar).
- **Validación Zod:** una `registrar_observacion` con `confianza=5` (inválida) **no** se persiste; el reintento válido sí. Queda 1 observación.
- **Reconciliación:** `reconciliarNucleo` con un lote {duplicado ya presente, nuevo} y `codigosExistentes={dolor:dolor_cabeza}` → devuelve solo el nuevo (dedup por dominio+código).
- **Racha (bordes):** mismo día = sin cambio; hueco de 2+ días = reinicio a 1; primer check-in = 1.

### 5.2 Guion para la prueba E2E real (cuando haya `OPENAI_API_KEY` + Supabase)

1. `supabase db reset` (aplica `0001..0003` + `seed.sql`); rellenar `.env.local` con Supabase + `OPENAI_API_KEY` (+ `OPENAI_TEXT_MODEL` vigente).
2. Login como `luis@botsy.local` / `Botsy1234!`. Ir a **Inicio** → "Empezar mi check-in".
3. `/iniciar` crea el checkin de hoy (`canal=texto`) y muestra la apertura. Escribir: *"Me duele un poco la cabeza, un 4 de 10, y ya me tomé la aspirina de esta mañana."*
4. Esperado: Botsy **no** repregunta dolor ni aspirina; pregunta por dominios pendientes (síntomas, ánimo/sueño, etc.). Los chips "Dolor" y "Medicación" quedan marcados. En BD: filas en `checkins`, `mensajes`, `observaciones` (dolor_cabeza=4), `tomas_medicacion` (tomada).
5. Escribir *"me duele el pecho y me falta el aire"* → banner calmado "contactar con tu médico"; `checkins.riesgo='contactar'`; evento en `eventos_auditoria`.
6. "Terminar mi check-in" → `/finalizar`: `estado='completado'`, `resumen`, `duracion_seg`, racha actualizada (días consecutivos), `reconciliar` inserta observaciones extra con `origen='reconciliacion'` sin duplicar. Pantalla de cierre: resumen + racha + recomendación del día.

---

## 6. Dudas / riesgos y notas sobre el WP/plan (no "arreglados", solo anotados)

- **A. Stub de escalado vs. regla urgencia del seed.** El seed `0003` clasifica *dolor torácico + disnea* (cardiovascular) como **`urgencia`**, pero el stub F1 fija `contactar` para toda señal. Es **coherente** con el WP ("`contactar` como mínimo") y con "el motor completo llega en WP-04": ese motor, al leer `reglas_escalado`, **elevará** este caso a `urgencia` (via `nivelMaximoRiesgo`, el riesgo solo sube). No es un conflicto; lo dejo señalado para que WP-04 lo cierre.
- **B. `valor_num` acotado a 0–10 en Zod.** Encaja con las escalas del §2.2 (dolor 0–10, ánimo 0–10). Un dato numérico fuera de esa escala se rechazaría (el modelo debería usar `valor_texto`). Si en algún dominio hiciera falta otro rango numérico, habría que relajar el esquema. Decisión conservadora y documentada.
- **C. `finalizar` es idempotente pero el resumen lo genera el endpoint, no el LLM.** Si se prefiere el resumen redactado por el modelo (`finalizar_checkin`), habría que persistir `resumenSugerido` en `checkins.resumen` durante `/mensaje` y que `/finalizar` lo prefiera. Elegí el determinista por robustez sin env.
- **D. Sin recordatorios push (RF-CV-07) ni multiidioma (RF-CV-10).** Fuera del alcance de WP-02 (F1 es es-ES; push es F2+). Solo lo menciono para que no se lea como omisión.
- **E. Consistencia parcial ante fallo de BD a mitad de loop.** Si una escritura de observación/toma falla dentro del turno, el turno aborta (503) y puede haber quedado alguna observación previa persistida sin su mensaje asociado. Es una degradación aceptable en F1 (no hay transacciones multi-tabla desde el cliente Supabase); anotado por transparencia.
- **F. `npm audit` reporta 2 vulnerabilidades moderadas** introducidas por la cadena de dependencias de `vitest` (solo `devDependencies`, no afectan al runtime de producción). No ejecuté `audit fix --force` para no alterar versiones fuera de alcance.
- **G. Observación menor de coherencia doc.** La funcional §10 sitúa el "motor de reglas de escalado" en **F2**, mientras el PLAN-MAESTRO incluye "protocolo de escalado básico" en F1 y define WP-04. WP-02 solo deja el stub + punto de integración, así que no me afecta; lo apunto para que el director lo concilie si quiere.

---

## 7. Verificación (salida literal)

### `npm run lint` (exit 0)

```
> botsy@0.1.0 lint
> eslint

```

(Sin salida: ningún error ni warning.)

### `npm test` (exit 0)

```
> botsy@0.1.0 test
> vitest run

 RUN  v3.2.7 C:/Users/PROPIETARIO/Desktop/projects/botsy

 ✓ src/lib/ia/checkin-texto.test.ts (8 tests) 21ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  17:12:48
   Duration  3.27s (transform 248ms, setup 0ms, collect 2.55s, tests 21ms, environment 0ms, prepare 245ms)
```

### `npm run build` (exit 0)

```
> botsy@0.1.0 build
> next build

▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 11.6s
  Running TypeScript ...
  Finished TypeScript in 10.2s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/16) ...
✓ Generating static pages using 3 workers (16/16) in 782ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /alertas
├ ƒ /api/checkin/finalizar
├ ƒ /api/checkin/iniciar
├ ƒ /api/checkin/mensaje
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

Las tres rutas `/api/checkin/*` aparecen como dinámicas (ƒ), lo correcto para Route Handlers con sesión.

### Criterios de aceptación del WP

- Build + lint verdes → **OK**.
- Conversación E2E con extracción demostrada vía **mock inyectable + test del loop** (guion §5.1); guion E2E real listo (§5.2) → **OK**.
- `senal_alarma` "me duele el pecho y me falta el aire" → `riesgo='contactar'` + respuesta calmada → **OK** (test escenario B).
- Cero `any`; todos los argumentos de tools validados con Zod → **OK**.
