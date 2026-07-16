# Entrega WP-06 — Dashboard profesional

**Fecha:** 2026-07-16 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde (67 tests, +16 sobre los 51 previos). SQL del seed adicional validado con el parser real de Postgres (libpg_query).

---

## 1. Qué se hizo

El panel `(panel)` completo del profesional, sobre WP-01/02/04/05:

- **`(panel)/pacientes`** — Lista con búsqueda por nombre (insensible a acentos, cliente). Por paciente: semáforo, avatar (inicial o `avatar_url`), nombre, edad, vertical, **adherencia 7 días (%)**, **último check-in** ("Hoy/Ayer/Hace N días", con aviso ámbar si >2 días o sin check-ins). **Orden por defecto**: mayor riesgo primero (nivel de la alerta abierta más grave), luego más días sin check-in ("nunca" cuenta como máximo). Todo el orden y el cálculo es lógica **pura** testeada; la página sólo lee (RLS) y pinta.
- **`(panel)/pacientes/[id]` — ficha 360º** con 3 pestañas:
  - **Cabecera**: datos (edad, sexo, vertical), condiciones (chips), racha actual/máxima, botón **"Ver informe"** (deshabilitado, placeholder → WP-07) y botón **teléfono** (`tel:` al teléfono del paciente).
  - **Resumen** = **línea temporal unificada** (columna central, paginada "Ver más") que mezcla cronológicamente check-ins (resumen → **transcript** completo al expandir), alertas (con **evidencia** legible), altas de medicación y consentimientos + **columna de tendencias** (dolor, ánimo/ansiedad/estrés y adherencia semanal) **reutilizando los componentes de gráfico de WP-05** en compacto.
  - **Medicación**: pautas activas/históricas; **alta / edición / desactivación-reactivación** (fármaco, dosis, momentos, crítica) → escribe `pautas_medicacion` + `eventos_auditoria`.
  - **Reglas**: reglas **globales aplicables (solo lectura)** descritas en lenguaje llano + **reglas propias del paciente** (crear desde **plantillas amigables**, activar/desactivar). Las plantillas generan el **JSONB de `condicion` de WP-04**; **no hay editor JSON crudo**.
- **`(panel)/alertas` — bandeja** priorizada (urgencia > contactar > vigilancia, luego por fecha), con **filtros** estado/nivel/paciente. Cada alerta es expandible (motivo, evidencia = observaciones + fragmento/conversación, enlace a la ficha) y gestionable: **marcar vista**, **resolver** (nota opcional), **descartar** (motivo **OBLIGATORIO**, mín. 3 caracteres). Toda acción → `eventos_auditoria`. **Badge** con nº de alertas nuevas en el sidebar y en el título de la página.
- **`(panel)/configuracion`** — F1 mínimo: nombre y teléfono de contacto que ven sus pacientes (actualiza su propio `perfiles`).

**Regla de oro cumplida:** todas las lecturas de datos de pacientes usan el **cliente de servidor** (`crearClienteServidor`); la RLS de profesional de WP-01 hace el aislamiento. **No se usa `admin.ts`/service-role en ningún punto de WP-06.** Todas las mutaciones son **Server Actions** con validación **Zod** y comprobación de sesión interna (Next 16). TypeScript estricto, **sin `any`**.

---

## 2. Archivos

### Creados — lógica pura (testeada)
- `src/lib/panel/lista.ts` — edad, días sin check-in, semáforo, `ordenarPacientes`, `filtrarPacientes`, `PESO_NIVEL`.
- `src/lib/panel/bandeja.ts` — `ordenarBandeja`, `filtrarBandeja`, `esAlertaAbierta`.
- `src/lib/panel/reglas-plantillas.ts` — catálogo de plantillas, `construirReglaDesdePlantilla` (→ JSONB de WP-04), `describirCondicion` (JSONB → español), niveles amigables.
- `src/lib/panel/panel.test.ts` — 16 tests (orden lista, prioridad bandeja, generación+round-trip de plantillas contra el motor de WP-04, descripción de condiciones).

### Creados — carga de datos (server-only) y sesión
- `src/lib/panel/tipos.ts` — tipos presentacionales (ficha, timeline, tendencias, pauta, regla, alerta, `ResultadoAccion`).
- `src/lib/panel/datos.ts` — `listarPacientes`, `cargarFichaPaciente`, `cargarAlertasBandeja`, `cargarConfiguracion`, `contarAlertasNuevas` (todo con cliente de servidor).
- `src/lib/panel/sesion-panel.ts` — `obtenerSesionPanel` (profesional/admin) + `registrarAuditoria`.

