# Entrega WP-04 — Motor de escalado + alertas

**Fecha:** 2026-07-15 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde (25/25 tests). Motor DETERMINISTA por reglas (D8, sin ML). Sin proyecto Supabase/OpenAI en el entorno: la lógica pura y las acciones se prueban con datos en memoria; el resto queda cableado para el E2E con env.

---

## 1. Qué se hizo

Motor de escalado que clasifica cada check-in en `normal / vigilancia / contactar / urgencia`, genera **alertas auditables** para el profesional (RF-ES-04/06) e informa al paciente con lenguaje **empático y no diagnóstico** (RF-ES-02/03), con separación estricta entre evaluación pura (testeable) y carga de datos (IO).

- **`src/lib/escalado/motor.ts`** — `evaluarReglas(datos, reglas)` PURO (sin IO): evalúa el JSONB de `condicion` para los cinco tipos (`observacion`, `senal`, `combinacion` con `todas`/`alguna`, `adherencia_critica`, `tendencia`), con validación Zod del formato (regla malformada → se ignora, no rompe). `evaluarCheckin(checkinId)` carga observaciones del check-in + contexto histórico (tendencias 30 días, adherencia crítica, señales del check-in) + reglas activas aplicables (globales + del paciente + de su vertical) y devuelve `{nivel, reglasDisparadas}` con el nivel más alto.
- **`src/lib/escalado/senales.ts`** — reemplaza el STUB de WP-02. `evaluarSenal(entrada)` (pura, síncrona, **misma firma que consume `loop.ts`**) clasifica una señal EN VIVO contra las reglas `senal` que se le pasen (elevando p. ej. `ideacion_autolitica` → `urgencia`), o `contactar` como mínimo conservador si no hay reglas. Conserva `nivelMaximoRiesgo`.
- **`src/lib/escalado/acciones.ts`** — `aplicarEscalado(evaluacion, repo)`: al nivel > `normal`, crea `alertas` (motivo = nombre de la regla; evidencia = observaciones implicadas + últimos mensajes), sube `checkins.riesgo` (nunca baja) e inserta `eventos_auditoria` (RF-ES-06). **IDEMPOTENTE**: clave `checkin_id`+`regla_id`; no re-audita si no creó alertas. Trabaja contra un puerto `RepositorioAcciones` (testeable en memoria) + implementación con service-role.
- **`src/lib/escalado/textos.ts`** — textos al paciente centralizados (contactar / urgencia / vigilancia) con tono empático NO alarmista, marca `[PENDIENTE LEGAL]` donde toca, + instrucciones de tono por nivel para el modelo.
- **`src/lib/escalado/consultas.ts`** — `obtenerAlertas(filtros)` con RLS de profesional (cliente de servidor), listo para WP-06. Filtros validados con Zod.
- **`src/lib/escalado/README.md`** — documenta el formato completo de `condicion` y la aplicabilidad de reglas.
- **Integración** — `evaluarCheckin` + `aplicarEscalado` se ejecutan en `/api/checkin/finalizar` (antes del resumen, para que el cierre refleje el nivel definitivo). `/api/checkin/mensaje` carga las reglas `senal` y las pasa al loop para la clasificación en vivo.
- **UX paciente** — cierre con **tarjeta `contactar`** (botón `tel:` al `telefono_medico`) y **pantalla dedicada `urgencia`** (112 + médico, calmada, `[PENDIENTE LEGAL]`, sin diagnosticar). `vigilancia` sin fricción. Nuevo `/api/escalado/contacto` registra en auditoría si el paciente pulsa llamar (RF-ES-06).

---

## 2. Archivos

### Creados

- `src/lib/escalado/motor.ts`
- `src/lib/escalado/acciones.ts`
- `src/lib/escalado/textos.ts`
- `src/lib/escalado/consultas.ts`
- `src/lib/escalado/README.md`
- `src/lib/escalado/motor.test.ts` — 17 tests (5 escenarios semilla + no-disparo + vertical + idempotencia + E2E + señal en vivo + textos).
- `src/app/api/escalado/contacto/route.ts` — registra "pulsó llamar" (auth en el handler).
- `src/app/(paciente)/checkin/PantallaUrgencia.tsx` — pantalla dedicada de urgencia.
- `src/app/(paciente)/checkin/TarjetaContactar.tsx` — tarjeta de contactar en el cierre.
- `src/app/(paciente)/checkin/escaladoContacto.ts` — helper cliente best-effort para el registro.

### Modificados

