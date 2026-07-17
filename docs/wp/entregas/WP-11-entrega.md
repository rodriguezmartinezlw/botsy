# WP-11 v2 — Entrega: núcleo de programas ONCOLOGÍA + disposición estructurada

**Fecha:** 2026-07-17 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde. Migraciones nuevas (0006–0008) validadas con el parser real de Postgres (libpg_query). Construido sobre F1 + WP-10; ninguna migración commiteada (0001–0005) editada.

---

## 1. Resumen

Se implementa el alcance completo de WP-11 v2 (A + B + C + D):

- **A. Arquitectura de programas.** Tablas `programas` y `programas_paciente` (RLS + UNIQUE parcial de un programa activo por paciente). `src/lib/programas/config.ts` con `EsquemaConfigPrograma` (Zod, forma canónica) + `configEfectiva` (deep-merge validado con fallback seguro, puro y testeado). Runtime `obtenerProgramaActivo`/`obtenerConfigEfectiva` y **gating server-side** de módulos en las rutas del check-in. Check-in **dirigido por programa** (`construirContexto` lee el programa; dominios activos + `preguntas_extra` + `estilo` + guía CTCAE entran en `construirInstrucciones` como sección `# PROGRAMA`, y la checklist se acota al subconjunto). Pestaña **Programa** en la ficha 360º (asignar plantilla, config efectiva en lenguaje humano SIN JSON, overrides con toggles, suspender/reactivar; activación **idempotente** de reglas clave con `obtenerSesionPanel` + auditoría).
- **B. Disposición estructurada obligatoria (regla de oro 3).** Tablas `disposiciones` + `catalogo_motivos` (RLS incluida; seed `[PENDIENTE CLÍNICO]`). Las Server Actions `resolverAlerta` y `descartarAlerta` **EXIGEN** una disposición completa (decisión codificada + motivo del catálogo + `dias_seguimiento`) validada con Zod estricto: sin ella, la mutación se rechaza. Vista **"Desenlaces pendientes"** en el panel con registro del desenlace en 2 clics y badge de recuento. Todo auditado.
- **C. Contenido oncológico (mama).** Seed de 2 programas (`mama_terapia_oral`, `mama_tratamiento_activo`). Catálogo CTCAE simplificado es-ES en `src/lib/ia/vocabulario-onco.ts`. Reglas seed oncológicas (dentro de `escalado.reglas_clave` de cada programa, todas `[PENDIENTE CLÍNICO]`): fiebre ≥38 en tratamiento activo → **urgencia**; fiebre ≥38 en oral → contactar; diarrea intensa → contactar; vómitos que impiden ingesta → contactar; dolor ≥7 sostenido 2 días → contactar. Rango de `fiebre` en °C (34–43) conviviendo con las escalas 0–10 en el schema Zod de observaciones. Discontinuación codificada: `pautas_medicacion.motivo_discontinuacion` (FK `catalogo_motivos`); el panel pide el motivo al discontinuar.
- **D. Consentimiento `uso_secundario`.** Migración que amplía `consentimientos.tipo`; opt-in SEPARADO en la pantalla de consentimientos, texto `[PENDIENTE LEGAL]`, revocable, trazado; ninguna funcionalidad depende de él.

---

## 2. Archivos

### Migraciones nuevas (RLS en la misma migración; ninguna commiteada editada)
- `supabase/migrations/0006_programas.sql` — `programas`, `programas_paciente` (UNIQUE parcial `estado='activo'`), columna `reglas_escalado.programa_paciente_id`, helper `es_profesional_o_admin()`, RLS + seed de 2 programas de mama.
- `supabase/migrations/0007_disposiciones.sql` — `catalogo_motivos`, `disposiciones`, `pautas_medicacion.motivo_discontinuacion`, helper `paciente_de_alerta()`, RLS + seed del catálogo `[PENDIENTE CLÍNICO]`.
- `supabase/migrations/0008_consentimiento_uso_secundario.sql` — amplía el check de `consentimientos.tipo` con `uso_secundario`.

