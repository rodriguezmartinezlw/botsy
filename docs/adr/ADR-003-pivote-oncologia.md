# ADR-003 — Pivote a oncología (mama + pediatría cuidador-proxy) y modelo pagador farma/capitado

**Estado:** Aceptada — decisión de producto del fundador, documentada en [MEMORIA-PROYECTO.md](../MEMORIA-PROYECTO.md) v1.0 · **Fecha:** 2026-07-16 · **Sustituye parcialmente a:** ADR-002 (la ARQUITECTURA de programas de ADR-002 sigue vigente; sus 5 plantillas multi-perfil quedan aparcadas y el seed pasa a oncología).

## Contexto

La Memoria de Producto v1.0 fija: vertical de entrada cáncer de mama (2 programas: terapia oral y tratamiento activo), programa 2 oncología pediátrica vía cuidador-proxy, pagador = laboratorios (PSP) y capitados (año 2), NO B2C ni $29/mes, demo vendible sobre seed al fin del sprint 2, regla de corte abril 2027, y regla de puertas (cada WP clínico se desbloquea con una conversación real).

## Decisión técnica

1. **La plataforma F1 y la arquitectura de programas (ADR-002) se conservan íntegras** — el pivote es de contenido y de pagador, no de motor: cambian seeds, guiones, reglas, catálogos y aparecen 4 módulos nuevos (termómetro NCCN, dashboard patrocinador, ROI, farmacovigilancia) + el modo proxy pediátrico.
2. **Nuevas reglas de oro vinculantes** (se añaden a CLAUDE.md): la IA no conversa con menores (modo cuidador-proxy con gate server-side); disposición estructurada obligatoria en toda alerta (decisión + motivo codificado + desenlace); v1 no predice ni sugiere (escalado determinista; LLM solo captura/estructura/pre-señala, nunca decide).
3. **Nuevo rol `patrocinador`** con acceso EXCLUSIVO a agregados pseudonimizados (RPC security definer, k-anonimato ≥5; cero políticas de lectura sobre tablas clínicas).
4. **Activo de datos desde el día 1:** disposición estructurada + consentimiento `uso_secundario` separado y opcional. Se diseña ahora, se monetiza ≥2029.
5. **Hoja de ruta del piloto:** [PLAN-TECNICO-PILOTO.md](../PLAN-TECNICO-PILOTO.md) (documento maestro) — WP-10 → WP-11 v2 → WP-16 → WP-17+WP-15 (demo vendible) → WP-18 (tras LOI) → WP-19 (tras asociación). WP-12/13/14 aparcados (el §3 de WP-13 se absorbe en WP-11 v2).
6. **Umbrales clínicos:** todo umbral de las reglas oncológicas y del termómetro va marcado `[PENDIENTE CLÍNICO]` hasta la validación del psicooncólogo (llamada 1). El código se construye configurable; los números los pone la clínica.

## Consecuencias

- El seed demo cardiovascular/geriátrico se sustituye por una cohorte oncológica de mama (WP-17): la demo es la primera reunión de venta.
- ADR-001 (voz OpenAI Realtime) queda REFORZADA: a precios PSP el coste de voz es marginal; la abstracción `VoiceSession` sigue siendo el seguro. Si el piloto muestra que la voz no supera al formulario (benchmark Noona 90%), se pivota la capa de entrada sin tocar el motor.
- Los textos de UI/venta no pueden describir predicción/diagnóstico/triaje autónomo (intended purpose — MDR regla 11): criterio de aceptación transversal.
