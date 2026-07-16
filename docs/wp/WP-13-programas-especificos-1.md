# WP-13 — Programas específicos I: post-cirugía y psicooncología (+ fotos clínicas)

**Depende de:** WP-11 · **Funcional:** RF-VD-04 (versión simple, sin análisis automático), ADR-002 (plantillas postcirugia y psicooncologia) · **Los umbrales clínicos de este WP son borrador: irán a validación clínica antes de pacientes reales.**

## Tareas

### 1. Programas por FASES (post-cirugía)

- Soporte de `config.fases` (ya tipado en WP-11): p. ej. postcirugia = fase 1 (días 1–7, check-in diario, dominios dolor/herida/fiebre/movilidad/adherencia) → fase 2 (días 8–30, alterno) → **alta automática**.
- `fecha_evento` (fecha de cirugía) ancla las fases; un job en el cierre del check-in (o el cron diario) avanza `fase_actual` y, al terminar, marca `programas_paciente.estado='completado'` y genera un **resumen final** para el profesional (evento en línea temporal + email sobrio reutilizando el módulo de WP-07/WP-10.5).
- El check-in adapta dominios y frecuencia por fase (vía `configEfectiva`).

### 2. Módulo fotos clínicas (flag `fotos`)

- **Consentimiento nuevo:** migración que amplía el check de `consentimientos.tipo` con `'fotos_clinicas'` (recuerda: nueva migración, jamás editar las commiteadas). Sin él, el módulo no captura (mismo patrón que `voz_grabacion` en WP-03).
- Captura dirigida en la app (cámara del móvil, guía de encuadre/iluminación — RF-VD-07 ligero), subida a bucket privado nuevo `fotos-clinicas` con path `{pacienteId}/{fecha}-{uuid}.jpg` y políticas de Storage espejo de `audios-checkin` (paciente sube a su carpeta; lee el profesional asignado/admin).
- Tabla `fotos_clinicas`: `paciente_id`, `checkin_id null`, `etiqueta` (p. ej. "herida abdominal"), `path`, `nota_paciente`. RLS estándar.
- Ficha 360º: **galería evolutiva** por etiqueta (línea de tiempo visual, RF-DB-05 versión F1) — el profesional compara la herida día a día.
- SIN análisis automático de imagen (eso es F4); Botsy solo registra.

### 3. Reglas de escalado nuevas (semilla por plantilla, claves usadas en `escalado.reglas_clave`)

- `postcirugia_fiebre` — observación `sintoma_fisico/fiebre` con `valor_num >= 38` → **contactar**.
- `postcirugia_herida_urgente` — combinación: fiebre ≥38 **y** (dolor creciente **o** `supuracion_herida`) → **urgencia** (texto al paciente: señal de la herida que debe verse HOY; jamás "infección" como diagnóstico).
- `oncologia_fiebre_tratamiento` — fiebre ≥38 con programa psicooncologia activo → **urgencia** (la fiebre en tratamiento activo es bandera roja; ante el paciente, solo "es importante que te vean hoy mismo").
- `oncologia_dolor_sostenido` — dolor ≥7 durante ≥2 días → contactar. `oncologia_distres` — ánimo ≤3 o ansiedad ≥8 sostenidos → contactar.
- El check-in de estos programas incluye `preguntas_extra` (¿te has tomado la temperatura?, náuseas, alimentación) y el LLM registra `fiebre` con `valor_num` en °C (ajustar rango del schema Zod de observaciones para el dominio `sintoma_fisico`/código `fiebre`: 34–43, sin romper el 0–10 del resto — documenta cómo).

### 4. Textos

- Nuevos textos de escalado específicos en `src/lib/escalado/textos.ts` (centralizados, no alarmistas, `[PENDIENTE LEGAL]` donde toque).

## Fuera de alcance

Análisis automático de imágenes (F4), rPPG, plantilla alzheimer (WP-14), validación clínica real de umbrales.

## Criterios de aceptación

- Build/lint/test verdes. Tests: avance de fases y alta automática (fechas simuladas); reglas nuevas disparan en el motor de WP-04 (fiebre 38.5 → contactar; fiebre+supuración → urgencia; 37.5 → nada); consentimiento `fotos_clinicas` bloqueante; escala de fiebre validada sin romper las escalas 0–10.
- Migraciones validadas con RLS incluida; bucket con políticas espejo verificadas en el test estático de la matriz.
- Demo documentada: asignar postcirugia con `fecha_evento` = hace 3 días → check-in de fase 1; foto subida con consentimiento → visible en la galería del profesional; reporte de fiebre 38.6 + supuración → pantalla de urgencia + alerta.
