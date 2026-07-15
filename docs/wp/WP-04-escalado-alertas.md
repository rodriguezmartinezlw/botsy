# WP-04 — Motor de escalado + alertas

**Depende de:** WP-02 · **Funcional:** v0.2 §2.4 (RF-ES-01…06), pirámide §1.1

## Objetivo

Motor determinista de reglas que clasifica cada check-in en `normal / vigilancia / contactar / urgencia`, genera alertas auditables para el profesional y guía al paciente con lenguaje empático. Sin ML: reglas explicables (Decisión D8).

## Diseño

### Formato de `reglas_escalado.condicion` (JSONB)

```json
{ "tipo": "combinacion", "todas": [
    { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "dolor_toracico" },
    { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "disnea" }
]}
{ "tipo": "observacion", "dominio": "dolor", "valor_num_gte": 9 }
{ "tipo": "senal", "codigo": "ideacion_autolitica" }
{ "tipo": "adherencia_critica", "dias_consecutivos": 2 }
{ "tipo": "tendencia", "dominio": "animo", "valor_num_lte": 3, "dias_consecutivos": 3 }
```

Documenta el formato completo en `src/lib/escalado/README.md` (los tipos: `observacion`, `senal`, `combinacion` con `todas`/`alguna`, `adherencia_critica`, `tendencia`). Coordina con `0003_reglas_semilla.sql` de WP-01: si el formato que implementas difiere, crea una migración `000N_reglas_formato.sql` que actualice las semillas — no edites la migración vieja.

### `src/lib/escalado/`

- `motor.ts` — `evaluarCheckin(checkinId)`: carga observaciones del checkin + contexto histórico necesario (tendencias, adherencia), evalúa TODAS las reglas activas aplicables (globales + del paciente + de su vertical) y devuelve `{nivel, reglasDisparadas}` con el nivel más alto. Puro y testeable: separa la carga de datos de la evaluación (`evaluarReglas(datos, reglas)` sin IO).
- `evaluarSenal(checkinId, senal)` — reemplaza el stub de WP-02: se llama en vivo cuando el LLM emite `senal_alarma`; evalúa reglas de tipo `senal` inmediatamente (no espera al cierre).
- `acciones.ts` — al determinar nivel > normal: actualiza `checkins.riesgo`, crea `alertas` (motivo = nombre de la regla; evidencia = observaciones implicadas + últimos 4 mensajes relevantes), inserta `eventos_auditoria` (RF-ES-06: qué se detectó, qué se recomendó). Idempotente: re-evaluar un checkin no duplica alertas de la misma regla.
- Integración: `evaluarCheckin` se ejecuta en `/api/checkin/finalizar` (y el resultado ajusta el mensaje de cierre del asistente).

### UX paciente (RF-ES-02/03 — tono no alarmista, es CRÍTICO)

- `contactar`: tarjeta en el cierre del check-in — "He notado algo que me gustaría que comentes con tu médico hoy. No tiene por qué ser nada grave, pero mejor salir de dudas." + botón `tel:` al `telefono_medico` + registro en auditoría de si pulsó llamar.
- `urgencia`: pantalla dedicada, calmada pero inequívoca — "Por lo que me cuentas, es importante que te vea un médico AHORA." + botón llamar a emergencias (112) + botón llamar a su médico + aviso `[PENDIENTE LEGAL]`. El check-in se cierra automáticamente con resumen.
- `vigilancia`: sin fricción para el paciente (solo alerta al profesional).
- Los textos van centralizados en `src/lib/escalado/textos.ts` para revisión clínica futura.

### Panel (mínimo aquí; la bandeja completa llega en WP-06)

- API interna lista para WP-06: helper `obtenerAlertas(filtros)` con RLS de profesional.

## Fuera de alcance

UI completa de bandeja de alertas (WP-06). Notificación push/email al profesional (WP-07). Modelo de riesgo ML (F5).

## Criterios de aceptación

- Build + lint verdes.
- **Tests unitarios de `evaluarReglas`** (usa el runner que prefieras — vitest sugerido — añadido a devDependencies y script `npm test`): al menos los 5 escenarios de las reglas semilla + 1 combinación que NO dispara + idempotencia de `acciones`.
- Demostración E2E (o con mock de LLM): check-in que menciona dolor torácico + falta de aire → `riesgo='urgencia'`, alerta creada con evidencia, evento de auditoría registrado, pantalla de urgencia mostrada.
- Ningún texto al paciente contiene diagnósticos ("puede ser un infarto" PROHIBIDO) ni alarmismo; verifica contra las reglas clínicas de CLAUDE.md.
