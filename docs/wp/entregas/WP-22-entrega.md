# WP-22 — Instituciones, país y multi-institución · Entrega

**Estado:** implementado y verificado en verde (build + lint + 247 tests + parseo SQL).
**NO aplicado al Supabase vivo** (lo aplica el director en la revisión). **NO commit / NO push.**

> Cambio FOUNDATIONAL y CRÍTICO en la RLS: se **redefine `es_profesional_de`** y con ello
> cambia la visibilidad de TODAS las políticas que lo usan. Verificación EN VIVO obligatoria
> con `supabase/tests/acceso_cruzado.sql` (guion al final).

---

## 1. Qué se hizo (por tarea del WP)

### Tarea 1 — Esquema (migración 0016) + RLS en la misma migración
`supabase/migrations/0016_instituciones_pais.sql` (nueva, aditiva):
- `paises` (`codigo text pk` con check ISO alfa-2, `nombre`, `creado_en`).
- `instituciones` (`id uuid pk`, `nombre`, `tipo` check `hospital|clinica|centro_oncologico|otro`,
  `pais_codigo` fk → `paises`, `activa`, `creado_en`).
- `profesionales_instituciones` (M:N: `profesional_id` fk → `perfiles`, `institucion_id` fk →
  `instituciones`, `activa`, `unique(profesional_id, institucion_id)`, `creado_en`).
- `pacientes.institucion_id uuid` fk → `instituciones` (nullable; `on delete set null`; backfill en seed).
- `programas_patrocinados.pais_codigo` + `institucion_id` (dimensión opcional del patrocinador, §6).
- Índices de FK (práctica de 0015): `idx_instituciones_pais`, `idx_prof_inst_profesional`,
  `idx_prof_inst_institucion`, `idx_pacientes_institucion`, `idx_prog_patroc_institucion`, `idx_prog_patroc_pais`.
- RLS habilitada + políticas de las 3 tablas nuevas en la MISMA migración:
  - `paises` / `instituciones`: SELECT con `es_profesional_o_admin()`; escritura solo admin.
  - `profesionales_instituciones`: SELECT de las membresías propias (`profesional_id = auth.uid()`); admin todo.
- Tipos TS en `src/types/db.ts` (Row + Insert de las 3 tablas nuevas, `institucion_id` en `Paciente`,
  `pais_codigo`/`institucion_id` en `ProgramaPatrocinado`, `TipoInstitucion`, registro en `BaseDatos.Tables`).

### Tarea 2 — Reescritura de `es_profesional_de` (en 0016)
`create or replace function public.es_profesional_de(p_paciente uuid)` con el cuerpo de ADR-004:

```sql
select public.es_admin()
    or exists (
      select 1
      from public.profesionales_instituciones pi
      join public.pacientes pac on pac.institucion_id = pi.institucion_id
      where pac.id = p_paciente and pi.profesional_id = auth.uid() and pi.activa
    );
```

- **Misma firma / nombre / `security definer` / `stable` / `set search_path = public`** → TODAS las
  políticas de 0002/0006/0011 que lo llaman heredan el modelo por institución sin tocarse.
- Revisión de usos de `pacientes.profesional_id` para VISIBILIDAD: el ÚNICO punto que decidía acceso
  por `profesional_id` era el cuerpo anterior de `es_profesional_de` (0002). Los usos restantes de
  `profesional_id` en el código son de **médico responsable** (no control de acceso) y se conservan:
  `src/app/(paciente)/inicio/page.tsx` (marca "huérfano"), `src/lib/escalado/notificacion.ts` (a quién
  avisar), `src/app/(panel)/pacientes/acciones.ts` (fija el médico responsable al enrolar). Se documentó
  el nuevo significado con `comment on column pacientes.profesional_id`.

### Tarea 3 — Seed (idempotente)
- `supabase/seed.sql`: países `PE/CO/BR/ES`; instituciones **A** = "Clínica Oncológica Lima" (PE) y
  **B** = "Centro Oncológico Norte" (PE); membresías García→A, **Dr. Vega (…0007) → A y B** (nuevo 3.er
  profesional para ejercitar multi-institución); backfill `institucion_id = A` de las 10 pacientes de García.
- `supabase/seed_wp06_segundo_profesional.sql`: membresía **Ruiz→B** y backfill `institucion_id = B` de Marta.
- Coherente con las asignaciones actuales → el aislamiento existente se conserva (García/A no ve a Marta/B;
  Ruiz/B no ve a los de A). Ambos seeds son idempotentes (`on conflict do nothing`).

