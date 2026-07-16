# Revisión WP-07 — Informes + recordatorios + consentimientos

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` → **96/96 verde** (67 previos intactos + 29 nuevos).
- `npm run lint` → exit 0. Build → verde. Migración `0004_informes` valida con libpg_query.
- `grep any` en informe/cron/consentimientos/informes → sin coincidencias.

## Verificado a mano

1. **Resumen del informe sin cifras inventadas (lo más crítico).** Leí `src/lib/informes/resumen.ts`: doble capa REAL. (1) `construirHechos` es lo único que ve el modelo — cada número sale de los datos agregados de WP-05. (2) `validarResumenSinCifrasInventadas` extrae toda cifra del texto del LLM y **descarta el resumen entero** si aparece cualquier número fuera del conjunto permitido (hechos + fechas del período + edad). `generarResumenEjecutivo` nunca lanza; ante cualquier problema (sin datos / vacío / cifras inválidas / fallo proveedor) devuelve `sin_resumen` y el informe sale sin él. El prompt prohíbe explícitamente diagnosticar e inventar. **Cumple la regla clínica con margen.**
2. **`informes` con RLS:** la migración `0004` tiene `enable row level security` + 3 políticas en el mismo archivo. Correcto.
3. **Cron protegido:** `CRON_SECRET` comprobado dentro del handler (Bearer); test confirma 401 sin secreto. Correcto (el cron va por secreto, no por sesión — es la excepción legítima a la regla de sesión).
4. **Informe protegido por RLS + `obtenerSesionPanel`:** `cargarDatosInforme` usa el cliente de servidor, nunca service-role; 404 si el paciente no es del profesional.

## Desviaciones del agente — decisión

- **Seed de Luis = 14 días (el WP mencionaba 30):** el informe a 30 días muestra los 14 correctamente. WP-08 amplía el seed → se resuelve allí.
- **Informe se persiste en cada render** (traza de cada emisión): aceptable como traza; deduplicar es acción futura. Anotado para WP-08.
- **Crons horarios requieren Vercel Pro:** tema de despliegue, documentado en la entrega y a recoger en `DESPLIEGUE.md` (WP-08).
- **`RESEND_FROM` y `APP_URL` añadidas a `.env.example`** además de las pedidas: correcto, hacen falta para un email real.
- **Edge menor (no bloqueante):** el validador de cifras detecta dígitos, no números escritos con letras ("cuarenta y dos"). El prompt lo desincentiva y es una alucinación rara; suficiente para F1. Anotado.

## Para WP-08 (último, hardening) — lista acumulada de mis revisiones

1. Auditoría de acceso cruzado (paciente A/B, profesional no asignado, anónimo) + grep de secretos en bundle.
2. Ampliar el seed (≥30–60 días de Luis; resuelve el desfase de WP-07) con alertas en varios estados.
3. Consolidación de **señales genéricas sin regla** (WP-04): decidir si materializan alerta al profesional.
4. Valorar `desactivada_en` en `pautas_medicacion` o exponer subconjunto de auditoría al profesional (WP-06).
5. `npm audit`: 2 moderadas en la cadena de `vitest` (solo dev) — revisar sin romper versiones.
6. Dedup opcional de `informes`.
7. Accesibilidad geriátrica, disclaimers presentes, `docs/DESPLIEGUE.md` completo (incluida la nota de Vercel Pro para crons).
