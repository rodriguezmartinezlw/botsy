# Revisión WP-16 — Termómetro de Distrés NCCN conversacional (armazón)

**Fecha:** 2026-07-17 · **Revisor:** Fable/Opus (auto-revisión) · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` → **215/215** (194 previos intactos + 21 nuevos), 20 ficheros. `npm run lint` → exit 0. `npm run build` → exit 0.
- Migración `0011_instrumentos`: RLS en `instrumentos_respuestas` + 4 políticas (paciente/profesional/admin). Validada con libpg_query (10 statements) por el agente.
- **Ninguna migración commiteada (0001–0010) editada** (verificado con git status): la activación del termómetro en los 2 programas y la regla de distrés se hacen por **data-update idempotente en 0011**, no editando 0006. Correcto.
- `grep any` en `src/lib/instrumentos` → limpio. Umbral `[PENDIENTE CLÍNICO]` marcado en `termometro.ts` y `0011`.

## Regla de oro verificada a mano

**Botsy administra y registra el instrumento, pero NO lo interpreta ante el paciente.** Leí el TEXTO del prompt (`seccionInstrumento`, no solo el comentario): línea 399 prohíbe explícitamente interpretar o nombrar el resultado ("'tienes distrés' están PROHIBIDOS. No es un diagnóstico"). El umbral que decide si se recorre la lista de problemas es `instrumento.umbralProblemas` (configurable). La versión y el origen del instrumento los **estampa el servidor**, no el modelo. Cumple reglas de oro 1 y 4.

## Mecanismo — revisado

- Tool `registrar_instrumento` con Zod (puntuación 0–10, problemas del catálogo NCCN es-ES; fuera de catálogo → rechazado antes de persistir). Reutiliza `ejecutarHerramienta` → funciona en texto y voz.
- **Gating en 3 capas** (tool no ofrecida / guion no la menciona / `ejecutarHerramienta` la rechaza si el instrumento no está activo hoy) — coherente con el gating de módulos de WP-11.
- Frecuencia por programa (semanal en tratamiento activo, quincenal en oral — `[PENDIENTE CLÍNICO]`) leída de la config `instrumentos.termometro_distres.frecuencia`; `obtenerContextoInstrumento` decide si toca hoy (puro, testeado).
- Nuevo tipo de condición `instrumento` en el motor determinista (aditivo); regla `distres_termometro` `≥4 → contactar`, configurable, materializada como `reglas_escalado` al asignar el programa.
- Panel: serie temporal 0–10 + problemas frecuentes en la ficha 360º (reutiliza `GraficoAreaTemporal`), vista solo profesional.

## Notas

- Los tests nuevos cubren: persistencia con Zod + rechazo + gating; umbral→contactar (y no por debajo); frecuencia; serie temporal. 
- **Pendiente (puerta):** la versión es-ES de la lista de problemas y el umbral (≥4) los valida el psicooncólogo (llamada 1). Todo configurable, nada hardcodeado.
- **Pendiente para WP-09:** aplicar `0001–0011` + seed al Supabase en vivo.