### Creados — Server Actions (`"use server"`)
- `src/app/(panel)/pacientes/[id]/acciones.ts` — `altaPauta`, `editarPauta`, `cambiarEstadoPauta`, `crearReglaPaciente`, `cambiarEstadoRegla`.
- `src/app/(panel)/alertas/acciones.ts` — `marcarVista`, `resolverAlerta`, `descartarAlerta`.
- `src/app/(panel)/configuracion/acciones.ts` — `guardarConfiguracion`.

### Creados — componentes
- `src/components/panel/niveles.ts`, `Semaforo.tsx`, `BadgeNivel.tsx`, `EvidenciaAlerta.tsx`, `ListaPacientes.tsx`, `BandejaAlertas.tsx`, `FormularioConfiguracion.tsx`.
- `src/components/panel/ficha/CabeceraFicha.tsx`, `FichaPacienteTabs.tsx`, `LineaTemporal.tsx`, `ColumnaTendencias.tsx`, `PanelMedicacion.tsx`, `PanelReglas.tsx`.

### Creados — página y seed
- `src/app/(panel)/pacientes/[id]/page.tsx` — ficha 360º.
- `supabase/seed_wp06_segundo_profesional.sql` — **seed aditivo** (Dr. Ruiz + su paciente Marta) para demostrar el aislamiento (ver §6).

### Modificados
- `src/app/(panel)/pacientes/page.tsx` — de placeholder a lista real.
- `src/app/(panel)/alertas/page.tsx` — de placeholder a bandeja real (título con nº de nuevas).
- `src/app/(panel)/configuracion/page.tsx` — de placeholder a formulario real.
- `src/app/(panel)/layout.tsx` — carga `contarAlertasNuevas()` y lo pasa al sidebar.
- `src/components/panel/NavLateral.tsx` — badge de alertas nuevas en el ítem "Alertas".

### No tocados
No se añadieron variables de entorno (WP-06 no introduce ninguna): `.env.example` intacto. `docs/` sólo este archivo de entrega. Se reutilizaron **sin modificar** los componentes de gráfico de WP-05 (`src/components/graficos/*`), `src/lib/agregados.ts`, `src/lib/escalado/motor.ts` (tipos + `parsearCondicion`) y los clientes/tipos de WP-01.

---

## 3. Decisiones propias (no especificadas en el WP)

1. **Semántica "dolor > 7" con operadores del motor.** El JSONB de WP-04 sólo tiene `valor_num_gte`/`valor_num_lte` (no `>` estricto). La plantilla "Dolor elevado" se expresa como **"llega a X o más"** y genera `valor_num_gte: X`. Para el "dolor > 7" del criterio de aceptación se crea con **umbral 8** (dolor ≥ 8 ≡ dolor > 7). Hay un test que verifica que la regla generada **dispara con 8 y no con 7**.
2. **La plantilla de omisión de fármaco NO es por-fármaco.** El WP-06 la enuncia como "…si omite **[fármaco]** N días", pero el tipo `adherencia_critica` de WP-04 sólo lleva `dias_consecutivos` y el motor evalúa la omisión de **cualquier** fármaco marcado como crítico (no admite `pauta_id`). Se implementó fiel a WP-04: la plantilla dice "…si deja de tomar su **medicación importante** N días". La granularidad por fármaco exigiría ampliar el formato de `condicion` y el motor (fuera de alcance; ver §5-A, anotado, **no** "arreglado").
3. **Nivel de la regla elegible por el profesional.** Cada plantilla trae un nivel por defecto sensato (dolor/omisión → contactar, ánimo → vigilancia) pero el profesional puede cambiarlo con etiquetas amigables ("Seguimiento", "Contactar con el paciente", "Urgente"), sin ver la jerga `vigilancia/contactar/urgencia`.
4. **Timeline: las altas de medicación se toman de `pautas_medicacion` (creado_en), no de la auditoría.** `eventos_auditoria` sólo es legible por admin (RLS de WP-01), así que el profesional no puede construir la línea temporal desde ahí. Consecuencia: se muestran **altas** de pauta (fechadas por `creado_en`) y el estado actual (activa/desactivada), pero **no un evento fechado de "desactivación"**, porque el esquema no tiene `desactivada_en` legible por el profesional. La desactivación **sí** queda en `eventos_auditoria` (para admin/cumplimiento). Ver §5-B.
5. **Paginación de la línea temporal en cliente** ("Ver más", 12 en 12) sobre los eventos ya cargados, en vez de por `searchParams` en servidor: menos round-trips y misma UX; el volumen F1 por paciente es pequeño.
6. **Búsqueda de pacientes y filtros de la bandeja en cliente** sobre la lista ya leída y ordenada en servidor (la ordenación/priorización es la lógica pura testeada). Instantáneo y sin fetch adicional.
7. **Tendencias compactas: ventana de 1 mes** (dolor en área, ánimo/ansiedad/estrés en líneas, adherencia semanal L–D + % de 7 días por fármaco). Reutiliza `GraficoAreaTemporal`, `GraficoLineas` y `PuntosAdherencia` de WP-05 y `@/lib/agregados` (puro); **no** se duplicó ni se tocó el loader de WP-05 (`perfil/datos.ts`) para no arriesgar sus 19 tests.
8. **"Ver informe" es un botón deshabilitado** con `title` explicativo (placeholder de WP-07), no un enlace a una ruta inexistente (evita 404).
9. **Auditoría con `actor_id` = profesional.** Las acciones del panel escriben `eventos_auditoria` con `actor_id = auth.uid()` (a diferencia del motor de escalado de WP-04, que usa `actor_id = null` por ser acción del sistema). Acciones registradas: `pauta_alta`, `pauta_edicion`, `pauta_desactivada`/`pauta_reactivada`, `regla_alta`, `regla_activada`/`regla_desactivada`, `alerta_vista`/`alerta_resuelta`/`alerta_descartada`, `perfil_actualizado`.
10. **Colores de semáforo/nivel** (verde→ámbar→naranja→rojo) definidos en `src/components/panel/niveles.ts` con hex explícitos (Tailwind v4 arbitrary values), porque los tokens del tema no incluían un naranja para "contactar".