### Nuevos módulos
- `src/lib/programas/config.ts` — `EsquemaConfigPrograma`, `CONFIG_POR_DEFECTO`, `configEfectiva` (deep-merge + fallback), `reglasClavePendientes` (idempotencia), `moduloActivo`. Puro.
- `src/lib/programas/config.test.ts` — merge plantilla+override, inválido→fallback, idempotencia de reglas.
- `src/lib/programas/servidor.ts` — `obtenerProgramaActivo`, `obtenerConfigEfectiva`, `obtenerContextoPrograma`, `moduloActivoPaciente` (gating). Server-only.
- `src/lib/programas/describir.ts` — config efectiva → líneas legibles (sin JSON) para la pestaña Programa.
- `src/lib/ia/vocabulario-onco.ts` — catálogo CTCAE simplificado es-ES + guía para el prompt + rango °C.
- `src/lib/ia/programa-checkin.test.ts` — instrucciones con `preguntas_extra`/`estilo`/subconjunto de dominios; sin programa = F1.
- `src/lib/disposiciones/nucleo.ts` — vocabularios, `esquemaDisposicion` estricto, `validarDisposicion`, `esquemaRegistrarDesenlace`, lógica de desenlaces pendientes vencidos. Puro.
- `src/lib/disposiciones/nucleo.test.ts` — rechazo sin disposición; desenlaces pendientes por vencimiento.
- `src/lib/escalado/onco-reglas.test.ts` — reglas oncológicas en el motor (fiebre 38.5 activo→urgencia; 37.5→nada; diarrea; dolor sostenido).
- `src/app/(panel)/pacientes/[id]/programa-acciones.ts` — asignar/suspender/reactivar programa + override de módulo; sincroniza reglas clave de forma idempotente.
- `src/app/(panel)/desenlaces/page.tsx` + `src/components/panel/DesenlacesPendientes.tsx` — vista "Desenlaces pendientes".
- `src/components/panel/ficha/PanelPrograma.tsx` — pestaña Programa.

### Modificados
- `src/types/db.ts` — nuevos enums/rows/inserts (Programa, ProgramaPaciente, CatalogoMotivo, Disposicion), columnas nuevas en ReglaEscalado/PautaMedicacion, `uso_secundario` en TipoConsentimiento, tablas en `BaseDatos`.
- `src/lib/ia/conversacion.ts` — `ProgramaContexto`, carga del programa en `construirContexto`, sección `# PROGRAMA` + filtrado de dominios en `construirInstrucciones`.
- `src/lib/ia/schemas.ts` — `valor_num` dependiente del código (fiebre 34–43 °C vía `superRefine`, resto 0–10).
- `src/app/(panel)/alertas/acciones.ts` — `resolver`/`descartar` exigen disposición; `registrarDesenlace`; `marcarVista` conservada.
- `src/lib/panel/tipos.ts` y `src/lib/panel/datos.ts` — tipos y loaders de disposición/motivos/desenlaces/programa; bandeja adjunta la disposición.
- `src/components/panel/BandejaAlertas.tsx` — formulario de disposición (decisión + motivo del catálogo + días).
- `src/app/(panel)/alertas/page.tsx`, `src/app/(panel)/layout.tsx`, `src/components/panel/NavLateral.tsx` — carga de motivos, badge de desenlaces, entrada "Desenlaces".
- `src/app/(panel)/pacientes/[id]/acciones.ts` + `page.tsx`, `FichaPacienteTabs.tsx`, `PanelMedicacion.tsx` — discontinuación codificada + pestaña Programa.
- Gating server-side en `src/app/api/checkin/iniciar/route.ts`, `.../mensaje/route.ts`, `src/app/api/voz/sesion/route.ts`.
- Consentimiento `uso_secundario`: `src/lib/consentimientos/{estado,textos}.ts`, `src/app/(paciente)/consentimientos/acciones.ts`, y mapas exhaustivos en `ConsentimientosVigentes.tsx`, `InformeVista.tsx`, `LineaTemporal.tsx`.
- `src/lib/consentimientos/estado.test.ts` — actualizado el estado vacío para incluir `uso_secundario` (cambio de dominio, no regresión).

---

## 3. Decisiones propias (no explícitas en el WP)