### Tarea 4 — Enrolamiento (extiende WP-20)
- `src/lib/enrolamiento/nucleo.ts`: `esquemaEnrolamiento` gana `institucionId` (uuid obligatorio); se
  normaliza y se **reenvía a `vincularProfesional`** en AMBOS caminos (alta nueva y vinculación de huérfano).
- `src/app/(panel)/pacientes/acciones.ts`: la Server Action **valida que la institución elegida sea una
  del profesional** (o cualquiera activa si es admin) antes de dar de alta; si el profesional no tiene
  institución → mensaje claro; `vincularProfesional` fija `pacientes.institucion_id` (vía cliente admin,
  bootstrap, igual que `profesional_id`).
- `src/components/panel/FormularioNuevoPaciente.tsx`: selector de **Institución** (de las del profesional);
  si no hay ninguna, muestra el aviso de "pide una al administrador".

### Tarea 5 — Panel
- `src/lib/panel/datos.ts`: `listarPacientes` devuelve `institucionId`/`institucionNombre`;
  `cargarFichaPaciente` resuelve institución + país para la cabecera; nuevo loader
  `listarInstitucionesDelProfesional()` (membresías del profesional, o todas si admin).
- `src/lib/panel/lista.ts`: `PacienteLista` gana institución; funciones puras `filtrarPorInstitucion` +
  `institucionesDeLista`.
- `src/components/panel/ListaPacientes.tsx`: **selector/filtro de institución** que aparece SOLO si el
  profesional trabaja en varias (≥2 instituciones distintas en su lista).
- `src/components/panel/ficha/CabeceraFicha.tsx` + `src/lib/panel/tipos.ts`: la ficha 360º muestra
  **institución · país**.
- `src/app/(panel)/configuracion/page.tsx`: sección de solo lectura "Mis instituciones" + nota
  "la gestión la realiza el administrador" (vista admin mínima del piloto, según lo permitido por el WP).

### Tarea 6 — Patrocinador (dimensión país/institución)
- `programas_patrocinados` gana `pais_codigo`/`institucion_id` (opcional = toda la cohorte) — en 0016.
- `supabase/migrations/0017_patrocinador_filtro_institucion.sql` (nueva, aditiva): las **9 RPC de
  agregados aceptan filtro opcional** `p_institucion uuid default null, p_pais text default null`,
  acotando la cohorte, **manteniendo k-anonimato ≥5** (el corte se aplica sobre la cohorte ya filtrada:
  un subconjunto <5 se suprime igual). Cambia la firma → se hace DROP + CREATE (aditivo, no edita
  0010/0013); se preserva el fix `#variable_conflict use_column` de 0013 en las 5 funciones que lo tenían;
  se reaplican los `revoke ... from anon` sobre las nuevas firmas.
- El caller TS (`src/lib/patrocinador/proveedor.ts`) sigue pasando SOLO `p_programa_id`; los nuevos
  parámetros toman su default (null) → **sin regresión** en el dashboard.
- **Mejora anotada (declarada, fuera de sprint):** el DESGLOSE por institución/país en la UI del dashboard.
  Esta entrega deja la CAPACIDAD en las RPC; añadir un selector de país/institución al dashboard del
  patrocinador es trabajo incremental posterior (el modo demo es sintético en TS y no ejecuta estas RPC).

---

## 2. Archivos creados / modificados

**Creados**
- `supabase/migrations/0016_instituciones_pais.sql`
- `supabase/migrations/0017_patrocinador_filtro_institucion.sql`
- `docs/wp/entregas/WP-22-entrega.md` (este archivo)

**Modificados**
- `src/types/db.ts`
- `supabase/seed.sql`, `supabase/seed_wp06_segundo_profesional.sql`
- `supabase/tests/acceso_cruzado.sql`
- `src/lib/enrolamiento/nucleo.ts`, `src/lib/enrolamiento/nucleo.test.ts`
- `src/app/(panel)/pacientes/acciones.ts`, `src/app/(panel)/pacientes/page.tsx`
- `src/lib/panel/datos.ts`, `src/lib/panel/lista.ts`, `src/lib/panel/tipos.ts`, `src/lib/panel/panel.test.ts`
- `src/components/panel/FormularioNuevoPaciente.tsx`, `src/components/panel/ListaPacientes.tsx`
- `src/components/panel/ficha/CabeceraFicha.tsx`
- `src/app/(panel)/configuracion/page.tsx`

