# WP-23 — Consola de administración (instituciones, profesionales, membresías)

**Origen:** verificación del director (2026-07-17): el rol admin existe pero NO tiene UI — instituciones, profesionales y membresías solo existen vía seed/SQL. Sin esto, el administrador no puede operar el sistema (dar de alta una clínica nueva con su equipo). **Sin puerta: programable YA.**

## Objetivo

Área `(panel)/admin` (solo rol `admin`) para operar el catálogo institucional de punta a punta: países (lectura), instituciones (CRUD ligero), profesionales (invitación por email, como el enrolamiento de pacientes de WP-20) y membresías profesional↔institución.

## Tareas

1. **Guard**: sección `(panel)/admin` visible/accesible SOLO para rol `admin` (guard server-side en layout + en cada Server Action; los profesionales no la ven).
2. **Instituciones**: listar (con país y nº de profesionales/pacientes), crear, editar nombre/tipo, activar/desactivar. País por select del catálogo `paises` (lectura; añadir país nuevo = fila simple, admin). RLS ya permite escritura solo admin (0016) — verifica y NO la relajes.
3. **Profesionales**: listar (con sus membresías); **invitar profesional por email** reutilizando el patrón de WP-20 (`inviteUserByEmail` con `raw_user_meta_data {rol:'profesional', nombre}` → el trigger crea el perfil; SIN fila de paciente). Confirmar que el trigger maneja rol profesional correctamente (lo hace desde WP-01; verifica el camino).
4. **Membresías**: asignar/retirar profesional↔institución (tabla `profesionales_instituciones`, `activa` toggle). Aviso al retirar la última membresía de un profesional con pacientes visibles ("dejará de ver a los pacientes de X").
5. **Pacientes sin institución**: vista admin de pacientes con `institucion_id` NULL (el riesgo operativo de WP-22) con acción "asignar institución" — cierra el hueco de invisibilidad.
6. Todo con Server Actions (sesión admin + Zod + auditoría en `eventos_auditoria`), cliente de servidor (la RLS de admin hace el trabajo; admin ya tiene CRUD por `es_admin()`), sin service-role salvo la invitación (Auth Admin API, como WP-20).

## Reglas

Las de CLAUDE.md íntegras. Migración solo si falta algo (el esquema 0016 ya lo soporta; probablemente NO haga falta — no la crees si no). Sin `any`. Textos en español sobrios.

## Criterios de aceptación

- Build/lint/test verdes (añadir tests: invitación de profesional con mock del Admin API; membresías; guard de admin — un profesional recibe 403/redirect en `/admin`; pacientes sin institución listados y asignables).
- Demo documentada: admin crea "Clínica Nueva" (CO) → invita a un profesional → le asigna membresía → el profesional (simulado) puede enrolar pacientes en esa institución.
- La entrega en `docs/wp/entregas/WP-23-entrega.md`; NO commit.