---

## 4. Verificación

### `npm run build` (exit 0)

```
▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 54s
  Running TypeScript ...
  Finished TypeScript in 32.6s ...
✓ Generating static pages using 3 workers (21/21) in 1089ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /alertas
├ ƒ /api/checkin/finalizar
├ ƒ /api/checkin/iniciar
├ ƒ /api/checkin/mensaje
├ ƒ /api/escalado/contacto
├ ƒ /api/voz/finalizar
├ ƒ /api/voz/sesion
├ ƒ /api/voz/tool
├ ƒ /checkin
├ ƒ /checkin/voz
├ ƒ /configuracion
├ ƒ /consentimientos
├ ƒ /inicio
├ ƒ /login
├ ƒ /pacientes
├ ƒ /pacientes/[id]      ← nueva ruta de la ficha 360º
├ ƒ /perfil
└ ○ /registro
```

### `npm run lint` (exit 0)

```
> botsy@0.1.0 lint
> eslint

```
(Sin salida: ningún error ni warning.)

### `npm test` (exit 0)

```
 ✓ src/lib/ia/checkin-texto.test.ts (8 tests) 37ms
 ✓ src/lib/panel/panel.test.ts (16 tests) 88ms
 ✓ src/lib/agregados.test.ts (19 tests) 71ms
 ✓ src/lib/escalado/motor.test.ts (17 tests) 61ms
 ✓ src/lib/ia/voz-tool.test.ts (7 tests) 26ms

 Test Files  5 passed (5)
      Tests  67 passed (67)
```

Los 51 tests previos siguen verdes; se añaden 16 (`src/lib/panel/panel.test.ts`).

### Validación del seed adicional (parser real de Postgres)

No hay Supabase CLI ni Docker en el entorno (igual que en WP-01), así que el seed nuevo se validó con **libpg_query** (`pg-query-emscripten@5.1.0`, instalado sólo para validar, `--no-save`; `package.json`/`package-lock.json` intactos):

```
OK   supabase/seed.sql — 10 statements
OK   supabase/seed_wp06_segundo_profesional.sql — 8 statements
```

Sigue el patrón exacto del `seed.sql` de WP-01 (ya revisado allí). **Pendiente de `supabase db reset` en vivo** (el bloque de `auth.users`/`auth.identities` depende del esquema interno de GoTrue), como se documentó en WP-01.

---

## 5. Criterios de aceptación

- **Build + lint + tests verdes** → **OK** (§4).
- **Flujo E2E con el seed** (Dra. García) → documentado paso a paso en §7 (no ejecutable en vivo sin Supabase; el WP lo contempla).
- **Aislamiento por profesional + paciente que fuerza URL** → §6.
- **Generación de reglas desde plantillas (JSONB de WP-04, sin JSON crudo)** → §8 + tests.

