# Revisión WP-06 — Dashboard profesional

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` → **67/67 verde** (51 previos intactos + 16 nuevos).
- `npm run lint` → exit 0. Build → verde (21 rutas, nueva `/pacientes/[id]`).
- `grep any` en `src/app/(panel)` y `src/components/panel` → sin coincidencias.

## Seguridad — verificada a mano (el crux de este WP)

1. **Aislamiento por RLS, NO por service-role.** `grep` de `supabase/admin`/`crearClienteAdmin`/`service_role` en el panel → **0**. Todas las lecturas van por el cliente de servidor; la RLS de profesional de WP-01 hace el aislamiento. Correcto (era la regla explícita del WP).
2. **Autorización en las mutaciones.** El `getUser` no aparece en las Server Actions porque está **centralizado** en `obtenerSesionPanel()` (`src/lib/panel/sesion-panel.ts`): `server-only`, valida `getUser()`, lee el rol de `perfiles` y solo devuelve sesión si es `profesional`/`admin` (cierra la puerta a pacientes y anónimos); la RLS por-paciente es la defensa en profundidad. Las tres acciones (`alertas`, `configuracion`, `pacientes/[id]`) validan Zod + esta sesión antes de escribir, y auditan. **Cumple CLAUDE.md** (buen DRY; mejor que duplicar `getUser`).
3. **Segundo profesional (Dr. Ruiz + Marta)** en `supabase/seed_wp06_segundo_profesional.sql` **aditivo** (no toca el seed de WP-01) para demostrar que un profesional no ve a los pacientes de otro. Correcto.

## Funcional — revisado

- Lista con semáforo y orden riesgo→días (lógica pura testeada), ficha 360º con línea temporal unificada + tendencias reutilizando los gráficos de WP-05 en compacto, bandeja priorizada con acciones auditadas (descarte con motivo obligatorio), reglas del paciente desde **plantillas amigables** que generan el JSONB de WP-04 (round-trip testeado, "dolor > 7" ≡ umbral 8: dispara con 8, no con 7). Sin editor JSON crudo. Todo conforme al WP.

## Desviaciones del agente — decisión

- **Plantilla de omisión de fármaco no es por-fármaco:** correcto, porque el formato `condicion` de WP-04 no lleva `pauta_id`. Fiel al WP. Si se quiere granularidad por fármaco, es una ampliación del formato de condición (anotar para F2, no F1).
- **La línea temporal no muestra un evento fechado de desactivación de pauta** (el esquema no tiene `desactivada_en` y `eventos_auditoria` no es legible por el profesional, solo admin). Limitación menor y coherente con la RLS. **Anotado para WP-08:** valorar si conviene un `desactivada_en` en `pautas_medicacion` o exponer un subconjunto de auditoría al profesional.

## Para WP-07 (siguiente)

- El botón "Ver informe" de la ficha es placeholder → WP-07 lo conecta a `(panel)/pacientes/[id]/informe`.
- Reutilizar `obtenerSesionPanel()` para proteger la vista de informe y el resto de superficie de panel.