- `src/lib/escalado/senales.ts` — el STUB pasa a motor real de señales (misma firma; añade campo opcional `reglas` a `EntradaSenal` y `codigo` a `ResultadoSenal`; el `mensajeParaModelo` sale de `textos.ts` por nivel).
- `src/lib/ia/loop.ts` — cambio ADITIVO: `contexto.reglasSenal?` opcional que se pasa a `evaluarSenal`. Sin `reglasSenal`, comportamiento idéntico a WP-02.
- `src/app/api/checkin/mensaje/route.ts` — carga `cargarReglasSenal(...)` (best-effort) y lo pasa en `contexto.reglasSenal`.
- `src/app/api/checkin/finalizar/route.ts` — ejecuta el escalado (best-effort) antes del resumen; el resumen y la respuesta usan `riesgoFinal`; devuelve `telefono_medico`.
- `src/app/(paciente)/checkin/ChatCheckin.tsx` — el cierre enruta a `PantallaUrgencia` (urgencia) o muestra `TarjetaContactar` (contactar); `RespuestaFinalizar` incluye `telefono_medico`.

### No tocados

`.env.example` ya contenía `SUPABASE_SERVICE_ROLE_KEY` (usada por el motor para leer reglas / crear alertas) y las de OpenAI; WP-04 no añade variables. Migraciones y tipos de WP-01 se usan tal cual (ver §3.8: **no** se requiere migración de reformateo). `docs/` no se tocó salvo este archivo.

---

## 3. Decisiones propias (no especificadas o ambiguas en el WP)

1. **Firma de `evaluarSenal` — discrepancia WP resuelta a favor del director.** El WP-04 escribe `evaluarSenal(checkinId, senal)` (2 args, sugiere async con IO), pero `docs/revisiones/WP-02-revision.md` ordena "mantener la firma que ya consume `loop.ts`" (`evaluarSenal(entrada): ResultadoSenal`, pura y síncrona). Son incompatibles al pie de la letra. **Resolución:** se mantiene la firma de `loop.ts` (instrucción explícita del director) y la evaluación "de reglas `senal` en vivo" se logra pasando esas reglas por `EntradaSenal.reglas` (campo opcional aditivo) desde el loop. Anotado como discrepancia del WP (no "arreglada"): ver §5.A.
2. **`reglasSenal` cableado por `contexto` del loop (aditivo).** Para no tocar la firma ni romper los tests de WP-02, `OpcionesTurno.contexto` gana `reglasSenal?` opcional. El test de WP-02 no lo pasa → `evaluarSenal` cae al mínimo conservador `contactar` (comportamiento idéntico). La ruta `/mensaje` sí lo carga.
3. **El motor usa service-role (admin) para leer reglas y crear alertas.** Por RLS de WP-01, el paciente **no** puede leer `reglas_escalado` ni insertar `alertas` ("la creación de alertas la hace el motor con service-role" — matriz WP-01). Por eso `evaluarCheckin`/`aplicarEscalado` usan el cliente admin (`import "server-only"`, cargado de forma diferida). La verificación de pertenencia del check-in ya la hizo `/finalizar` con la sesión del paciente antes de escalar.
4. **La ALERTA auditable se materializa al CIERRE, no dentro del loop.** La clasificación de la señal es en vivo (sube `checkins.riesgo` y ajusta el tono, vía el hook `registrarSenal` de WP-02, que también deja traza `senal_alarma`), pero la **alerta** para el profesional la crea `evaluarCheckin`+`acciones` al finalizar (idempotente), porque el loop es puro y escribe como el paciente (que por RLS no puede insertar alertas). `evaluarCheckin` lee las señales del check-in desde `eventos_auditoria` (accion `senal_alarma`), sin cambios de esquema.
5. **Escalado en `/finalizar` es best-effort y previo al resumen.** Se ejecuta antes de construir el resumen (para que este y el `riesgo` devuelto reflejen el nivel definitivo) y envuelto en try/catch: si falta el acceso de servicio o el proveedor, el check-in se cierra igual (no se tumba el cierre). Corre sobre las observaciones ya persistidas en vivo; las que añada la reconciliación posterior no se re-evalúan (ver §5.C).
6. **Idempotencia.** `aplicarEscalado` no duplica alertas de la misma regla (`checkin_id`+`regla_id`) ni añade auditoría si no creó ninguna alerta nueva; sube el riesgo solo si cambia. Esto también evita duplicar la alerta que el seed de WP-01 ya crea para Luis (regla "Fármaco crítico omitido").
7. **Agregación de series.** `adherencia_critica` y `tendencia` se calculan sobre ~30 días. Por día: `adherencia` marca "omitida" si alguna toma crítica ese día fue `omitida`; `tendencia` agrega el `valor_num` del día usando el mínimo para umbrales `lte` y el máximo para `gte`. Las rachas exigen días de **calendario consecutivos** (un hueco rompe la racha).
8. **`urgencia` como pantalla dedicada (componente), no ruta.** El cierre del check-in enruta a `PantallaUrgencia` en lugar de la pantalla de cierre normal: es una pantalla distinta e inequívoca sin cambiar el routing (menos superficie, misma UX). El check-in se cierra automáticamente con resumen (el `/finalizar` ya lo hace).
9. **`obtenerAlertas` en `consultas.ts`.** Módulo aparte para el helper de lectura (RLS de profesional), separado de `acciones.ts` (escritura). Decidido para no mezclar lectura/escritura.
10. **`normalizarCodigoSenal`.** El `tipo` de una señal (código libre del modelo) se normaliza a snake_case ascii antes de casar con las reglas `senal`, para robustez frente a variaciones de mayúsculas/espacios.

