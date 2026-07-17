# Revisión WP-09 — Puesta en producción + E2E

**Fecha:** 2026-07-17 · **Revisor:** Fable/Opus · **Veredicto:** ✅ Completado. Schema + seed + RLS verificados en vivo; 2 bugs reales corregidos; capa de IA probada con clave real.

## Valor demostrado

- La verificación de acceso cruzado EN VIVO (imposible sin BD hasta ahora) justificó su existencia: encontró **2 defectos reales** invisibles a los tests unitarios y al modo demo — una fuga de RLS (paciente veía reglas globales) y un bug de runtime en 5 RPC del patrocinador. Ambos corregidos con migraciones aditivas (0012, 0013) que NO editan las commiteadas.
- El bloque GoTrue del seed —duda abierta desde WP-01— **funciona** contra el proyecto real.
- E2E de IA con clave real: extracción clínica estructurada correcta (incluida "fiebre", que dispara la regla oncológica materializada).

## Correcciones (todas migraciones nuevas o seed re-runnable, nada commiteado editado)

- **0012:** `reglas_escalado` SELECT gateado a profesional/admin. Test estático que lo congela.
- **0013:** `#variable_conflict use_column` en las 5 RPC con salida `n`. Recreadas idénticas a 0010.
- **seed.sql:** bloque idempotente que materializa las reglas de programa (replica `sincronizarReglasPrograma`).

## Estado

216 tests verdes, build/lint verdes, BD en vivo poblada (19 tablas RLS, 15 usuarios, 389 check-ins, 55 reglas), acceso_cruzado.sql en verde.

## Deuda / notas

- **Interactivo (voz/texto en navegador):** listo para `npm run dev`; la voz necesita micrófono (no headless). No es un defecto, es una limitación del entorno de verificación.
- **Resend** pendiente (solo afecta a emails).
- **Redundancia `desactivada_en`/`discontinuada_en`** (de WP-17): sigue anotada como limpieza opcional.
- Reevaluar en un futuro si conviene mover la materialización de reglas del seed a un paso reproducible (p. ej. exponer `sincronizarReglasPrograma` como función invocable desde el seed).
