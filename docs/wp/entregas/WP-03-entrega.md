# Entrega WP-03 — Check-in por VOZ (OpenAI Realtime, WebRTC)

**Fecha:** 2026-07-15 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde (32/32 tests; 25 de WP-02/WP-04 intactos + 7 nuevos). Sin `OPENAI_API_KEY`, sin proyecto Supabase remoto y sin navegador/micrófono en el entorno: la parte servidor se prueba con dobles en memoria y la parte navegador queda cableada y documentada para el E2E manual con env.

El check-in por voz reutiliza TODO el motor conversacional de WP-02 (builder de instrucciones, tools neutras, loop de tool-calls con validación Zod, repositorio de Supabase) y la materialización de escalado de WP-04, sin duplicar esa lógica: solo añade el **transporte de voz** (Realtime/WebRTC tras la interfaz `VoiceSession`) y el cierre compartido con audio.

---

## 1. Qué se hizo

### Abstracción de voz (`src/lib/voz/`)
- **`types.ts`** — interfaz `VoiceSession` (`conectar`, `colgar`, `solicitarDespedida?` opcional) + tipos de eventos (`onEstado`, `onTranscripcion`, `onToolCall`, `onError`) y `OpcionesSesionVoz`. Módulo PURO de tipos (no importa ninguna implementación). **Es la única superficie de la que depende la UI** (ADR-001).
- **`openai-realtime.ts`** — implementación WebRTC: recibe un **token efímero** (emitido por nuestro backend), abre `RTCPeerConnection` (pista de micrófono saliente, audio remoto entrante en un `<audio>` oculto, data channel `oai-events`), intercambia SDP con el endpoint Realtime usando ese token efímero, y mapea los eventos del protocolo a los manejadores. Cuando el modelo emite una tool, la entrega a `onToolCall`, espera el resultado y lo devuelve por el data channel (`function_call_output` + `response.create`). Solo usa APIs de navegador dentro de funciones (nada en el nivel de módulo).
- **`index.ts`** — seam de la fábrica: re-exporta la interfaz + `crearSesionVoz` (apuntando a la impl de OpenAI). **La UI importa solo `@/lib/voz`, nunca `openai-realtime.ts`**; cambiar de proveedor es reapuntar esta fábrica.

### Backend
- **`POST /api/voz/sesion`** — auth (paciente), consentimiento `conversacion` **bloqueante** (defensa en profundidad), crea/retoma el check-in de HOY con `canal='voz'`, construye instrucciones + tools con el builder de WP-02 (`construirInstrucciones` + `toolsParaRealtime`), pide a OpenAI el **token efímero** (modelo `OPENAI_REALTIME_MODEL`, voz `OPENAI_REALTIME_VOICE`, transcripción de entrada e instrucciones server-side) y devuelve `{token, modelo, checkinId, pacienteId, fecha, maxMinutos, consentimientos}`. **La API key real jamás sale del servidor.**
- **`POST /api/voz/tool`** — reenvía cada tool-call del data channel; valida la envoltura con Zod, verifica **pertenencia** del check-in al usuario y ejecuta la tool con `ejecutarHerramienta` (los **mismos schemas Zod y la misma persistencia** que el modo texto, vía `crearRepositorioSupabase`). Si el turno sube el riesgo a `contactar`/`urgencia`, **materializa el escalado de inmediato** (misma maquinaria idempotente `evaluarCheckin` + `aplicarEscalado` que `/api/checkin/mensaje`). Devuelve `{output, riesgo, dominiosCubiertos, finalizar}`.
- **`POST /api/voz/finalizar`** — cierra reutilizando la **misma lógica** que el modo texto (`finalizarCheckin`: escalado determinista, resumen, duración, rachas, reconciliación) + persiste `audio_path` si el cliente subió el audio.
- **Límite de coste** — `VOZ_MAX_MINUTOS` (defecto 8, añadida a `.env.example`): el cliente avisa a 1 minuto del final (banner + `solicitarDespedida()` para que Botsy se despida) y hace **corte suave** (cuelga + finaliza correctamente) al llegar al límite.

