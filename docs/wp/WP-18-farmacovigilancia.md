# WP-18 — Farmacovigilancia mínima viable

**⛔ PUERTA: primera LOI/contrato farma** (MEMORIA §8.1 módulo 5, §8.3). El formato exacto del paquete exportable se ajusta al contrato del laboratorio — por eso NO se construye antes. Se enseña en el deck desde ya (es condición de entrada de todo contrato farma). Spec base: PLAN-TECNICO-PILOTO §5 WP-18.

## Objetivo

Detección de posibles eventos adversos (EA) → cola de revisión humana → paquete de reporte exportable con acuse y auditoría, con **reloj SLA de 24h**. El LLM solo PRE-señala candidatos; la confirmación es SIEMPRE humana (regla de oro 4).

## Tareas

1. **Migración (siguiente número):** tabla `eventos_adversos`: `paciente_id FK`, `origen_checkin_id FK null`, `origen_observacion_id FK null`, `farmaco_sospechoso uuid FK pautas_medicacion null`, `descripcion text`, `gravedad check in ('no_grave','grave')`, `estado check in ('detectado','en_revision','confirmado','descartado','exportado','acusado')`, `detectado_en timestamptz`, `sla_vence_en timestamptz` (= detectado_en + interval '24 hours'), `revisado_por FK`, `motivo_descarte text`, `paquete jsonb`, `exportado_en`, `acuse jsonb`. RLS en la misma migración (profesional designado de sus pacientes; admin; paciente NO lee esta tabla).
2. **Detección determinista** (`src/lib/farmacovigilancia/deteccion.ts`): al cierre del check-in (mismo punto que el escalado), si hay observaciones de síntoma con `confianza` suficiente Y el paciente tiene pautas activas, crear `eventos_adversos` en estado `detectado` cuando el par (síntoma, fármaco) case con una lista configurable de asociaciones candidatas (constantes `[PENDIENTE CLÍNICO]`; ejemplos iniciales: diarrea/vómitos/reacción cutánea/fiebre con cualquier oral activa). Idempotente por (checkin, síntoma, fármaco). SIN LLM decisor.
3. **Cola de revisión** en el panel (`(panel)/farmacovigilancia`): lista por SLA ascendente con reloj visible (verde >12h, ámbar 4–12h, rojo <4h/vencido), acciones confirmar (gravedad + nota) / descartar (motivo obligatorio, mismo patrón que disposiciones). Badge en sidebar. Todo auditado.
4. **Paquete exportable** al confirmar: JSON + vista imprimible con los campos mínimos de un ICSR simplificado — paciente PSEUDONIMIZADO (id truncado, edad, sexo), fármaco (nombre/dosis), evento (código CTCAE + descripción), fechas (inicio, detección, confirmación), desenlace si consta, reportador (profesional). El formato FINAL se ajusta al contrato → deja el generador parametrizable (plantilla por patrocinador).
5. **Acuse y estados:** marcar `exportado` (con `exportado_en` y copia del paquete) y `acusado` (con `acuse` jsonb: quién/cuándo). Email de aviso al profesional designado cuando un SLA está por vencer (reutiliza Resend, best-effort).
6. **Deck/demo:** una captura de la cola con datos del seed (añadir 2 EA demo al seed) para enseñar el módulo antes de construir el formato final.

## Criterios de aceptación

- Build/lint/test verdes (sin romper los existentes; tests de: detección determinista idempotente, SLA calculado, confirmar exige gravedad, descartar exige motivo, paquete pseudonimizado sin identificadores directos, RLS).
- Ningún dato identificable del paciente en el paquete (test tipo el de k-anonimato).
- Migración validada; textos sin lenguaje diagnóstico hacia el paciente (este módulo es solo del panel).