1. **Materialización de reglas por programa.** Las reglas oncológicas viven en `escalado.reglas_clave` de cada programa y se materializan como filas de `reglas_escalado` del paciente al asignar (WP-11 §A.5). Para trazarlas e idempotentar la activación/limpieza añadí `reglas_escalado.programa_paciente_id` (FK a la asignación, `on delete cascade`). Idempotencia por asignación: no se reinsertan reglas cuyo `nombre` ya exista para esa asignación; al suspender se hace `activa=false` (no se borran); al reactivar `activa=true` + re-sync. El helper puro `reglasClavePendientes` (probado) implementa la misma idea por `clave`.
2. **`disposiciones.motivo_codigo` es FK a `catalogo_motivos(id)`.** El PLAN §4.1 nombra el campo `motivo_codigo FK catalogo_motivos`, pero `catalogo_motivos.codigo` sólo es único por ámbito (`unique(ambito, codigo)`), no globalmente. Para integridad referencial la FK apunta al `id` de la fila, conservando el nombre `motivo_codigo` del PLAN. Igual criterio en `pautas_medicacion.motivo_discontinuacion`.
3. **RLS de `programas` (catálogo).** El WP pide "SELECT profesional/admin". Añadí además una política `programas_select_asignado` que deja al paciente leer ÚNICAMENTE el programa que tiene asignado (necesario para que `construirContexto` dirija el check-in ejecutándose como el paciente); no puede navegar el catálogo completo.
4. **Rango de `fiebre` en el schema Zod.** Para que 34–43 °C (fiebre/temperatura) conviva con 0–10 sin ampliar el rango del resto, `valor_num` pasa a validarse por código con `superRefine` (`rangoValorNum`). Efecto lateral: el JSON Schema de la tool ya no publica los límites 0–10 estáticos; la guía va en el prompt (`guiaVocabularioOnco`). Un dolor "38" sigue siendo inválido.
5. **Gating server-side** aplicado en los Route Handlers del check-in (texto: `/api/checkin/iniciar` y `/mensaje`; voz: `/api/voz/sesion`) devolviendo 403 aunque se llame directo. Paciente sin programa = `CONFIG_POR_DEFECTO` (todos los módulos activos) → F1 intacto.
6. **Suspender vs. desactivar-por-error vs. discontinuar** en medicación: se conservan "Desactivar (error)" y "Reactivar" (WP-10) y se añade "Discontinuar…" que exige motivo codificado del catálogo (§C.4).

---

## 4. Cómo se validaron las migraciones

Sin Supabase CLI/Docker en el entorno (igual que en F1). Dos capas:

1. **Parser real de Postgres** (libpg_query vía `pg-query-emscripten@5.1.0`) sobre las 8 migraciones. Salida:
   ```
   OK   0001_esquema_inicial.sql: 19 statements parsed
   OK   0002_rls.sql: 66 statements parsed
   OK   0003_reglas_semilla.sql: 1 statements parsed
   OK   0004_informes.sql: 6 statements parsed
   OK   0005_deuda_tecnica.sql: 4 statements parsed
   OK   0006_programas.sql: 19 statements parsed
   OK   0007_disposiciones.sql: 15 statements parsed
   OK   0008_consentimiento_uso_secundario.sql: 2 statements parsed
   TODAS OK
   ```
2. **Revisión manual** de lo que el parser no comprueba: RLS + al menos una política en cada tabla nueva (programas, programas_paciente, catalogo_motivos, disposiciones); orden de FKs (programas → programas_paciente → reglas_escalado.programa_paciente_id; alertas → disposiciones); `on delete` (cascade en asignación→reglas y alerta→disposición; set null en FKs de catálogo); UNIQUE parcial (`programas_paciente` activo por paciente) y UNIQUE `disposiciones.alerta_id`; JSONB de `config` de los 2 programas validado contra `EsquemaConfigPrograma` desde los tests. `[PENDIENTE CLÍNICO]` en todos los umbrales y en el catálogo; `[PENDIENTE LEGAL]` en el texto de uso secundario.

> Pendiente de verificación en vivo (como en F1): aplicar en orden sobre proyecto real con `supabase db reset` cuando haya entorno.

---

## 5. Verificación (salida literal)

### `npm run build`
```
▲ Next.js 16.2.10 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 24.6s
  Running TypeScript ...
  Finished TypeScript in 22.1s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (23/23) in 932ms
  Finalizing page optimization ...
Route (app)
┌ ○ /
├ ƒ /alertas
├ ƒ /desenlaces            (nueva)
├ ƒ /pacientes/[id]
└ ○ /registro
(23 rutas compiladas)
```

### `npm run lint`
```
> botsy@0.1.0 lint
> eslint
(sin errores)
```

### `npm test`
```
 Test Files  15 passed (15)
      Tests  161 passed (161)
```
(122 previos + 39 nuevos; ninguno roto. `estado.test.ts` ajustado por el nuevo tipo de consentimiento, no es regresión.)