Ninguna migración ya entregada (0001..0015) fue editada. `es_profesional_de` se reescribió sin cambiar firma.

---

## 3. Políticas / funciones RLS TOCADAS (para verificación en vivo)

| Objeto | Migración | Cambio | Impacto |
| --- | --- | --- | --- |
| **`es_profesional_de(uuid)`** | 0016 | **REESCRITA** (mismo firma): visibilidad admin OR comparte institución activa | **TODAS** las políticas que lo usan cambian de "mis asignados" a "los de mi(s) institución(es)": `perfiles`, `pacientes`, `pautas_medicacion`, `checkins`, `mensajes`, `observaciones`, `tomas_medicacion`, `reglas_escalado`, `alertas`, `consentimientos`, `programas`, `programas_paciente`, `instrumentos_respuestas`, y `storage.objects` (audios) |
| `paises_*`, `instituciones_*`, `prof_inst_*` | 0016 | Políticas NUEVAS | catálogo legible por profesional/admin; membresías solo propias; escritura admin |
| `patro_*` (9 RPC) | 0017 | DROP + CREATE con 2 params opcionales | k-anon intacto; firma nueva `(uuid,uuid,text)`; revokes anon reaplicados |

Ninguna política se reescribió a mano: todas heredan el modelo vía `es_profesional_de` (ese es el diseño de ADR-004).

---

## 4. Tests que CAMBIARON de expectativa (verificar en vivo el porqué)

Los 243 previos siguen pasando salvo adaptaciones legítimas del modelo; total **247** (los 4 nuevos + adaptados):

1. `src/lib/enrolamiento/nucleo.test.ts`
   - `ENTRADA_BASE` incorpora `institucionId` (ahora obligatorio en el esquema).
   - El puerto mock registra `institucionId`; las aserciones de `reg.vinculados` incluyen la institución
     reenviada (antes `{userId, profesionalId}`, ahora `{userId, profesionalId, institucionId}`).
   - **Nuevo** test: el esquema exige institución (uuid válido).
   - El bloque "RLS" añade una comprobación de que 0016 reescribe `es_profesional_de` por institución
     (lee la migración); se ajustó el comentario que decía "profesional_id = auth.uid()".
2. `src/lib/panel/panel.test.ts`
   - El helper `pac()` añade `institucionId`/`institucionNombre` (nuevos campos de `PacienteLista`).
   - **Nuevo** bloque: `filtrarPorInstitucion` + `institucionesDeLista`.

Motivo común: el modelo pasó de "paciente↔profesional directo" a "paciente↔institución". Ningún test se
debilitó; los cambios reflejan el nuevo invariante.

---

## 5. Matriz de acceso ACTUALIZADA (por institución, WP-22)

Seed: García ∈ A · Vega ∈ {A,B} · Ruiz ∈ B · Pacientes de García ∈ A · Marta ∈ B · Patrocinador: solo agregados.

| Actor (rol) | Pacientes de A | Pacientes de B (Marta) | Catálogo `paises`/`instituciones` | `profesionales_instituciones` | Tablas clínicas ajenas |
| --- | --- | --- | --- | --- | --- |
| García (prof, A) | ✅ ve todos | ❌ | ✅ lee | solo la suya (A) | según institución |
| Ruiz (prof, B) | ❌ | ✅ ve Marta | ✅ lee | solo la suya (B) | según institución |
| **Vega (prof, A+B)** | ✅ | ✅ | ✅ lee | las 2 suyas (A,B) | de A y de B |
| Paciente (p.ej. María) | solo lo suyo | ❌ | ❌ 0 filas | ❌ 0 filas | ❌ |
| Admin | ✅ | ✅ | ✅ / escribe | ✅ todas | ✅ |
| Patrocinador | ❌ (0 filas) | ❌ | ❌ | ❌ | ❌ solo RPC k-anon |

**Cambio deliberado vs. F1:** un profesional ve a TODOS los pacientes de su institución, no solo a los de
su `profesional_id` (equipo de la institución; decisión del fundador en ADR-004).

---

## 6. Verificación ejecutada (salida literal)

**`npm run lint`** → sin errores:
```
eslint exit: 0
```

**`npm run test`** (vitest run):
```
 Test Files  23 passed (23)
      Tests  247 passed (247)
```

**`npm run build`** (next build):
```
✓ Compiled successfully in 32.6s
  Finished TypeScript in 28.3s ...
✓ Generating static pages using 3 workers (26/26) in 1089ms
build exit: 0
```

