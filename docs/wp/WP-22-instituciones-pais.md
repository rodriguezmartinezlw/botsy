# WP-22 — Instituciones, país y multi-institución

**Depende de:** todo lo anterior · **Decisión:** [ADR-004](../adr/ADR-004-instituciones-pais.md) (léela entera; las decisiones ya están fijadas — NO re-preguntes). **Sin puerta.** Cambio FOUNDATIONAL y CRÍTICO en RLS: extrema el cuidado y re-verifica en vivo.

## Objetivo

Añadir país + instituciones + relación M:N profesional↔instituciones, con el paciente perteneciendo a una institución y la visibilidad del profesional pasando a ser "los pacientes de mi(s) institución(es)". Migraciones nuevas (la siguiente es 0016), sin editar commiteadas.

## Tareas

### 1. Esquema (migración 0016) + RLS en la misma migración
- `paises` (`codigo text pk`, `nombre`), `instituciones` (`id`, `nombre`, `tipo` check hospital/clinica/centro_oncologico/otro, `pais_codigo` fk, `activa`, `creado_en`), `profesionales_instituciones` (`profesional_id` fk, `institucion_id` fk, `activa`, `unique(profesional_id,institucion_id)`, `creado_en`). Añadir `pacientes.institucion_id` fk (nullable).
- Índices de FK (siguiendo la práctica de 0015).
- RLS: `paises`/`instituciones` SELECT a authenticated con rol profesional/admin (catálogo; usa `es_profesional_o_admin()`); escritura solo admin. `profesionales_instituciones`: el profesional SELECT de sus membresías (`profesional_id = auth.uid()`) o admin; escritura admin. Tipos TS en `db.ts`.

### 2. Reescritura de `es_profesional_de` (migración 0016 o 0017)
- `create or replace function public.es_profesional_de(p_paciente uuid)` con el cuerpo de ADR-004 (admin OR comparte institución con el paciente vía `profesionales_instituciones` activa). Mantener `security definer`, `stable`, `set search_path`.
- **NO** cambiar la firma ni el nombre (todas las políticas lo reutilizan). Verificar que sigue siendo el único punto que decide "este profesional gestiona a este paciente".
- Revisar si alguna política o consulta usa `pacientes.profesional_id` directamente para VISIBILIDAD y migrarla a `es_profesional_de` (el `profesional_id` queda solo como "médico responsable"/contacto, no como control de acceso).

### 3. Seed (actualizar `supabase/seed.sql`, idempotente)
- `paises`: al menos PE (Perú), y CO/BR/ES para el catálogo.
- 2 instituciones: **A** (p. ej. "Clínica Oncológica Lima", PE) con la Dra. García y SUS pacientes; **B** ("Centro Oncológico Norte", PE) con el Dr. Ruiz y Marta. Coherente con las asignaciones actuales para que el aislamiento se conserve.
- `profesionales_instituciones`: García→A, Ruiz→B (y un caso de profesional en A y B para ejercitar el multi-institución, si añades un tercer profesional).
- Backfill `pacientes.institucion_id` según a qué profesional estaban asignados.

### 4. Enrolamiento (extender WP-20)
- El formulario "Nuevo paciente" incluye un selector de **institución** (de las del profesional actual, vía `profesionales_instituciones`). Si el profesional no tiene institución → mensaje claro (el admin debe asignarle una). La Server Action fija `pacientes.institucion_id`.
- La vinculación de huérfanos también asigna institución.

### 5. Panel
- La lista de pacientes ya se filtra sola por RLS (pacientes de mis instituciones). Si el profesional trabaja en varias instituciones, añadir un **selector/filtro de institución** en `(panel)/pacientes`.
- Ficha 360º: mostrar la institución y el país del paciente.
- (panel)/configuracion o una vista admin mínima: gestión de países/instituciones/membresías (para el piloto puede ser solo lectura + nota "gestión avanzada en admin"; si el tiempo lo permite, alta básica por admin).

### 6. Patrocinador (dimensión país/institución)
- `programas_patrocinados`: permitir acotar por `pais_codigo`/`institucion_id` (nullable = todo). Las RPC de agregados aceptan filtro opcional por institución/país manteniendo la k-anonimización ≥5. El dashboard puede ofrecer el desglose por país (o dejar el desglose por institución como mejora anotada si excede el sprint — decláralo).

## Verificación (OBLIGATORIA en vivo, por ser RLS)
- build/lint/test en verde (adaptar los tests que asuman el modelo plano; añadir: `es_profesional_de` por institución; el profesional ve a los pacientes de su institución y no a los de otra; multi-institución ve ambas).
- Ampliar `supabase/tests/acceso_cruzado.sql` con escenarios de institución (profesional de A no ve pacientes de B; profesional en A+B ve ambos; paciente sigue viendo solo lo suyo).
- **El director aplicará 0016+ al Supabase VIVO y correrá `acceso_cruzado.sql` en vivo** antes de aprobar — deja el seed y el script listos para eso.

## Criterios de aceptación
- Migraciones nuevas con RLS incluida; ninguna commiteada editada; `es_profesional_de` reescrita sin cambiar firma.
- Aislamiento por institución demostrado (unitario + acceso_cruzado en vivo).
- Enrolamiento asigna institución; panel filtra por institución.
- Sin `any`; sin regresiones en los tests existentes (adaptados donde el modelo cambió).
