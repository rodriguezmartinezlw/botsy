# Revisión WP-02 — Motor conversacional + check-in por texto

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` por el director → **8/8 verde**.
- `npm run lint` → exit 0, sin salida.
- `grep` de `any` en `src/lib/ia`, `src/lib/escalado`, `src/app/api` → **sin coincidencias**.
- `npm run build` (reportado por el agente, coherente con el árbol) → verde, 16 rutas incl. las 3 nuevas `/api/checkin/*` dinámicas.

## Lo que verifiqué a mano (no solo la palabra del agente)

1. **`conversacion.ts` — reglas clínicas.** El system prompt (`construirInstrucciones`) incluye explícitamente: NO diagnostica, NO recomienda fármacos/dosis ni contradice al médico, NO minimiza síntomas de alarma ("no será nada" prohibido), distingue "señal detectada" de "diagnóstico", y deriva ("consúltalo con tu médico", RF-CV-08). Tono cálido, frases cortas, una pregunta por turno, apto para mayores. **Cumple CLAUDE.md.**
2. **`mensaje/route.ts` — seguridad.** `auth.getUser()` dentro del handler; pertenencia por `.eq("paciente_id", user.id)` → 404 si no es suyo; 409 si el check-in no está `en_curso`; body validado con Zod; errores con `{error}` y status correcto **sin** filtrar internos; 503 amable si falta la clave de OpenAI. Mensajes se persisten solo tras un turno correcto (sin huérfanos). **Cumple las reglas de Next 16 y de errores.**
3. **Loop y Zod.** El test "validación Zod" demuestra que un argumento inválido (`confianza=5`) NO se persiste y se devuelve el error al modelo. Sin inserciones a ciegas.

## Decisiones del agente que apruebo

- **Respuesta JSON completa (no SSE):** justificada por el loop multi-round-trip de tool-calls; correcto para F1.
- **Cliente OpenAI por `fetch` inyectable + `z.toJSONSchema` como fuente única:** buena ingeniería, permite test sin env y reutilización en Realtime (WP-03).
- **Apertura determinista** sin llamar al LLM: iniciar el check-in funciona siempre.
- **Dos vocabularios de dominio** (7 checklist vs. 10 de `observaciones.dominio`): deliberado y bien documentado.
- **Stub de escalado → `contactar` como mínimo:** correcto; WP-04 lo elevará a `urgencia` vía `nivelMaximoRiesgo` (el riesgo solo sube).

## Notas / riesgos anotados por el agente — mi decisión

- **G (inconsistencia doc F1/F2 sobre escalado):** NO es error. El PLAN-MAESTRO §1 mete a propósito un escalado **básico por reglas** en F1 (decisión D8); la funcional §10 (histórica) situaba el motor completo en F2. Se mantiene: F1 = reglas deterministas (WP-04), F2+ = ML. Sin acción.
- **E (consistencia parcial si falla la BD a mitad de loop):** aceptable en F1 (sin transacciones multi-tabla desde el cliente). Anotado; si molesta, WP-08 puede envolver en RPC transaccional.
- **F (`npm audit`: 2 moderadas en la cadena de `vitest`, solo devDependencies):** no afecta runtime; se revisa en WP-08. No bloqueante.
- **B (`valor_num` 0–10):** conservador y correcto para las escalas actuales.

## Para WP-04 (siguiente)

- Reemplazar el stub `src/lib/escalado/senales.ts` (`evaluarSenal`) por el motor real, manteniendo la firma que ya consume `loop.ts`.
- Los códigos de señal del guion (`sintoma_fisico`/`dolor_toracico`,`disnea`) ya casan con la regla #1 del seed `0003` — la combinación debe elevar a `urgencia`.
- Integrar `evaluarCheckin` en `/api/checkin/finalizar` (ya existe el endpoint).
