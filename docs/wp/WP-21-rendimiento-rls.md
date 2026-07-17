# WP-21 — Rendimiento de RLS a escala

**Origen:** linter de rendimiento de Supabase (auditoría del director 2026-07-17, ver `docs/revisiones/REVISION-2026-07-17-auditoria.md`). **Sin puerta, pero NO urgente:** son optimizaciones para miles de filas; con las decenas de pacientes del piloto son negligibles. Hacer cuando la BD crezca o antes de escalar a varios centros.

## Objetivo

Reducir el coste por-fila de la evaluación de RLS, que a escala domina el tiempo de consulta. Todo son **migraciones nuevas** que recrean políticas (no editar las commiteadas); comportamiento idéntico, solo más rápido. **Riesgo:** toca muchas políticas → cada migración debe re-verificarse con `supabase/tests/acceso_cruzado.sql` EN VIVO (no solo tests unitarios) antes de aprobar, porque un error aquí abre o cierra RLS de más.

## Tareas

1. **`auth_rls_initplan` (28 políticas):** envolver `auth.uid()` y las llamadas a funciones en `(select …)` para que el planificador las evalúe UNA vez por consulta en vez de por fila. P. ej. `using (paciente_id = auth.uid())` → `using (paciente_id = (select auth.uid()))`; `using (public.es_profesional_de(paciente_id))` → mantener (ya es por-fila necesaria) o cachear donde aplique. Recrear las políticas afectadas en migraciones nuevas, tabla por tabla, y re-correr acceso_cruzado en vivo tras cada una.
2. **`multiple_permissive_policies` (41):** donde hay varias políticas permisivas para el mismo rol+acción sobre una tabla (se evalúan como OR, cada una con su coste), consolidarlas en una sola política con la condición combinada, SIN cambiar el resultado de acceso. Documentar la equivalencia (qué policies se fusionan en cuál) y verificar con acceso_cruzado.
3. Actualizar `src/lib/seguridad/auditoria.test.ts` si cambian nombres de políticas que el test referencia.

## Criterios de aceptación

- `acceso_cruzado.sql` EN VIVO en verde tras cada migración (imprescindible — es RLS).
- Los 243+ tests unitarios en verde; build/lint verdes.
- El linter de rendimiento de Supabase baja de forma medible en `auth_rls_initplan` y `multiple_permissive_policies` (adjuntar antes/después).
- Migraciones nuevas; ninguna commiteada editada; matriz de acceso re-verificada y adjunta en la entrega.

## Fuera de alcance

Los `unused_index` del linter (se resuelven solos con tráfico real). Particionado/otras optimizaciones (prematuras).
