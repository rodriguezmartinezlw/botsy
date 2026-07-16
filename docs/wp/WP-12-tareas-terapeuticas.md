# WP-12 — Tareas terapéuticas (TCC) + diario por voz

**Depende de:** WP-11 (módulos `tareas` y `diario` del programa) · **Perfil objetivo:** psicología TCC y psiquiatría (ADR-002) · **Regla de oro reforzada:** Botsy acompaña la tarea prescrita por el terapeuta; JAMÁS hace terapia por su cuenta ni interpreta clínicamente.

## Objetivo

El "cuaderno del paciente" hablado: el psicólogo prescribe tareas entre sesiones, el paciente las completa contándoselas a Botsy (voz o texto), y el terapeuta recibe los registros **estructurados** en su panel en lugar de un cuaderno de papel.

## Tareas

### 1. Migración: `tareas_terapeuticas` + `tareas_registros` + `diario_entradas`

- `tareas_terapeuticas`: `paciente_id FK`, `tipo check in ('registro_pensamientos','activacion_conductual','exposicion','experimento_conductual','psicoeducacion','personalizada')`, `titulo`, `instrucciones text` (las escribe el profesional), `frecuencia text` (diaria|semanal|puntual), `estado check in ('activa','completada','archivada')`, `creada_por FK`. RLS: paciente SELECT las suyas + UPDATE de estado propio limitado; profesional CRUD de sus pacientes; admin todo.
- `tareas_registros`: `tarea_id FK`, `paciente_id`, `fecha`, `completada bool`, `contenido jsonb` (estructura según tipo), `origen check in ('guiado','manual')`. Paciente INSERT/SELECT propio; profesional SELECT.
- `diario_entradas`: `paciente_id`, `canal voz|texto`, `transcript jsonb` (mensajes), `extraccion jsonb`, `resumen text`, `duracion_seg`, `audio_path null`. RLS igual que checkins.

### 2. Catálogo + prescripción (panel, pestaña "Tareas" de la ficha)

- Plantillas de tarea por tipo con campos prellenados editables (p. ej. registro de pensamientos: "Cuando notes un malestar intenso, cuéntaselo a Botsy siguiendo los pasos") + creación libre (`personalizada`).
- Vista de cumplimiento entre sesiones: por tarea, % completado y acceso a cada registro estructurado (tarjetas legibles, p. ej. columnas del registro ABC).

### 3. App del paciente: módulo "Mis tareas" (flag `tareas`)

- Lista de tareas activas con instrucciones del terapeuta, marcar como hecha (registro `manual`), y para `registro_pensamientos` un **flujo guiado conversacional** (botón "Contárselo a Botsy").

### 4. Flujo guiado del registro de pensamientos (el corazón)

- Reutiliza el patrón de WP-02 (builder + tools + Zod), con guion propio: situación → pensamiento automático → emoción e intensidad (0–10) → respuesta/pensamiento alternativo (si la tarea lo pide). Tono validante y neutro; **prohibido** reestructurar cognitivamente por su cuenta, diagnosticar o contradecir al terapeuta — Botsy pregunta y registra, la terapia la hace el profesional.
- Tool `registrar_paso_tarea(paso, contenido, intensidad?)` validada con Zod → `tareas_registros.contenido` estructurado `{situacion, pensamiento, emocion, intensidad, alternativa?}`.
- Disponible por voz (reutiliza `VoiceSession` de WP-03 con instrucciones de este flujo) y por texto.
- **El escalado en vivo sigue activo** (señales → `evaluarSenal`/alertas, igual que el check-in): si en un registro aparece ideación autolítica, se activa el protocolo de WP-04.

### 5. Diario libre "Cuéntale a Botsy" (flag `diario`)

- Sesión libre 24/7 separada del check-in (decisión confirmada 2026-07-16, ADR-002 §Decisiones): escucha activa, extracción ligera (ánimo, temas) a `diario_entradas.extraccion`, resumen breve. Escalado en vivo activo. Grabación de audio solo con consentimiento `voz_grabacion` (mismo patrón WP-03).
- El check-in del día siguiente puede referenciarlo con naturalidad (memoria longitudinal: incluir resúmenes de diario recientes en `construirContexto`).

### 6. Integración con el check-in

- Si el módulo `tareas` está activo y hay tareas pendientes hoy, el check-in pregunta por su cumplimiento (dominio `tareas` añadido a la checklist del programa) y registra `tareas_registros` básicos por tool.

## Fuera de alcance

Fotos (WP-13), cuidador (WP-14), contenido psicoeducativo multimedia (backlog), cualquier "consejo terapéutico" generado por el LLM.

## Criterios de aceptación

- Build/lint/test verdes. Tests con mock: flujo guiado completo persiste un registro ABC estructurado y validado; un paso inválido no se persiste; señal de alarma en el diario → alerta creada (idempotente); RLS de las 3 tablas en la migración; profesional ve registros de SUS pacientes solamente.
- Textos del flujo revisados contra las reglas clínicas (sin interpretación, sin diagnóstico, validante).
- Demo documentada: prescribir "registro de pensamientos" a Luis → completarlo por texto (mock) → verlo estructurado en el panel.