---

## 6. Demostración del aislamiento por profesional

**Todo el aislamiento lo hace la RLS de WP-01; el código nunca filtra por `profesional_id` a mano ni usa service-role.** Las consultas de `datos.ts` hacen `select` "a pelo" y confían en las políticas:

- `pacientes_select_profesional`: `using (es_profesional_de(id))` → `profesional_id = auth.uid()`.
- `alertas_select_profesional`, `checkins_select_profesional`, `observaciones_*`, `pautas_*`, `consentimientos_*`, `reglas_select_profesional`: todas acotadas por `es_profesional_de(...)`.

**Seed de dos profesionales** (`supabase/seed_wp06_segundo_profesional.sql`, aditivo, no toca el seed de WP-01):

| Profesional | uid | Pacientes asignados |
|---|---|---|
| Dra. García | `…002` | Luis (`…003`), Carmen (`…004`) |
| Dr. Ruiz | `…005` | Marta (`…006`) |

Comprobación esperada con RLS activa (cada uno logueado como sí mismo):

- **Dra. García** → `listarPacientes()` devuelve **sólo Luis y Carmen**. Si fuerza `/pacientes/<id-de-Marta>`, `cargarFichaPaciente` hace `from("pacientes").eq("id", marta)` y la RLS devuelve **0 filas** → la página responde **404** (`notFound()`). Su bandeja **no** incluye la alerta de Marta.
- **Dr. Ruiz** → `listarPacientes()` devuelve **sólo Marta**; su bandeja, **sólo** la alerta "Ánimo bajo sostenido" de Marta. No ve a Luis ni a Carmen.
- **Paciente logueado** que fuerce `/pacientes/*` → el route guard de `(panel)/layout.tsx` (`obtenerRolSesion` → `paciente`) **redirige a `/inicio`** antes de renderizar nada.

En SQL equivalente (lo que ejecuta el cliente de servidor como cada usuario):

```sql
-- Como Dra. García (auth.uid() = …002):
select id from pacientes;            -- → …003, …004   (Marta …006 NO aparece)
-- Como Dr. Ruiz (auth.uid() = …005):
select id from pacientes;            -- → …006          (Luis/Carmen NO aparecen)
select id from alertas;              -- → sólo la de Marta
```

> **Nota (no bloqueante):** las Server Actions de gestión de alertas/pautas/reglas confían en la RLS para el aislamiento de escritura (una acción con un id de otro profesional afecta 0 filas y no lanza; la UI nunca expone ids ajenos). No se comprueba el nº de filas afectadas: es defensa en profundidad, no una fuga (la RLS bloquea el cambio). Se puede endurecer en WP-08 devolviendo error si 0 filas.

---

## 7. Flujo E2E con el seed (Dra. García)

Trazado sobre el código real (no ejecutado en vivo por falta de Supabase; el WP lo permite):

1. **Login** `dra.garcia@botsy.local` / `Botsy1234!` → `rutaPorRol` → `/pacientes`.
2. **`/pacientes`** → `listarPacientes()`: Luis con **semáforo naranja** (tiene una alerta `contactar` abierta "Fármaco crítico omitido") ordenado **antes** que Carmen (verde, sin check-ins). Adherencia 7d de Luis ≈ 86% (warfarina omitida las 2 últimas noches). → **"la Dra. García ve a Luis con semáforo por la alerta abierta"**.
3. **Ficha de Luis** (`/pacientes/…003`): cabecera (68, cardiovascular, condiciones, racha 14), línea temporal (14 check-ins con transcript, la alerta con su evidencia, altas de AAS y warfarina, consentimientos), tendencias (dolor 8→2, ánimo, adherencia semanal por fármaco).
4. **`/alertas`** → la alerta de Luis aparece la primera. **Expandir** (motivo + evidencia + fragmento "Anoche se me volvió a olvidar") → **"Resolver"** con nota → `resolverAlerta` pone `estado='resuelta'`, `gestionada_por=García`, `gestionada_en=now()` y registra `eventos_auditoria(accion='alerta_resuelta', actor_id=García, detalle.nota=…)`. El badge del sidebar baja en 1.
5. **Ficha de Luis → pestaña Reglas → "Añadir regla"** → plantilla **"Dolor elevado"**, umbral **8** (≡ "dolor > 7"), prioridad "Contactar" → `crearReglaPaciente` inserta en `reglas_escalado` `paciente_id=…003`, `condicion={"tipo":"observacion","dominio":"dolor","valor_num_gte":8}`, y registra `eventos_auditoria(accion='regla_alta')`.
6. **Pestaña Medicación → "Añadir pauta"** (fármaco, dosis, momentos, crítica) → `altaPauta` inserta en `pautas_medicacion` y registra `eventos_auditoria(accion='pauta_alta')`.
7. **Resultado en `eventos_auditoria`** (filas nuevas de esta sesión, `actor_id` = Dra. García):

