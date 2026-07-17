# WP-24 — Conversaciones a demanda + historial + micrófono en inicio

**Origen:** feedback del fundador probando la app en producción (2026-07-17). **Sin puerta: programable YA.** Decisión de producto: el check-in diario sigue siendo LA estructura (1/día, alimenta racha y ficha), pero la paciente debe poder **hablar con Botsy siempre que lo necesite** — un síntoma nuevo a las 22h no puede esperar a mañana. Además: historial de conversaciones visible para la paciente y micrófono accesible desde inicio.

## A. Esquema (migración 0020)

- `checkins.tipo text not null check (tipo in ('checkin','consulta')) default 'checkin'`.
- Sustituir la restricción `UNIQUE (paciente_id, fecha)` de 0001 por un **índice único PARCIAL**: `unique (paciente_id, fecha) where tipo = 'checkin'` (un solo check-in estructurado al día; consultas ilimitadas). Localiza el nombre real del constraint en la BD/0001 para el DROP. RLS intacta (misma tabla). Tipos en `db.ts`.

## B. Consultas a demanda (motor)

- `/api/checkin/iniciar` y `/api/voz/sesion` aceptan `tipo?: 'checkin'|'consulta'` (Zod, default checkin). Con `consulta`: SIEMPRE crea una fila nueva (`tipo='consulta'`, `estado='en_curso'`), aunque el check-in de hoy esté completado o haya otras consultas.
- **Guion propio de consulta** en `construirInstrucciones` (modo consulta): "La persona quiere contarte algo AHORA (un síntoma, una duda, un malestar). Escúchala, registra lo clínico con las herramientas, evalúa señales de alarma, y NO recorras la checklist de dominios del check-in. Cierra cuando ella termine." Mismas tools; el escalado en vivo (señales → alerta inmediata al profesional, WP-04/WP-10) funciona sin cambios porque son los mismos endpoints.
- `finalizar`: una consulta NO toca la racha (`calcularRacha` solo para tipo checkin); resumen + reconciliación + evaluación de reglas sí (una fiebre contada en consulta debe escalar igual).
- Mensaje de error específico si se intenta `tipo=checkin` con el día ya completado: "Ya completaste tu check-in de hoy. Puedes abrir una conversación cuando quieras." (la UI enruta sola, pero el mensaje no debe ser críptico).

## C. UI de la paciente

1. **Inicio**: bajo la racha, SIEMPRE visibles dos botones grandes: "🎤 Hablar con Botsy" y "Escribir". Si el check-in de hoy está pendiente → van al check-in (voz/texto). Si ya está hecho → abren una CONSULTA, con el subtítulo "Cuéntame lo que necesites, a cualquier hora". El estado del día pasa a: "Check-in de hoy completado ✓ — puedo escucharte cuando quieras".
2. **/checkin con el día completado**: en vez de bloquear, muestra el resumen de hoy + botón "Iniciar una conversación" (consulta). Ídem voz (`PantallaVoz` recibe el tipo).
3. **Historial** — nueva página `(paciente)/historial`: lista cronológica de check-ins y consultas (fecha, tipo, canal, badge de riesgo si lo hubo, resumen; expandir → transcript completo), paginada. RLS `propio` lo hace trivial (reutiliza el patrón de la línea temporal del panel, versión paciente). **4º ítem en la navegación inferior** (Inicio, Check-in, Historial, Perfil), targets ≥44px.

## D. Seed

- Ajustar el generador para que los datos sintéticos lleguen hasta **AYER** (`current_date - 1`), no hasta hoy: el día actual queda libre para la demo (esto ya se corrigió a mano en la BD viva; el seed debe quedar coherente para futuros resets). `ultimo_checkin` = ayer.

## E. Reglas y verificación

- Reglas de oro íntegras (la consulta tampoco diagnostica; el escalado con tarjeta "llama a tu médico"/urgencia YA existe en el chat en vivo y debe funcionar igual en consultas — pruébalo).
- Tests: índice parcial (2 consultas el mismo día OK; 2º checkin del día falla), consulta NO altera racha, guion de consulta distinto al de check-in, iniciar consulta con check-in completado OK, señал de alarma en consulta → riesgo/alerta.
- Build/lint/test verdes (280 base); migración 0020 validada; NO aplicar en vivo (lo hace el director); entrega en `docs/wp/entregas/WP-24-entrega.md`. NO commit.