### UI `(paciente)/checkin/voz`
- **`page.tsx`** (Server Component) — resuelve vertical + estado vigente de consentimientos y delega en el cliente.
- **`PantallaVoz.tsx`** (`"use client"`) — pantalla de llamada: pulso/onda por estado (escuchando/hablando), **subtítulos en vivo de ambas partes activados por defecto** (RF-CV-09, con toggle), checklist de dominios, botón grande **Colgar y terminar**, y botón **Prefiero escribir** → `/checkin` (retomando el MISMO check-in). Antes de conectar comprueba `conversacion` (bloqueante, con enlace a `/consentimientos`). Grabación local con **`MediaRecorder` SOLO si hay consentimiento `voz_grabacion`** → sube a Storage `audios-checkin/{pacienteId}/{fecha}.webm`; si la subida falla, no bloquea el cierre. **Fallback claro** si `getUserMedia`/WebRTC/el servicio de voz fallan (mensaje + botón al modo texto).
- **CTA hablar/escribir** — en `(paciente)/inicio` (botones "Hablar con Botsy" / "Prefiero escribir") y en `/checkin` (enlace "Prefiero hablar").

### Reutilización sin duplicar
- `src/lib/ia/loop.ts` — se **exporta** `ejecutarHerramienta` (+ `ResultadoHerramienta`), antes privada, para que la voz ejecute cada tool con la MISMA función (mismos schemas, misma `evaluarSenal`). Cambio aditivo; el loop de texto no cambia.
- `src/lib/ia/finalizar.ts` (nuevo) — se **extrae** la lógica de cierre desde `/api/checkin/finalizar` a `finalizarCheckin(supabase, userId, checkinId, {audioPath?})`. `/api/checkin/finalizar` pasa a delegar en ella (respuesta **byte a byte idéntica**) y `/api/voz/finalizar` la reutiliza con `audioPath`.
- `src/lib/ia/voz-tool.ts` (nuevo) — `manejarToolVoz(entrada, puerto)`: orquesta pertenencia → validación/ejecución (`ejecutarHerramienta`) → escalado inmediato, con todo el IO tras el puerto `PuertoToolVoz` (Supabase en producción, dobles en test).

---

## 2. Archivos

### Creados
- `src/lib/voz/types.ts` — interfaz `VoiceSession` + tipos de eventos (la UI depende solo de esto).
- `src/lib/voz/openai-realtime.ts` — implementación WebRTC (token efímero + RTCPeerConnection + data channel).
- `src/lib/voz/index.ts` — fábrica `crearSesionVoz` (seam de proveedor).
- `src/lib/ia/realtime.ts` — emisión SERVER-SIDE del token efímero (`crearSesionRealtime`), `modeloRealtime()`, `vozRealtime()`, `maxMinutosVoz()`. Única pieza que toca `OPENAI_API_KEY` para voz (en `src/lib/ia/` como exige CLAUDE.md).
- `src/lib/ia/voz-tool.ts` — `manejarToolVoz` + puerto `PuertoToolVoz` (reusa `ejecutarHerramienta`).
- `src/lib/ia/finalizar.ts` — `finalizarCheckin` (cierre compartido texto/voz).
- `src/lib/ia/voz-tool.test.ts` — 7 tests (pertenencia 404/409, validación Zod persiste/descarta, toma válida, escalado inmediato contactar/urgencia).
- `src/app/api/voz/sesion/route.ts`, `src/app/api/voz/tool/route.ts`, `src/app/api/voz/finalizar/route.ts`.
- `src/app/(paciente)/checkin/voz/page.tsx`, `src/app/(paciente)/checkin/voz/PantallaVoz.tsx`.

### Modificados
- `src/lib/ia/loop.ts` — export ADITIVO de `ejecutarHerramienta` + `ResultadoHerramienta` (loop de texto sin cambios de comportamiento).
- `src/lib/ia/schemas.ts` — `esquemaCuerpoToolVoz` y `esquemaCuerpoFinalizarVoz` (+ tipos).
- `src/app/api/checkin/finalizar/route.ts` — ahora delega en `finalizarCheckin` (misma respuesta y códigos de estado).
- `src/app/(paciente)/inicio/page.tsx` y `src/app/(paciente)/checkin/page.tsx` — CTA hablar/escribir.
- `.env.example` — `OPENAI_REALTIME_VOICE` y `VOZ_MAX_MINUTOS`.

