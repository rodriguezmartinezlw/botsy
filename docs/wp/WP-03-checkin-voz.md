# WP-03 — Check-in por VOZ (OpenAI Realtime, WebRTC)

**Depende de:** WP-02 · **Funcional:** v0.2 §2 (RF-CV-01/09) · **Decisión:** [ADR-001](../adr/ADR-001-api-de-voz.md)

## Objetivo

El mismo check-in de WP-02, hablado: OpenAI Realtime API por WebRTC con token efímero, reutilizando el builder de instrucciones y las tools de `src/lib/ia/conversacion.ts`. Grabación local del audio del paciente solo con consentimiento.

## Diseño

### Abstracción `src/lib/voz/`

- `types.ts` — interfaz `VoiceSession`: `conectar()`, `colgar()`, eventos (`onEstado` conectando|escuchando|hablando|cerrada, `onTranscripcion` parciales de usuario y asistente, `onToolCall`, `onError`). La UI SOLO depende de esta interfaz (ADR-001: portabilidad de proveedor).
- `openai-realtime.ts` — implementación: obtiene token efímero de nuestro backend, abre RTCPeerConnection (audio mic out, audio remoto in, data channel para eventos), envía/recibe eventos del protocolo Realtime, mapea tool-calls a `onToolCall` y devuelve resultados por el data channel.

### Backend

- `POST /api/voz/sesion` — sesión obligatoria (paciente). Crea/retoma el checkin de hoy con `canal='voz'`; construye instrucciones y tools con el builder de WP-02; pide a OpenAI el token efímero (modelo `OPENAI_REALTIME_MODEL`, voz en español, instrucciones incluidas server-side); devuelve `{token, checkinId, consentimientos}`. La API key real NUNCA viaja al cliente.
- `POST /api/voz/tool` — el cliente reenvía cada tool-call recibida por el data channel; el servidor la valida (Zod, mismos schemas de WP-02), la ejecuta (persistencia idéntica al modo texto) y devuelve el resultado que el cliente entrega al modelo. Verifica siempre que el checkin pertenece al usuario de la sesión.
- `POST /api/voz/finalizar` — igual que finalizar de WP-02 (resumen, rachas, reconciliación sobre el transcript acumulado) + si hay grabación: recibe el blob (o confirma subida) y guarda `audio_path`.
- Límite de coste: duración máxima de sesión 8 min (aviso del asistente a los 7, corte suave con cierre correcto). Configurable `VOZ_MAX_MINUTOS`.

### UI `(paciente)/checkin/voz`

- Pantalla de llamada: avatar/onda animada según estado (escuchando/hablando), subtítulos en vivo de ambas partes (RF-CV-09, activados por defecto), botón grande colgar, botón "prefiero escribir" → `/checkin` retomando el mismo checkin.
- Antes de conectar: comprobación de consentimiento `conversacion` (bloqueante) y `voz_grabacion` (si falta, se conversa igualmente pero SIN grabar).
- Grabación local con MediaRecorder (solo pista del micrófono) → al finalizar, subida a Storage `audios-checkin/{pacienteId}/{fecha}.webm`. Si falla la subida, no bloquea el cierre del check-in (reintento con aviso; el audio es secundario).
- Fallback: si `getUserMedia` o WebRTC fallan, mensaje claro y botón al modo texto.
- En `(paciente)/inicio` y `/checkin`, CTA para elegir "hablar" o "escribir".

## Fuera de alcance

Biomarcadores (F3 — solo se guarda el audio). Avatar con video (F4). Ajuste fino de turn-taking más allá de los defaults de la API.

## Criterios de aceptación

- Build + lint verdes.
- Con env configuradas: sesión de voz E2E en navegador (documenta la prueba manual: conectar, hablar 2-3 turnos, ver subtítulos, tool-calls persistidas, colgar → resumen y racha). Sin env: deja la prueba manual descrita y demuestra la parte servidor con mocks.
- El token efímero se genera server-side; ninguna clave en el bundle del cliente (verifica con `grep` del build).
- Sin consentimiento `voz_grabacion` no se instancia MediaRecorder (demostrable en código y en prueba).
- La UI no importa nada de `openai-realtime.ts` directamente, solo la interfaz `VoiceSession`.
