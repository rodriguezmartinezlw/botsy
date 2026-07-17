# ADR-004 — Instituciones, país y multi-institución (multi-tenant clínico)

**Estado:** Aceptada — decisiones del fundador (2026-07-17). · **Implementa:** [WP-22](../wp/WP-22-instituciones-pais.md).

## Contexto

El modelo F1 era plano: `pacientes.profesional_id` → un profesional; sin institución, sin país, sin multi-institución. Para el modelo real (PSP oncológico multi-clínica, MEMORIA §7; regulatorio por país §9; un oncólogo consulta en varios centros) eso no basta, y retrofitarlo obliga a migrar relaciones. El fundador decide construir el modelo completo ahora.

## Decisiones (fijadas)

1. **Alcance: completo ya** — país + instituciones + relación M:N profesional↔instituciones + reajuste de RLS.
2. **Pertenencia: el paciente pertenece a una INSTITUCIÓN**; lo ven los profesionales que trabajan en esa institución (no solo su médico directo). `pacientes.profesional_id` se conserva como "médico responsable" (contacto/escalado), pero la VISIBILIDAD es por institución.

## Modelo de datos

- **`paises`**: `codigo text pk` (ISO-3166 alfa-2: PE, CO, BR, ES), `nombre text`. Catálogo pequeño, admin.
- **`instituciones`**: `id uuid pk`, `nombre`, `tipo check ('hospital','clinica','centro_oncologico','otro')`, `pais_codigo references paises`, `activa bool default true`, `creado_en`.
- **`profesionales_instituciones`** (M:N): `profesional_id references perfiles`, `institucion_id references instituciones`, `activa bool default true`, `unique(profesional_id, institucion_id)`. Un profesional en varias instituciones.
- **`pacientes.institucion_id`** `references instituciones` (nullable en la migración; backfill en seed). El paciente pertenece a una institución.
- **Sponsor:** `programas_patrocinados` gana dimensión de país/institución (opcional en el filtro de los agregados; la k-anonimización sigue aplicando).

## RLS — el punto crítico

Se **redefine el helper existente `es_profesional_de(p_paciente)`** (así TODAS las políticas que ya lo usan heredan el nuevo modelo sin reescribirse una a una):

```
es_admin()
OR exists (
  select 1
  from public.profesionales_instituciones pi
  join public.pacientes pac on pac.institucion_id = pi.institucion_id
  where pac.id = p_paciente and pi.profesional_id = auth.uid() and pi.activa
)
```

- **Consecuencia deliberada:** un profesional ve a TODOS los pacientes de su(s) institución(es), no solo a los de su `profesional_id`. Es lo que el fundador eligió (equipo de la institución).
- **Compatibilidad con `acceso_cruzado.sql`:** el seed debe colocar a los profesionales y sus pacientes en instituciones coherentes con las asignaciones actuales (Dra. García y sus pacientes en Institución A; Dr. Ruiz y Marta en Institución B) para que el aislamiento existente se conserve (Ruiz no ve a los de García). Los escenarios se re-verifican EN VIVO.
- Nuevas tablas con RLS en su migración: `paises`/`instituciones` legibles por profesional/admin (catálogo); `profesionales_instituciones` — el profesional ve sus membresías, admin todo; escritura de catálogo y membresías: admin (en el piloto).

## Consecuencias

- El **enrolamiento** (WP-20) pasa a exigir institución (de las del profesional) al dar de alta.
- El **panel** muestra "pacientes de mi institución"; si el profesional trabaja en varias, un selector/filtro de institución.
- **País** habilita el eje regulatorio (residencia de datos, reglas por país) y de mercado; el patrocinador puede ver por país/institución.
- Es un cambio de RLS de alto radio → se verifica con `acceso_cruzado.sql` EN VIVO (no solo tests unitarios) tras aplicar, con escenarios de institución añadidos.