---

## 3. Decisiones propias (no estaban explícitas en el WP)

1. **Emisión del token en `src/lib/ia/realtime.ts` (server), recepción en `openai-realtime.ts` (cliente).** El WP describe `openai-realtime.ts` como "obtiene token efímero de nuestro backend"; lo implementé recibiéndolo por constructor (la UI llama a `/api/voz/sesion` y se lo pasa). Así la clave real vive solo en `src/lib/ia/` (regla CLAUDE.md) y el módulo de navegador nunca conoce ni la clave ni el endpoint de emisión.
2. **Seam de fábrica (`crearSesionVoz`) en `index.ts`.** La UI depende de la interfaz `VoiceSession` y de una fábrica; nunca nombra la clase concreta ni importa `openai-realtime.ts`. Es dependency-inversion estándar y cumple el criterio de portabilidad de ADR-001 de forma verificable por grep.
3. **Extracción de `finalizarCheckin` compartido** en lugar de duplicar ~130 líneas en `/api/voz/finalizar`. Cumple "reúsala sin duplicarla". `/api/checkin/finalizar` conserva su respuesta y códigos de estado exactos.
4. **El audio lo sube el cliente a Storage** (con la sesión del paciente y la RLS `audios_insert_paciente` de WP-01), y `/api/voz/finalizar` solo recibe/persiste la ruta (`{checkinId, audioPath?}`). Evita proxyar blobs grandes por el route de Node y respeta la RLS con el rol del propio paciente. `audioPath` se acepta solo si empieza por `{userId}/` (defensa en profundidad).
5. **Aviso verbal de fin de sesión** vía método OPCIONAL `solicitarDespedida()` en la interfaz (envía `response.create` con instrucción de despedida). Mantiene la interfaz mínima y portable; el corte duro lo garantiza un temporizador de UI.
6. **Voz TTS configurable** (`OPENAI_REALTIME_VOICE`, defecto `alloy`). El idioma es-ES lo fijan las instrucciones (una sola lógica de conversación); la voz solo elige timbre.
7. **Materialización de escalado por tool-call** (no por turno): en voz cada tool-call es una petición HTTP independiente, así que se evalúa tras la que sube el riesgo. Es idempotente (dedupe por `checkin`+`regla`), así que no duplica alertas.

---

## 4. Dudas / riesgos detectados

- **Volatilidad de la API Realtime (requiere validación en E2E con env).** Los nombres exactos de eventos del data channel, el endpoint de emisión de token (`/v1/realtime/client_secrets`), el endpoint de intercambio SDP (`/v1/realtime/calls`), el nombre del modelo de transcripción (`gpt-4o-mini-transcribe`) y el formato de `turn_detection` pueden diferir de la versión vigente de OpenAI. El código es **tolerante** (manejo de eventos por prefijos, extracción de token `value`/`client_secret.value`) y no se ejercita en build/test (es fetch en tiempo de petición/navegador), pero debe verificarse en la prueba manual. Ninguno de estos detalles afecta a los contratos internos ni a la seguridad.
- **Nombre de la voz.** `alloy` es un valor seguro; si `OPENAI_REALTIME_MODEL` sube al flagship conviene revisar el catálogo de voces disponibles.
- **Sin regresión de contratos:** no detecté errores en el WP-03 ni en el plan. La única fricción es la volatilidad externa anterior, ya prevista por el propio WP ("ajuste de turn-taking más allá de los defaults" queda fuera de alcance).

---

## 5. Verificación

### 5.1 build / lint / test (salida literal)

```
$ npm run test
 ✓ src/lib/ia/voz-tool.test.ts (7 tests)
 ✓ src/lib/escalado/motor.test.ts (17 tests)
 ✓ src/lib/ia/checkin-texto.test.ts (8 tests)
 Test Files  3 passed (3)
      Tests  32 passed (32)

$ npm run lint
> botsy@0.1.0 lint
> eslint
(sin errores ni warnings)

$ npm run build
✓ Generating static pages using 3 workers (21/21)
Route (app)
 ├ ƒ /api/voz/finalizar
 ├ ƒ /api/voz/sesion
 ├ ƒ /api/voz/tool
 ├ ƒ /checkin/voz
 ...
(build correcto)
```

