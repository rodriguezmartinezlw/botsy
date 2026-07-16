# Revisión WP-05 — Perfil evolutivo del paciente

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` → **51/51 verde** (32 previos intactos + 19 nuevos de `agregados`).
- `npm run lint` → exit 0. Build → verde (21 rutas, `/perfil` dinámica).
- `grep` de `lib/supabase`/`@supabase` en `src/components/graficos/` → **0**: los gráficos no conocen Supabase (contrato de reutilización para WP-06 cumplido).
- `grep any` en `agregados.ts`, `graficos/`, `perfil/`, `paciente/perfil` → sin coincidencias.

## Verificado a mano

- **% de adherencia** = `tomadas/(tomadas+omitidas)`, excluyendo `desconocido` (documentado y con test). Los números del seed de Luis cuadran: mes → AAS 100%, Warfarina 12/14=86%, global 26/28=93%. Cálculo correcto.
- **Arquitectura de datos:** el perfil es Server Component; `cargarDatosPerfil()` agrega en el servidor (RLS `propio`) y pasa series ya calculadas; el único estado cliente es el selector de período/fecha. Cumple "nada de fetch en cliente".

## Decisiones del agente — aprobadas

- Observaciones fechadas por su check-in vía join en JS (la tabla no tiene fecha propia): correcto.
- Precalcular los 3 bundles de período en servidor y que el cliente solo elija: cumple "series ya calculadas".
- Ejes a 14px reconciliando el ≥12px del WP con el ≥16px de CLAUDE.md (texto principal ≥16px): aceptable; las etiquetas de eje son texto secundario.

## Riesgos anotados — sin acción

- Seed anclado a `current_date`: los valores live dependen de verse el mismo día del seeding; los tests fijan "hoy". Es un detalle del seed, no del perfil.
- Escalas de sueño/cognición asumidas (0–10) al no fijarlas el WP. Aceptable; si clínica define otra escala, es ajuste de agregados.

## Para WP-06

- Reutilizar los componentes de `src/components/graficos/` (reciben series, no tocan Supabase) en la ficha 360º del profesional, en tamaño compacto.