| accion | entidad | detalle (resumen) |
|---|---|---|
| `alerta_resuelta` | alertas | `{ estado:"resuelta", nota:"…" }` |
| `regla_alta` | reglas_escalado | `{ paciente_id:"…003", plantilla:"dolor_alto", nivel:"contactar", condicion:{tipo:"observacion",dominio:"dolor",valor_num_gte:8} }` |
| `pauta_alta` | pautas_medicacion | `{ paciente_id:"…003", farmaco:"…", dosis:"…", momentos:[…], critica:… }` |

---

## 8. Generación de reglas desde plantillas (JSONB de WP-04)

Tres plantillas amigables (`src/lib/panel/reglas-plantillas.ts`), **sin editor JSON crudo**. Cada una produce exactamente el formato que evalúa el motor de WP-04; los tests hacen **round-trip** por su validador (`parsearCondicion`) y, en el caso del dolor, comprueban que el motor lo dispara:

| Plantilla (UI) | Parámetros | `condicion` generada (JSONB de WP-04) |
|---|---|---|
| Dolor elevado | umbral X | `{ "tipo":"observacion", "dominio":"dolor", "valor_num_gte": X }` |
| Medicación importante sin tomar | N días | `{ "tipo":"adherencia_critica", "dias_consecutivos": N }` |
| Ánimo bajo sostenido | umbral X, N días | `{ "tipo":"tendencia", "dominio":"animo", "valor_num_lte": X, "dias_consecutivos": N }` |

`describirCondicion` hace el camino inverso (JSONB → español) para mostrar en solo-lectura las reglas globales y las del paciente. Entrada validada con Zod tanto en el módulo puro como en la Server Action.

---

## 9. Dudas / riesgos detectados (anotados, no "arreglados")

- **A. `adherencia_critica` no es por-fármaco (WP-04 vs. WP-06).** El enunciado de WP-06 pide una plantilla "…si omite [fármaco] N días", pero el formato `condicion` de WP-04 no lleva `pauta_id` y el motor evalúa la omisión de **cualquier** fármaco crítico. Implementado fiel a WP-04 ("medicación importante"). Si se quiere granularidad por fármaco, es una ampliación del formato + del motor (WP-04), no de WP-06.
- **B. Sin evento fechado de "desactivación" de pauta en la línea temporal.** El esquema de `pautas_medicacion` (WP-01) no tiene `desactivada_en` y `eventos_auditoria` no es legible por el profesional (RLS). La línea temporal muestra altas + estado actual; la desactivación queda auditada (para admin). Si se quiere verla en la ficha, haría falta una columna/tabla nueva en un WP futuro.
- **C. Escrituras confían en la RLS para el aislamiento (0 filas si no es suyo).** Ver nota en §6. No es fuga; endurecible en WP-08.
- **D. Reglas globales aplicables sin considerar `activa`.** Se muestran todas las globales aplicables por vertical (activas o no) marcando "Inactiva" cuando corresponde, para dar contexto completo al profesional. Si sólo deben verse las activas, es un filtro de una línea.
- **E. `contarAlertasNuevas` corre en el layout en cada navegación del panel.** Es una consulta `head/count` barata; si el volumen creciera, se puede cachear. No bloqueante en F1.
- **F. Seed adicional pendiente de `db reset` en vivo** (misma salvedad de GoTrue que WP-01). Validado con parser real; sigue el patrón ya revisado.

---

## 10. Credenciales del seed (añadidas por WP-06)

Contraseña común: **`Botsy1234!`** (ejecutar `supabase/seed_wp06_segundo_profesional.sql` **después** de `supabase/seed.sql`).

| Email | Rol | Notas |
|---|---|---|
| `dr.ruiz@botsy.local` | profesional | Dr. Ruiz (profesional asignado de Marta) |
| `marta@botsy.local` | paciente | 59, salud mental; 5 días de datos; 1 alerta `vigilancia` nueva |