---

## 4. Cumplimiento de reglas de CLAUDE.md (verificable en revisión)

- **Ningún texto al paciente diagnostica ni alarma.** Todos los textos viven en `textos.ts`; un test (`textos al paciente — reglas clínicas`) verifica que no contienen diagnósticos ("infarto", "ictus"…) ni "puede ser un…", y que **distinguen** "señal" de "diagnóstico" ("no es un diagnóstico"). La pantalla de urgencia indica actuar ("es importante que te vea un médico ahora") sin nombrar causas. El texto de contactar usa el literal del WP ("no tiene por qué ser nada grave" — tranquilizador).
- **Motor DETERMINISTA (D8, sin ML).** Reglas explicables desde `reglas_escalado`; misma entrada → misma salida (probado en `evaluarReglas`).
- **TypeScript estricto sin `any`.** `grep` de `any` en `src/lib/escalado` y `src/app/api/escalado` → sin coincidencias.
- **Validación de entradas.** El JSONB de `condicion` se valida con Zod (`parsearCondicion`); los cuerpos de `/api/escalado/contacto` y los filtros de `obtenerAlertas` también.
- **Auth dentro de cada Route Handler (Next 16).** `/api/escalado/contacto` hace `getUser()` + verifica pertenencia del check-in; devuelve `{error}` con status apropiado sin filtrar internos.
- **RLS.** Lectura de alertas por RLS (profesional ve las de sus pacientes); escritura de alertas por service-role (el motor), como manda WP-01.
- **Secretos.** Nada hardcodeado; el service-role se lee en `admin.ts`.

---

## 5. Dudas / riesgos y notas sobre el WP (anotados, no "arreglados")

- **A. Discrepancia de firma en `evaluarSenal` (WP-04 vs. revisión WP-02).** El WP-04 documenta `evaluarSenal(checkinId, senal)`; la revisión WP-02 exige conservar la firma de `loop.ts`. Se resolvió a favor de la revisión (instrucción explícita del director). Si se prefiere la firma `(checkinId, senal)` con IO, habría que romper la pureza de `loop.ts` y sus tests. Lo dejo señalado.
- **B. `evaluarSenal` en vivo necesita acceso de servicio en la ruta de mensaje.** Como el paciente no puede leer `reglas_escalado`, `/mensaje` carga las reglas `senal` con el cliente admin (best-effort: si falta `SUPABASE_SERVICE_ROLE_KEY`, se cae a `contactar` sin romper la conversación). Añade una consulta admin por mensaje; aceptable en F1. Alternativa futura: cachear las reglas `senal` por vertical.
- **C. El escalado del cierre no re-evalúa las observaciones de la reconciliación.** Corre sobre las observaciones persistidas en vivo (deterministas, sin depender de OpenAI). Las que añada `reconciliar` después no disparan reglas en esta pasada. Es una limitación menor; si molesta, mover el escalado tras la reconciliación (que ya es best-effort) en un WP posterior.
- **D. RF-ES-05 (umbrales configurables por el profesional).** El motor ya lee reglas por paciente/vertical (`reglas_escalado`), y la RLS de WP-01 permite al profesional crear/editar reglas de sus pacientes. La **UI** de configuración no es de este WP (config del panel / WP-06). Solo lo apunto para que no se lea como omisión.
- **E. Notificación inmediata al profesional / contacto de confianza (RF-ES-03).** Fuera de alcance de WP-04 (push/email es WP-07). Aquí solo se crea la alerta en el dashboard; la notificación llega en WP-07.
- **F. `combinacion` admite `todas` y `alguna` a la vez.** El WP muestra solo uno por regla; mi evaluador soporta ambos (AND de ambos bloques) por generalidad. Las semillas usan solo `todas`.
- **G. Seed de Luis y la regla de adherencia.** El seed crea una alerta `contactar` (warfarina omitida 2 noches) para el check-in más reciente de Luis. Si se ejecuta `evaluarCheckin` sobre ese check-in, la idempotencia evita duplicarla (misma `regla_id`). Verificado por diseño (test de idempotencia con el mismo mecanismo).

---

## 6. Verificación (salida literal)

### `npm run lint` (exit 0)

```
> botsy@0.1.0 lint
> eslint

```