Tests añadidos: `config.test.ts` (13), `programa-checkin.test.ts` (5), `nucleo.test.ts` disposiciones (13), `onco-reglas.test.ts` (8) → cubren merge de config y fallback, gating (decisión pura `moduloActivo` + config por defecto), instrucciones con `preguntas_extra`/`estilo`, idempotencia de activación de reglas, resolver/descartar SIN disposición → rechazado, desenlaces pendientes por vencimiento, reglas oncológicas en el motor (fiebre 38.5→urgencia, 37.5→nada), y paciente sin programa = F1.

---

## 6. Demostración

**(a) Asignar `mama_terapia_oral` y check-in con preguntas de fiebre/adherencia.**
En la ficha del paciente → pestaña **Programa** → seleccionar "Mama · Terapia oral" → *Asignar programa*. `programas_paciente` queda `activo` y se materializan sus 4 reglas clave en `reglas_escalado` del paciente. En el siguiente check-in, `construirContexto` carga el programa y `construirInstrucciones` inyecta la sección `# PROGRAMA` con las preguntas "¿Te has tomado la temperatura? ¿Has tenido fiebre?", diarrea y fatiga, acota la checklist a `adherencia`/`sintomas_fisicos`/`animo`, y añade la guía CTCAE (fiebre en °C). Cubierto por el test `programa-checkin.test.ts`.

**(b) Resolver una alerta EXIGE disposición.**
`resolverAlerta({ alertaId })` sin decisión/motivo/días → `validarDisposicion` devuelve error y la mutación se rechaza; no hay ruta para cerrar una alerta sin `disposiciones` (además `disposiciones.alerta_id` es UNIQUE). La bandeja presenta el formulario de 3 selects (decisión + motivo del catálogo + días) y sólo confirma con todo. Cubierto por `nucleo.test.ts` (rechazos) y por el flujo de la Server Action.

**(c) Fiebre 38.5 en tratamiento activo → urgencia.**
Regla `fiebre_activo` del programa `mama_tratamiento_activo`: `{ observacion, dominio: sintoma_fisico, codigo: fiebre, valor_num_gte: 38 }`, nivel `urgencia`. `evaluarReglas` con una observación de fiebre 38.5 → `nivel: "urgencia"`; con 37.5 → `normal`. Cubierto por `onco-reglas.test.ts`.

---

## 7. Dudas / riesgos

- **A. JSON Schema de la tool sin límites 0–10 explícitos.** Al mover el rango de `valor_num` a `superRefine`, la definición de la tool para el LLM ya no publica `minimum/maximum`; la validación real sigue en Zod (rechaza fuera de rango) y la guía va en el prompt. Si se prefiere volver a exponer los bounds, habría que un esquema por código o mantener un tope amplio en el JSON Schema y el rango fino en la validación.
- **B. `preguntas_extra.dominio` usa el vocabulario de CHECKLIST** (`sintomas_fisicos`), no el de `observaciones.dominio` (`sintoma_fisico`). Es intencional (orienta la checklist), pero conviene tenerlo presente al leer el seed.
- **C. Frecuencia del check-in / `instrumentos.termometro_distres`** quedan declarados en la config pero aún inertes (los consumen el cron de recordatorios y WP-16). El termómetro va `activo:false` a propósito para no insinuar una función no construida.
- **D. Idempotencia de reglas por `nombre` dentro de la asignación** (servidor) vs. por `clave` (helper puro testeado). Si dos reglas de un mismo programa compartieran `nombre`, la deduplicación del servidor las colapsaría; los seeds actuales tienen nombres únicos por programa.
- **E. Un solo programa activo por paciente** se refuerza en BD (UNIQUE parcial) y en la acción (mensaje amable). Cambiar de programa requiere suspender el activo primero (decisión conservadora).
- **F. No detecté errores en el WP/PLAN**, salvo la ambigüedad del nombre `motivo_codigo` (decisión 2 de §3), que resolví sin "arreglar" el documento.

### Fuera de alcance respetado
Termómetro NCCN (WP-16 — sólo el hueco `instrumentos`), dashboard patrocinador y **seed demo oncológico** (WP-17 — por eso `seed.sql` NO se toca; la demo se hace asignando el programa a mano), ROI (WP-15), farmacovigilancia (WP-18), pediatría/menores (WP-19 — no se introdujo nada que rompa la futura regla "la IA no conversa con menores"), módulos aparcados (tareas/diario/fotos/Alzheimer).
