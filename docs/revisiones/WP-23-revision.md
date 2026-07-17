# Revisión WP-23 — Consola de administración

**Fecha:** 2026-07-17 · **Revisor:** Fable/Opus · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` → **279/279** (247 base intactos + 32 nuevos). `npm run lint` → limpio. `npm run build` → **verde** con las 4 rutas `/admin*` (el fallo intermedio de build durante la construcción era por los archivos a medio escribir del propio agente; resuelto al completarse).
- `grep any` en `src/lib/admin`, `src/app/(panel)/admin`, `src/components/admin` → limpio.

## Seguridad — verificada a mano

1. **Guard solo-admin real:** `obtenerSesionAdmin` hace `getUser()` → lee `perfiles.rol` → `!== "admin"` → null. Usado en el layout (redirect para profesionales) y en **cada** Server Action (verificado por conteo: instituciones 6, pacientes 2, profesionales 4 llamadas). Hay tests estáticos que CONGELAN el patrón (todo fichero de acciones debe llamar al guard).
2. **Service-role confinado:** solo `profesionales/acciones.ts` (la invitación por Auth Admin API, mismo patrón que WP-20). El resto opera con el cliente de servidor y la RLS de admin (`es_admin()`), sin relajar ninguna política (test estático lo congela).
3. **Sin migración:** correcto — 0016 ya soportaba todo.

## Funcional — revisado

- Instituciones: CRUD ligero + alta de país; lista con país y conteos. Profesionales: invitación por email (verificado que el trigger de 0001 con rol profesional crea solo el perfil, sin fila de paciente). Membresías con **aviso al retirar la última activa** ("dejará de ver a los N pacientes"). **Pacientes sin institución** con acción de asignar — cierra el riesgo operativo de WP-22. Todo auditado.
- Decisiones aceptadas: lista de profesionales sin email (mostrarlo exigiría service-role de lectura, prohibido fuera de la invitación — correcto); auditoría de países con el código en `detalle` (PK textual vs entidad_id uuid — correcto).

## Con esto

El ciclo operativo queda completo de punta a punta SIN tocar SQL: admin crea institución → invita profesional → membresía → el profesional enrola pacientes → check-ins → alertas → disposición → agregados del patrocinador. Era el último hueco de código señalado en la verificación del 2026-07-17.

## Pendiente (no de este WP)

- QA visual en dispositivo real (guion en `docs/ACCESOS-PRUEBA.md`, sección admin actualizada).
- `acceso_cruzado.sql` no necesita re-ejecución (no cambió ninguna política), pero el escenario admin puede añadirse en la próxima pasada.