(Sin salida: ningún error ni warning. `EXIT_LINT=0`.)

### `npm test` (exit 0) — 25/25

```
 RUN  v3.2.7 C:/Users/PROPIETARIO/Desktop/projects/botsy

 ✓ src/lib/ia/checkin-texto.test.ts (8 tests) 22ms
 ✓ src/lib/escalado/motor.test.ts (17 tests) 35ms

 Test Files  2 passed (2)
      Tests  25 passed (25)
```

Los 17 tests de `motor.test.ts`:
- **5 escenarios semilla** (JSONB literal de `0003`): dolor torácico+disnea→`urgencia`; ideación autolítica→`urgencia`; dolor≥9→`contactar`; fármaco crítico omitido 2 días→`contactar`; ánimo≤3 durante 3 días→`vigilancia`.
- **No disparan:** dolor 8 (no ≥9); una sola omisión; ánimo bajo con hueco de días; **combinación con solo dolor torácico (sin disnea)**; regla de vertical cardiovascular sobre otra vertical.
- **Acciones:** E2E (alerta con evidencia + auditoría + riesgo `urgencia`); **idempotencia** (re-evaluar no duplica alerta ni auditoría); nivel normal no crea nada.
- **`evaluarSenal` en vivo:** señal que casa regla `urgencia` → `urgencia`; sin regla → `contactar`; sin reglas → `contactar`.
- **Textos:** sin diagnósticos/alarmismo; distinguen señal de diagnóstico.

### `npm run build` (exit 0)

```
> botsy@0.1.0 build
> next build

▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 11.1s
  Running TypeScript ...
  Finished TypeScript in 12.4s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (17/17) in 768ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /alertas
├ ƒ /api/checkin/finalizar
├ ƒ /api/checkin/iniciar
├ ƒ /api/checkin/mensaje
├ ƒ /api/escalado/contacto
├ ƒ /checkin
├ ƒ /configuracion
├ ƒ /consentimientos
├ ƒ /inicio
├ ƒ /login
├ ƒ /pacientes
├ ƒ /perfil
└ ○ /registro
```

Aparece la nueva ruta `/api/escalado/contacto` (dinámica, correcta para Route Handler con sesión).

---

## 7. Demostración de los escenarios (criterios de aceptación)

### 7.1 Con test (sin env) — `npm test`

- **Los 5 escenarios semilla + 1 combinación que NO dispara + idempotencia** → cubiertos en `motor.test.ts` (§6). El JSONB de las reglas se parsea con `parsearCondicion` a partir del literal de `0003`, de modo que el test queda atado al formato real de la semilla.
- **E2E (con mock/datos en memoria) dolor torácico + disnea → `urgencia`:** el test `aplicarEscalado — E2E` demuestra: `evaluarReglas` clasifica `urgencia`; `aplicarEscalado` sube `riesgoFinal` a `urgencia`, crea **1 alerta** con `motivo="Dolor torácico con disnea"` y evidencia que contiene `dolor_toracico`, `disnea` y el mensaje del paciente ("me falta el aire"), e inserta **1 evento de auditoría** con `nivel: urgencia`. La **pantalla de urgencia** es el componente `PantallaUrgencia` que `ChatCheckin` renderiza cuando `cierre.riesgo === "urgencia"` (112 + médico, calmada, `[PENDIENTE LEGAL]`, sin diagnosticar).

### 7.2 Guion E2E real (cuando haya Supabase + `SUPABASE_SERVICE_ROLE_KEY` + `OPENAI_API_KEY`)

1. `supabase db reset` (aplica `0001..0003` + `seed.sql`); `.env.local` con Supabase (incl. service-role) + OpenAI.
2. Login como `luis@botsy.local` / `Botsy1234!`. **Check-in** → escribir *"me duele el pecho y me falta el aire"*.
3. En vivo: el modelo llama `registrar_observacion(sintoma_fisico/dolor_toracico)` y `(…/disnea)` + `senal_alarma`; `evaluarSenal` (con reglas `senal` cargadas) fija el tono y `checkins.riesgo` sube (banner calmado).
4. **Terminar mi check-in** → `/finalizar` ejecuta `evaluarCheckin` (regla #1: combinación cardiovascular) + `aplicarEscalado`: `checkins.riesgo='urgencia'`, **alerta** `urgencia` con evidencia (observaciones + últimos mensajes), **evento_auditoria** `escalado`. La app muestra la **pantalla de urgencia**.
5. Pulsar "Llamar a Emergencias (112)" / "Llamar a mi médico" → `/api/escalado/contacto` deja traza en `eventos_auditoria` (RF-ES-06: qué hizo el paciente).
6. En el panel (WP-06), `obtenerAlertas({estado:'nueva'})` como `dra.garcia@botsy.local` devuelve la alerta (RLS restringe a sus pacientes).
