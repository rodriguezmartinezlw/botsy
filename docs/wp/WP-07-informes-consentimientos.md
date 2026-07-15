# WP-07 — Informes imprimibles + recordatorios + consentimientos completos

**Depende de:** WP-05, WP-06 · **Funcional:** RF-DB-06, RF-CV-07, RF-VZ-05 (parte F1)

## Objetivo

Cerrar los flujos de salida (informe para el profesional), retención (recordatorio diario de check-in) y cumplimiento (gestión completa de consentimientos).

## Tareas

### 1. Informe por paciente (RF-DB-06, versión F1)

- `(panel)/pacientes/[id]/informe?desde&hasta` — vista optimizada para imprimir/PDF (estilo `@media print`, como los `/print` de otros proyectos de la casa): cabecera con logo Botsy + datos del paciente + período; resumen ejecutivo generado por LLM (`OPENAI_TEXT_MODEL`, prompt que SOLO resume datos existentes, sin inventar ni diagnosticar, con la cifra exacta de cada afirmación); tablas/gráficos de dolor, ánimo, adherencia por fármaco; lista de alertas del período y su resolución; observaciones destacadas. Pie: "Documento de seguimiento generado por Botsy. No constituye diagnóstico." + fecha de generación.
- Selector de período con presets (últimos 7/30/90 días) y botón Imprimir.
- El resumen LLM se persiste (tabla nueva `informes` con migración: paciente, período, resumen, generado_por) para trazabilidad; si OpenAI falla, el informe sale sin resumen ejecutivo con aviso.

### 2. Recordatorio de check-in (RF-CV-07, versión ligera F1)

- `GET /api/cron/recordatorios` protegido por `CRON_SECRET` (cabecera `Authorization: Bearer`): busca pacientes sin check-in hoy cuya `hora_checkin` ya pasó y envía recordatorio por email (Resend, `RESEND_API_KEY`; plantilla cálida en español con enlace al check-in). Registra envío en `eventos_auditoria` y no reenvía si ya se envió hoy (tabla o consulta a auditoría).
- `vercel.json` con el cron (cada hora en franja 8–21 Europe/Madrid). Deja documentado en la entrega que el push web/nativo llega en F2.

### 3. Consentimientos completos

- Mejora `(paciente)/consentimientos` (versión mínima de WP-01): texto completo por tipo (placeholder `[PENDIENTE LEGAL]` v0-borrador con estructura real: responsable, finalidad, revocación), historial de cambios visible, revocación con confirmación y efecto inmediato (sin `voz_grabacion` → WP-03 deja de grabar: verifica la integración).
- Primer login de paciente: interstitial obligatorio que pide el consentimiento `conversacion` antes de permitir check-ins (sin él, la app muestra el porqué y no permite conversar).
- El profesional ve el estado de consentimientos del paciente en la ficha 360º (solo lectura).

## Fuera de alcance

Informes por cohorte y programados (F2, RF-DB-06 completo). Push nativas. Pasarela de pago.

## Criterios de aceptación

- Build + lint + tests verdes.
- Informe de Luis (seed, 30 días) imprime correctamente (una sola página de estilos rotos = no aceptado); el resumen ejecutivo no contiene ninguna cifra que no exista en los datos (revísalo y dilo en la entrega).
- Cron ejecutado a mano con `CRON_SECRET` correcto → email simulado/enviado y auditado; con secret incorrecto → 401.
- Paciente nuevo sin consentimiento no puede iniciar check-in; al otorgarlo, sí. Revocación de `voz_grabacion` impide la grabación en la siguiente sesión de voz.