**Parseo SQL** (pg-query-emscripten 5.1.0, instancia fresca por archivo — no está en las deps del
proyecto; se instaló en el scratchpad, fuera del repo):
```
OK   migrations/0016_instituciones_pais.sql               (26 sentencias top-level)
OK   migrations/0017_patrocinador_filtro_institucion.sql  (27 sentencias top-level)
OK   seed.sql                                              (16 sentencias top-level)
OK   seed_wp06_segundo_profesional.sql                    (9 sentencias top-level)
OK   tests/acceso_cruzado.sql                             (14 sentencias top-level)
```
Nota: pg_query valida la gramática SQL de nivel superior; NO parsea en profundidad el cuerpo plpgsql de
las funciones (es opaco). El cuerpo de las RPC de 0017 se replicó fielmente de 0010/0013 (solo se
añadieron el filtro de cohorte y los 2 parámetros) y se re-verifica EN VIVO.

---

## 7. Guion para el director — aplicar 0016/0017 y correr `acceso_cruzado.sql` EN VIVO

```bash
# 1) Reset local con TODAS las migraciones (0001..0017) + seed base
supabase db reset

# 2) Segundo profesional + Marta + su institución (WP-06/WP-22)
psql "$DATABASE_URL" -f supabase/seed_wp06_segundo_profesional.sql

# 3) Acceso cruzado EN VIVO (RLS aplicada; transacción con ROLLBACK, no altera datos)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/acceso_cruzado.sql
# Debe imprimir varias líneas «OK: …» y terminar con «ACCESO CRUZADO: TODO OK».
```

`acceso_cruzado.sql` incluye ahora los escenarios **9** (Vega A+B ve a los pacientes de ambas
instituciones), **10** (catálogo legible por profesional; cada profesional ve SOLO sus membresías) y
**11** (un paciente no lee catálogo ni membresías), además de los 1-8 previos (que siguen siendo válidos).

**Para aplicar al Supabase vivo (producción):** aplicar 0016 y 0017 en orden. Comprobar advisors de
Supabase tras aplicar (RLS/índices).

---

## 8. Dudas / riesgos

1. **RIESGO OPERATIVO PRINCIPAL — backfill de `institucion_id`.** Con la nueva `es_profesional_de`, un
   paciente con `institucion_id = NULL` **no es visible para ningún profesional** (consecuencia deliberada
   del modelo por institución). El backfill del seed cubre SOLO la cohorte demo (las 10 de García + Marta).
   **Si el Supabase vivo tuviera pacientes reales fuera del seed, quedarían invisibles hasta backfillearlos.**
   Recomendación para el director tras aplicar 0016: `select count(*) from pacientes where institucion_id is null;`
   y asignar institución a cualquier huérfano antes de dar por buena la migración.
2. **k-anonimato del patrocinador con el nuevo filtro.** El filtro de 0017 acota la cohorte ANTES del corte
   ≥5, por lo que cualquier subconjunto por institución/país <5 se suprime igual. No abre vía a cortes
   pequeños. Aun así, conviene re-verificar en vivo con la cohorte real (el corte por institución podría
   dejar cohortes <5 que el dashboard debe mostrar como "datos insuficientes").
3. **Admin sin membresías.** Un admin no tiene filas en `profesionales_instituciones`; para el alta y el
   loader de instituciones se le ofrecen TODAS las activas (puede adscribir a cualquiera). Es intencional.
4. **Dashboard del patrocinador por institución/país:** declarado como mejora anotada (no incluido). La
   capacidad está en las RPC (0017); falta el selector en la UI.
5. **Catálogo visible al paciente:** por diseño (ADR-004) el catálogo país/instituciones NO es legible por
   el paciente. La app del paciente no muestra su institución; si en el futuro se quisiera, habría que
   añadir una política de lectura acotada (p. ej. su propia institución).

## 9. Observaciones sobre el WP/ADR (anotadas, NO "arregladas")

- WP-22 §2 permite reescribir `es_profesional_de` "en 0016 o 0017"; se hizo en **0016** (junto con las
  tablas de las que depende) para que la migración quede autoconsistente. Correcto según el WP.
- ADR-004 no fija un `default` para `instituciones.tipo`; se puso `default 'clinica'` (el seed siempre lo
  especifica, así que no afecta a los datos demo). Anotado por si se prefiere otro default.
- WP-22 §6 pide filtro opcional en las RPC (implementado) y permite dejar el desglose del dashboard como
  mejora anotada (así se dejó, declarado en §1/§8).