### 5.2 La clave de OpenAI no se filtra al cliente

```
$ grep -rIl "OPENAI_API_KEY" .next/server | wc -l   → 8   (solo servidor)
$ grep -rIl "OPENAI_API_KEY" .next/static | wc -l   → 0   (NADA en el bundle de cliente)
$ grep -rIoE "sk-[A-Za-z0-9]{10,}" .next/static     → (vacío)
$ grep -rIl "SUPABASE_SERVICE_ROLE_KEY" .next/static → (vacío)
$ grep -rIl "RTCPeerConnection" .next/static        → sí (la impl WebRTC SÍ se bundlea en cliente,
                                                        y usa solo el token efímero de /api/voz/sesion)
```
El cliente contiene la lógica WebRTC pero **cero** referencias a la API key: solo maneja el token efímero de corta vida que emite el backend.

### 5.3 La UI depende solo de la interfaz `VoiceSession`

```
$ grep -rn "openai-realtime" src/app     → (vacío)  # la UI NO importa la impl
$ grep -rn "openai-realtime" src         → solo src/lib/voz/index.ts (la fábrica)
```
`PantallaVoz.tsx` importa `crearSesionVoz` y los tipos desde `@/lib/voz`; nunca nombra la clase concreta.

### 5.4 `MediaRecorder` solo con consentimiento `voz_grabacion`
En `PantallaVoz.tsx`, `new MediaRecorder(...)` está dentro de `if (datos.consentimientos.voz_grabacion) { ... }`. Sin ese consentimiento no se instancia grabadora (y `/api/voz/sesion` devuelve el estado real del consentimiento, no la preferencia del cliente).

### 5.5 Prueba manual E2E (para cuando haya env) — pendiente de ejecutar
Requiere `OPENAI_API_KEY`, proyecto Supabase con las migraciones de WP-01 y un navegador con micrófono (HTTPS o `localhost`).
1. `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, `VOZ_MAX_MINUTOS`.
2. `npm run dev`, entrar como paciente. En `/consentimientos` otorgar `conversacion` (y opcionalmente `voz_grabacion`).
3. Inicio → **Hablar con Botsy** → **Empezar a hablar**. Aceptar el permiso de micrófono.
4. Conversar 2-3 turnos: verificar subtítulos en vivo de ambas partes, que Botsy no repite dominios ya cubiertos, y que un síntoma de alarma (p. ej. dolor torácico + disnea en vertical cardiovascular) marca el aviso y crea alerta (revisar `alertas` en el panel/BD → escalado inmediato).
5. **Colgar y terminar** → ver resumen + racha; con `voz_grabacion`, confirmar el objeto en Storage `audios-checkin/{pacienteId}/{fecha}.webm` y `checkins.audio_path` poblado.
6. Verificar **Prefiero escribir** → `/checkin` retoma el mismo check-in del día.
7. Fallbacks: denegar el micrófono → mensaje claro + botón a texto; sin `conversacion` → pantalla bloqueante con enlace a permisos.
8. Confirmar el corte suave: con `VOZ_MAX_MINUTOS=1`, aviso ~0 min y cierre correcto al minuto.

---

## 6. Cumplimiento de reglas de CLAUDE.md
- Token efímero **server-side**; `OPENAI_API_KEY` nunca en el bundle de cliente (§5.2). La UI depende solo de `VoiceSession` (§5.3). Sin `voz_grabacion` no hay `MediaRecorder` (§5.4). Auth y pertenencia **dentro de cada Route Handler** (Next 16). TypeScript estricto sin `any` (build + lint verdes). Mismas instrucciones clínicas que el texto (una sola lógica de conversación); Botsy no diagnostica: las pantallas de riesgo distinguen "señal" de "diagnóstico" (reutilizan `PantallaUrgencia`/`TarjetaContactar` de WP-04). Modelos y límites por env; `.env.example` actualizado. NO se hizo commit ni push; solo se tocó `docs/` para este archivo de entrega.
