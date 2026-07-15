# WP-02 — Motor conversacional + check-in por TEXTO

**Depende de:** WP-01 · **Desbloquea:** WP-03, WP-04 · **Funcional:** v0.2 §2.2, §2.3 (RF-CV-02/03/04/05/08)

## Objetivo

El corazón de Botsy: la conversación diaria que completa la ficha del paciente, en su transporte de texto. Toda la lógica conversacional se escribe UNA vez (`src/lib/ia/`) para que WP-03 la reutilice en voz sin duplicar.

## Diseño

### `src/lib/ia/conversacion.ts` — builder compartido

- `DOMINIOS_CHECKIN`: lista tipada — `adherencia`, `dolor`, `sintomas_fisicos`, `animo` (incluye ansiedad/estrés/sueño), `cognicion`, `tratamiento`, `habitos`.
- `construirContexto(pacienteId)`: lee de Supabase (servidor) nombre, edad, vertical, condiciones, pautas activas de HOY con sus momentos, resumen del último check-in y observaciones destacadas de los últimos 7 días (memoria longitudinal RF-CV-05), y dominios ya cubiertos del check-in de hoy si existe.
- `construirInstrucciones(contexto)`: system prompt en español que implementa el flujo §2.2: apertura personalizada, escucha abierta, recorrido SOLO por dominios pendientes, repreguntas si hay ambigüedad clínica, tono cálido y sencillo (paciente puede ser mayor), frases cortas. Prohibiciones explícitas: no diagnosticar, no recomendar fármacos ni dosis, no minimizar síntomas de alarma; ante dudas médicas que exceden el registro → "eso debes consultarlo con tu médico" (RF-CV-08). Cierre: resumen de avances + racha.
- `TOOLS_CHECKIN` (definición neutra, mapeable a function calling de Chat Completions Y de Realtime):
  - `registrar_observacion(dominio, codigo, valor_num?, valor_texto?, confianza)`
  - `registrar_toma(pauta_id, momento, estado)`
  - `marcar_dominio_cubierto(dominio)`
  - `senal_alarma(tipo, descripcion, evidencia_textual)` — F1: persiste la señal en el checkin y devuelve al modelo la instrucción de mantener calma y sugerir contacto con el médico; el motor completo llega en WP-04, deja el punto de integración claro (función `evaluarSenal` stub exportada desde `src/lib/escalado/`)
  - `finalizar_checkin(resumen)`
- Todos los argumentos de tools se validan con Zod (`src/lib/ia/schemas.ts`); si no validan, se responde al modelo con el error para que corrija, y NUNCA se persiste.

### API + UI

- `POST /api/checkin/iniciar` — crea (o retoma) el checkin de hoy `canal=texto`, devuelve id + primer mensaje del asistente. Sesión obligatoria (rol paciente).
- `POST /api/checkin/mensaje` — recibe `{checkinId, texto}`; añade mensaje del paciente; llama a OpenAI (`OPENAI_TEXT_MODEL`) con instrucciones + historial + tools; ejecuta el loop de tool-calls (persistiendo observaciones/tomas/dominios); devuelve la respuesta del asistente (streaming SSE si es razonable; si no, respuesta completa — decisión tuya, documéntala).
- `POST /api/checkin/finalizar` — cierra: estado `completado`, resumen, duración, actualiza rachas del paciente (racha_actual/racha_maxima/ultimo_checkin con lógica de días consecutivos), y llama a `reconciliar(checkinId)`.
- `src/lib/ia/extraccion.ts` — `reconciliar(checkinId)`: segunda pasada sobre el transcript completo con salida estructurada (Zod) que extrae observaciones que el flujo en vivo no registró; inserta con `origen='reconciliacion'` sin duplicar códigos ya presentes.
- UI `(paciente)/checkin`: chat móvil-first (burbujas, input fijo abajo, indicador "Botsy está escribiendo…", auto-scroll), checklist visual de dominios (chips que se van marcando), pantalla de cierre con resumen + racha (confeti sobrio) y "recomendación del día" (F1: texto estático por vertical desde un array local, marcado `TODO F2: motor de recomendaciones`).
- `(paciente)/inicio`: saludo, estado del check-in de hoy (pendiente/completado), racha actual, CTA grande "Hacer mi check-in".

## Fuera de alcance

Voz (WP-03). Motor de reglas de escalado completo (WP-04 — aquí solo el stub de `senal_alarma`). Gráficos del perfil (WP-05).

## Criterios de aceptación

- Build + lint verdes.
- Con env de OpenAI y Supabase configuradas: conversación E2E demostrada (guion de prueba en la entrega: saludo → paciente menciona espontáneamente dolor 4/10 y que tomó la aspirina → el asistente NO repregunta por eso, sí por lo pendiente → finaliza) con filas resultantes en `checkins`, `mensajes`, `observaciones`, `tomas_medicacion` y racha actualizada. Si no hay env disponibles, deja el guion listo y demuéstralo con un mock del cliente OpenAI inyectable + un test que ejecute el loop de tools.
- `senal_alarma` con "me duele el pecho y me falta el aire" → checkin marcado `riesgo='contactar'` como mínimo y respuesta del asistente calmada sugiriendo contactar al médico.
- Cero `any`; todos los argumentos de tools validados con Zod.
