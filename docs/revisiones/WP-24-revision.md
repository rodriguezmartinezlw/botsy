# Revisión WP-24 — Conversaciones a demanda + historial + micrófono en inicio

**Fecha:** 2026-07-18 · **Revisor:** Fable/Opus · **Veredicto:** ✅ Aprobado con una corrección de la migración aplicada por el director.

## Verificación independiente

- `npx vitest run` → **304/304** (280 base + 24 nuevos de consultas). `npm run lint` → limpio. `npm run build` → verde con `/historial`.
- Lógica clave verificada: la racha es EXCLUSIVA del check-in diario (`esConsulta` en `finalizar.ts`); consulta = siempre fila nueva; 2º check-in del día → 409 con mensaje claro; escalado en vivo probado con fiebre en consulta → contactar + alerta (test).

## Corrección del director (migración 0020)

El bloque dinámico que localiza la restricción UNIQUE de 0001 comparaba `name[]` con `text[]` → **error de tipos 42883 al ejecutar en vivo** (libpg_query solo valida sintaxis, no tipos — mismo aprendizaje que WP-09: el parser no basta, hay que aplicar). Fix: cast `att.attname::text`. Como 0020 no estaba commiteada, se corrigió en el propio archivo.

## Aplicado en vivo (orden correcto: migración ANTES que el deploy del código)

`0020` aplicada al Supabase real: columna `tipo` (default `'checkin'`), índice único parcial `checkins_checkin_diario_unico (paciente_id, fecha) where tipo='checkin'`, constraint vieja `checkins_paciente_id_fecha_key` eliminada. El seed queda coherente (días hasta AYER + `on conflict` con el predicado del índice parcial).

## Producto

- Check-in diario (1/día, racha) + **consultas ilimitadas 24/7** con guion propio (escucha el motivo, registra, evalúa señales, sin checklist). El protocolo de escalado (tarjeta contactar/urgencia + alerta inmediata al profesional) funciona en consultas — mismos endpoints.
- Inicio: botones "🎤 Hablar con Botsy" / "Escribir" SIEMPRE visibles (pendiente→check-in; hecho→consulta). `/checkin` y voz con el día completado ofrecen "Iniciar una conversación".
- `(paciente)/historial`: check-ins y consultas con badges y transcript expandible; 4º ítem de la navegación.
- El agente también arregló limpiamente el lint preexistente de `FormularioRestablecer` (suscripción dentro del efecto asíncrono) — revisado, correcto.

## Nota

El patrón "constraint localizada dinámicamente" queda como referencia para futuros DROP de constraints inline de 0001.
