# Revisión WP-01 — Esquema Supabase + RLS + auth

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado con una corrección de seguridad clínica aplicada por el director.

## Verificación independiente

- `npm run build` ejecutado por el director → **verde** (exit 0, compila sin proyecto Supabase remoto).
- RLS: `enable row level security` en **11/11** tablas; 53 `create policy` (tras la corrección de abajo). Ninguna tabla sin política → OK.
- 11 `create table` en `0001`; FKs en orden correcto; validación del agente con libpg_query (parser real de Postgres) sobre los 4 archivos → aceptada.
- `admin.ts` empieza con `import "server-only"`; `grep` de `service_role`/`SERVICE_ROLE` no aparece fuera de `admin.ts`/`config.ts` → sin fugas de secreto.
- Tipos, clientes (client/server/admin), auth con guards y `consentimientos` funcional → conforme al WP.

## Corrección aplicada por el director (riesgo B de la entrega)

**Auto-prescripción del paciente.** El agente implementó, siguiendo la regla general del WP al pie de la letra, políticas que permitían al paciente `INSERT`/`UPDATE` de sus propias `pautas_medicacion`. Esto contradice el modelo clínico (el profesional prescribe, el paciente cumple; existe `creada_por`) y la regla de oro de CLAUDE.md.

- **Acción:** eliminadas las políticas `pautas_insert_propio` y `pautas_update_propio` en `0002_rls.sql`. El paciente conserva solo `pautas_select_propio` (lectura). Profesional y admin mantienen la escritura.
- Editado directamente en `0002` (no hay BD viva ni commit previo → no aplica la regla de "no editar migración entregada"; queda historial limpio).
- **Matriz actualizada:** paciente → `pautas_medicacion` pasa a `SELECT ✓ propio / INSERT ✗ / UPDATE ✗ / DELETE ✗`.

## Otros riesgos de la entrega — decisión

- **A (admin vs. append-only):** correcto. Append-only preservado en `consentimientos` y `eventos_auditoria`; CRUD admin en el resto. Aceptado.
- **C (paciente no lee su propio audio):** aceptable en F1. Nota: el derecho de acceso RGPD se cubrirá con un flujo de exportación en una fase posterior, no con reproducción directa. No bloqueante; anotado para F2.
- **D (reglas del profesional solo sobre sus pacientes; globales las gestiona admin):** interpretación correcta.
- **E (doble timestamp en `consentimientos`):** inofensivo, se deja.
- **F (`reglas_escalado.vertical` sin check):** aceptable; WP-04 valida el uso.
- **G (`server-only` por alias de Next):** aceptado; si el tooling cambiara, `npm i server-only`.
- **H (sin middleware de refresco de sesión):** aceptado para F1; los guards de layout + `getUser()` bastan.

## Pendiente de verificación en vivo (documentado, no bloqueante)

El bloque `auth.users`/`auth.identities` del `seed.sql` depende del esquema interno de GoTrue y solo se confirmará al crear el proyecto Supabase remoto y correr `db reset` (o usar la Auth Admin API). Se abordará cuando el usuario decida la cuenta Supabase. WP-02 no depende del seed para compilar.

## Notas para WP-02

- Usar `src/lib/supabase/server.ts` (con cookies) en las API de check-in; `admin.ts` solo si una operación legítima necesita saltarse RLS (documentarlo).
- El motor conversacional escribe `observaciones`/`tomas_medicacion` como el paciente autenticado (RLS `propio` lo permite) — no hace falta service-role para eso.
