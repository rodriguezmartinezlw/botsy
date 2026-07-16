# WP-14 — Programa Alzheimer: modo voz-solo accesible + rol cuidador (v1)

> ⛔ **APARCADO (2026-07-16, ADR-003 / MEMORIA-PROYECTO §8.2).** No implementar: el foco es la fase piloto oncológica (PLAN-TECNICO-PILOTO.md). Este WP se despierta solo si su puerta comercial/clínica se abre. El diseño sigue siendo válido como referencia.

**Depende de:** WP-11 (y WP-13 para el patrón de reglas nuevas) · **Funcional:** RF-CV-09, ADR-002 (plantilla alzheimer; decisión confirmada 2026-07-16: cuidador v1 SIN cuenta) · **Perfil:** salud geriátrica / deterioro cognitivo.

## Objetivo

Que una persona con deterioro cognitivo pueda usar Botsy sola ("hablar" y nada más), y que su cuidador y su profesional se enteren de lo que importa.

## Tareas

### 1. Modo voz-solo (cuando el programa desactiva `texto`)

- Inicio del paciente reducido a **UN botón grande** "Hablar con Botsy" (más racha en lenguaje simple). Sin chat de texto, sin navegación compleja: perfil y consentimientos accesibles pero secundarios.
- Tipografía ampliada (≥20px base en este modo), contraste alto, cero jerga. `perfil_graficos` de la plantilla reducido (p. ej. solo adherencia y dolor).
- Estilo conversacional del programa: ritmo lento, frases muy cortas, UNA pregunta clarísima por turno, repetición paciente si no se entiende (ya soportado por `estilo` de WP-11 — aquí se ajusta el texto de instrucciones y se verifica con tests de `construirInstrucciones`).
- Cognición: preguntas ligeras integradas con naturalidad ("¿qué has desayunado hoy?"), NUNCA formato test/interrogatorio. Registra `cognicion` con confianza baja; la señal fuerte llegará con biomarcadores (F3).
- Gate server-side (de WP-11): `/checkin` texto → redirección a voz; si el navegador no soporta voz, mensaje amable con indicación de pedir ayuda al cuidador (no dejar al paciente en un callejón).

### 2. Cuidador v1 (sin cuenta propia)

- Migración: en `pacientes` → `cuidador_nombre text`, `cuidador_telefono text`, `cuidador_email text`; y tipo de consentimiento nuevo `'aviso_cuidador'` (consentimiento del paciente/representante, texto `[PENDIENTE LEGAL]`). Sin este consentimiento, NO se envía nada al cuidador.
- El profesional configura el cuidador en la ficha 360º (pestaña Programa o datos del paciente; auditado).
- Con consentimiento activo, el cuidador recibe por email (Resend, módulo de WP-07):
  - Recordatorio si el paciente no hizo el check-in (mismo cron; plantilla propia, sobria).
  - Aviso en alertas `contactar`/`urgencia` (además del profesional): sin contenido clínico detallado — "Botsy ha detectado algo que conviene atender; llama a X / a su médico". Auditado, sin duplicar.
- **Fuera de v1:** cuenta del cuidador con acceso, confirmación de tomas por enlace firmado (documentar como v2 en la entrega).

### 3. Reglas de plantilla alzheimer

- `alzheimer_desorientacion` — señal/observación `cognicion/desorientacion_aguda` → contactar. `alzheimer_caida` — `sintoma_fisico/caida` → contactar. `alzheimer_agitacion` — señal `agitacion_severa` → contactar. (Urgencia queda en manos de las reglas globales ya existentes.)

## Fuera de alcance

Cuenta de cuidador (v2), geoposición/dispositivo (F-futuro con app nativa), biomarcadores (F3), teleasistencia.

## Criterios de aceptación

- Build/lint/test verdes. Tests: gating voz-solo (ruta de texto redirige server-side), instrucciones generadas con estilo lento/frases cortas verificadas, emails de cuidador SOLO con consentimiento `aviso_cuidador` (sin él, ni recordatorio ni alerta), no-duplicación de avisos, reglas nuevas disparan.
- Textos al cuidador revisados: sobrios, sin datos clínicos sensibles, sin alarmismo.
- Demo documentada: Carmen con programa alzheimer + cuidador configurado → check-in solo por voz con guion simple; alerta `contactar` → email al cuidador y al profesional, auditados.
