# Entrega WP-05 — Perfil evolutivo del paciente (gráficos)

**Fecha:** 2026-07-16 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde (51 tests: 32 previos + 19 nuevos, sin romper ninguno).

---

## 1. Qué se hizo

La pantalla `(paciente)/perfil` como **Server Component** que lee de Supabase con el cliente de servidor (cookies, RLS `propio` de WP-01), **agrega en el servidor** y pasa **series ya calculadas** a componentes cliente de gráfico. No hay ningún fetch de datos desde el cliente: el único estado de cliente es el período seleccionado y el selector de fecha de la tarjeta de cognición.

- **Cabecera**: avatar (o iniciales sobre círculo), nombre, racha actual con icono de llama (`Flame`) y "Check-ins este mes: N".
- **Selector de período global**: Semana / Mes / 3 meses (control segmentado accesible, `aria-pressed`). Por defecto **Mes** (coincide con el "Month" del deck).
- **6 tarjetas** con Recharts, cada una con estado vacío amable:
  1. **Dolor** — área de la media diaria de `observaciones dominio='dolor'` (`valor_num`), con marcador de pico (punto rojo sobre el máximo) y delta ↑/↓ % frente al período anterior.
  2. **Ánimo y estrés** — líneas comparadas de `animo`, `ansiedad`, `estres` (0–10); sólo se dibujan las series con datos.
  3. **Adherencia** — por fármaco activo: fila semanal L–D con puntos verde (tomada) / rojo (omitida) / gris (desconocido o sin registro) desde `tomas_medicacion`, % de adherencia del período (global y por fármaco), y barras de evolución mensual.
  4. **Sueño** — barras del dominio `sueno` si hay datos.
  5. **Cognición** — área con selector de fecha (navegación por ventanas); si no hay observaciones de `cognicion`, tarjeta "Aún estamos conociéndote".
  6. **Síntomas recientes** — chips de los `codigo` de `sintoma_fisico` de los últimos 30 días con recuento.
- **`src/lib/agregados.ts`** — utilidades de agregación **puras** (sin Supabase): medias diarias, delta de período, % de adherencia, fila semanal L–D, evolución mensual, recuento de síntomas, rangos de período. Con **tests ligeros** (`src/lib/agregados.test.ts`, 19 casos) construidos con datos equivalentes al seed de Luis.
- **`src/components/graficos/`** — componentes de gráfico que **reciben series y no conocen Supabase** (reutilizables por WP-06): `GraficoAreaTemporal`, `GraficoLineas`, `GraficoBarras`, `PuntosAdherencia`, `TooltipGrafico`, `EstadoVacioGrafico`, más `paleta.ts` y `formato.ts`. Ejes y tooltips en español (`date-fns` locale `es`), fuente de ejes 14px (≥12px), títulos de tarjeta 20px (≥18px), paleta del tema.

---

## 2. Archivos

### Creados

- `src/lib/agregados.ts` — agregaciones puras + tipos compartidos (`Periodo`, `SeriePunto`, `PuntoAnimo`, `PuntoBarra`, `DiaAdherencia`, `RecuentoSintoma`, `ObservacionFechada`, `TomaFechada`).
- `src/lib/agregados.test.ts` — 19 tests (adherencia, medias, deltas, semana L–D, evolución mensual, síntomas, estados vacíos).
- `src/components/graficos/paleta.ts` — paleta y constantes de eje (refleja los tokens de `globals.css`).
- `src/components/graficos/formato.ts` — formateadores de fecha en español para ejes y tooltips.
- `src/components/graficos/EstadoVacioGrafico.tsx` — estado vacío amable reutilizable.
- `src/components/graficos/TooltipGrafico.tsx` — tooltip en español (elemento que Recharts rellena en runtime).
- `src/components/graficos/GraficoAreaTemporal.tsx` — área temporal (dolor, cognición).
- `src/components/graficos/GraficoLineas.tsx` — líneas múltiples (ánimo/ansiedad/estrés).
- `src/components/graficos/GraficoBarras.tsx` — barras (sueño, evolución mensual de adherencia).
- `src/components/graficos/PuntosAdherencia.tsx` — fila L–D de puntos verde/rojo/gris (widget, no Recharts).
- `src/components/paciente/perfil/tipos.ts` — tipos presentacionales (`DatosPerfil`, bundles por período) sin Supabase.
- `src/components/paciente/perfil/CabeceraPerfil.tsx` — cabecera (presentacional).
- `src/components/paciente/perfil/TarjetaPerfil.tsx` — contenedor de tarjeta (título ≥18px).
- `src/components/paciente/perfil/TarjetaDolor.tsx`
- `src/components/paciente/perfil/TarjetaAnimoEstres.tsx`
- `src/components/paciente/perfil/TarjetaAdherencia.tsx`
- `src/components/paciente/perfil/TarjetaSueno.tsx`
- `src/components/paciente/perfil/TarjetaCognicion.tsx` — cliente (selector de fecha por ventanas).
- `src/components/paciente/perfil/TarjetaSintomas.tsx`
- `src/components/paciente/perfil/PanelPerfil.tsx` — cliente; único con estado (período); ensambla las 6 tarjetas.
- `src/app/(paciente)/perfil/datos.ts` — carga server-only + agregación; devuelve `DatosPerfil`. Nunca lanza.

### Modificados

- `src/app/(paciente)/perfil/page.tsx` — de placeholder a Server Component real: `await cargarDatosPerfil()`, `<CabeceraPerfil/>` + `<PanelPerfil/>` + disclaimer clínico.
- `src/components/graficos/.gitkeep` — **eliminado** (la carpeta ya tiene contenido real).

### No tocados

- `docs/` salvo este archivo. `.env.example` no cambia (WP-05 no añade variables). Sin migraciones nuevas (el WP no toca esquema).

---

## 3. Decisiones propias (no especificadas en el WP)

1. **Las observaciones se fechan por su check-in.** La tabla `observaciones` no tiene columna `fecha` (sólo `creado_en`, que en el seed es el momento de la inserción, no la fecha clínica). El loader (`datos.ts`) construye un mapa `checkin_id → checkins.fecha` y resuelve la fecha clínica de cada observación por ese join en JS. Sin esto, todas las observaciones caerían en el día de carga del seed.
2. **Se precalculan los 3 bundles de período en el servidor** (Semana/Mes/3 meses) y el cliente sólo elige cuál mostrar. Así se respeta literalmente "pasar series **ya calculadas**" y "nada de fetch/cómputo de datos en cliente"; el selector sólo cambia qué bundle se pinta.
3. **Se leen 180 días** (2× el período mayor) para poder calcular el **delta del período anterior** también en "3 meses". La serie visible sigue siendo la del período (7/30/90 días); los días extra sólo alimentan la media del período anterior.
4. **Definición de % de adherencia** (documentada en §6): `tomadas / (tomadas + omitidas) × 100`, redondeado; las tomas `desconocido` (gris) **no** computan en el denominador. Alternativa posible: contarlas en contra (PDC clásico). En el seed no hay `desconocido`, así que ambas definiciones coinciden; se eligió excluirlas por ser el mensaje más honesto y menos punitivo para el paciente ("de las tomas que conocemos, tomaste X%").
5. **Delta de dolor**: media de las medias diarias del período actual vs. anterior. En dolor, **bajar es buena señal** → se pinta la flecha en verde (`TrendingDown`); subir en ámbar (no rojo) para no alarmar (regla clínica: es un dato registrado, no un diagnóstico).
6. **Fuente de ejes 14px.** El WP pide ejes ≥12px y CLAUDE.md pide texto ≥16px en la app del paciente. Se reconcilian: **todo el texto legible va ≥16px** y **sólo los ticks de eje** bajan a 14px (por encima del mínimo del WP), que es la excepción reconocida para ejes de gráfico.
7. **Paleta como constantes** en `paleta.ts` que reflejan los tokens de `globals.css`, en vez de `var(--…)` dentro de los SVG de Recharts: `fill`/`stroke` se pintan de forma más fiable con colores explícitos. Documentado en el archivo.
8. **Selector de fecha de Cognición por ventanas** (◀/▶ de 7 días sobre ventanas de 14, concepto Día/Semana del deck) en lugar de un `<input type="date">` libre, para que sea usable con datos escasos y accesible con botones grandes. Como el seed no tiene cognición, en la práctica se ve el estado "Aún estamos conociéndote".
9. **Iconos**: `Activity` (dolor), `Smile` (ánimo), `Pill` (adherencia), `Moon` (sueño), `Brain` (cognición), `Stethoscope` (síntomas), `Flame` (racha). El fármaco crítico se marca con un chip neutro "Importante" (no "crítico/peligro") para no alarmar.

---

## 4. Verificación (salida literal)

### `npm run lint` (exit 0)

```
> botsy@0.1.0 lint
> eslint

```

(Sin salida: ningún error ni warning.)

### `npm test` (exit 0)

```
> botsy@0.1.0 test
> vitest run

 RUN  v3.2.7 C:/Users/PROPIETARIO/Desktop/projects/botsy

 ✓ src/lib/escalado/motor.test.ts (17 tests) 74ms
 ✓ src/lib/ia/checkin-texto.test.ts (8 tests) 39ms
 ✓ src/lib/ia/voz-tool.test.ts (7 tests) 23ms
 ✓ src/lib/agregados.test.ts (19 tests) 109ms

 Test Files  4 passed (4)
      Tests  51 passed (51)
```

Los 32 tests previos siguen verdes; los 19 nuevos son de `agregados.ts`.

### `npm run build` (exit 0)

```
▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 25.5s
  Running TypeScript ...
  Finished TypeScript in 28.8s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (21/21) in 1710ms
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
├ ƒ /perfil
└ ○ /registro
```

`/perfil` es dinámica (ƒ): lee la sesión con `cookies()`, comportamiento correcto.

### Criterio "ningún componente de gráfico importa Supabase"

```
$ grep -rn "supabase" src/components/graficos/
(sin coincidencias)
```

Los componentes de `graficos/` sólo importan `recharts`, `date-fns`, `lucide-react`, sus utilidades locales (`paleta`, `formato`, `TooltipGrafico`, `EstadoVacioGrafico`) y **tipos** de `@/lib/agregados` (módulo puro, tampoco importa Supabase). Reutilizables tal cual por WP-06.

---

## 5. Demostración del % de adherencia (cálculo manual sobre el seed)

**Seed de Luis (`supabase/seed.sql`, 14 días):** AAS (`mañana`) siempre `tomada`; Warfarina (`noche`) `omitida` los 2 últimos días, `tomada` el resto.

Definición implementada: `% = tomadas / (tomadas + omitidas) × 100`, redondeado; `desconocido` excluido.

### Período "Mes" (los 14 días completos)

| Fármaco | tomadas | omitidas | cálculo | % |
|---|---|---|---|---|
| Ácido acetilsalicílico | 14 | 0 | 14 / 14 | **100 %** |
| Warfarina | 12 | 2 | 12 / 14 = 0,857142… | **86 %** |
| **Global** | 26 | 2 | 26 / 28 = 0,928571… | **93 %** |

### Período "Semana" (últimos 7 días; las 2 omisiones caen dentro)

| Fármaco | tomadas | omitidas | cálculo | % |
|---|---|---|---|---|
| Ácido acetilsalicílico | 7 | 0 | 7 / 7 | **100 %** |
| Warfarina | 5 | 2 | 5 / 7 = 0,714… | **71 %** |
| **Global** | 12 | 2 | 12 / 14 = 0,857… | **86 %** |

Estos valores están **fijados en los tests** (`src/lib/agregados.test.ts`), que reconstruyen el seed con la misma fórmula sobre una fecha "hoy" fija (`2026-07-15`) para ser deterministas:

- `porcentajeAdherencia(tomasAas) === 100`
- `porcentajeAdherencia(tomasWarfarina) === 86`
- `porcentajeAdherencia(todasLasTomas) === 93`
- Semana Warfarina: `71`
- Se comprueba además que `desconocido` no computa (`50 %` con 1 tomada / 1 omitida / 2 desconocido).

### Medias y delta de dolor (mismo seed)

- Serie de dolor de la semana = `5,4,4,3,3,2,2`; media ≈ **3,29/10**; pico **5**.
- Semana anterior = `8,8,7,7,6,6,5`; media ≈ **6,71/10**.
- **Delta semanal = −51 %** (el dolor baja ~51 % respecto a la semana previa). Verificado en test.
- En "Mes", la media de los 14 días es **5,0/10** y el pico **8**; el delta es `null` porque no hay datos en el mes anterior (los datos del seed son sólo los últimos 14 días).

---

## 6. Descripción verificable de las 6 tarjetas

### Con datos (Luis)

1. **Dolor** — se renderiza con datos: área descendente 8→2 sobre 14 días, punto rojo en el pico, badge de media (`5,0/10` en Mes; `3,3/10` en Semana con `↓51%`).
2. **Ánimo y estrés** — se renderiza: **sólo la línea de Ánimo** (valores 6–7); Luis no tiene observaciones de `ansiedad` ni `estres`, así que esas líneas no se dibujan (comportamiento correcto de "sólo series con datos").
3. **Adherencia** — se renderiza con los 2 fármacos: badge global **93 %** (Mes); AAS **100 %**, Warfarina **86 %** con chip "Importante"; fila L–D con la semana actual (los días con omisión en rojo, tomadas en verde, futuro en gris); barras de evolución mensual (julio: AAS 100 %, Warfarina 86 %).
4. **Sueño** — **estado vacío** ("Cuando me cuentes qué tal duermes…"): Luis no tiene observaciones de `sueno`.
5. **Cognición** — **"Aún estamos conociéndote"**: Luis no tiene observaciones de `cognicion`.
6. **Síntomas recientes** — **estado vacío** ("No has registrado síntomas físicos…"): el seed de Luis no incluye `sintoma_fisico`.

### Sin datos (Carmen, paciente sin datos clínicos)

Cabecera con racha 0 y "Check-ins este mes: 0". Las 6 tarjetas muestran su estado vacío amable; Adherencia muestra "Cuando tengas medicación registrada…" (Carmen no tiene pautas activas). Esta ruta está cubierta por el bloque de tests "estados vacíos (Carmen)" en `agregados.test.ts` (serie densa toda a `null`, media/pico/delta `null`, adherencia `null`, evolución `[]`, semana toda en gris, sin chips) y por el fallback `perfilVacio()` de `datos.ts`, que hace que la página renderice estados vacíos sin backend (build verde sin Supabase remoto).

> **Nota sobre la verificación con seed:** no hay Supabase remoto con el seed cargado en el entorno (como en WP-01), por lo que la aceptación se demuestra con (a) los tests de `agregados.ts` con datos equivalentes al seed, (b) el bloque de estados vacíos (Carmen), y (c) el `grep` de independencia de Supabase, según lo pedido. El render live con seed queda pendiente de un entorno con `supabase db reset`.

---

## 7. Dudas / riesgos detectados

- **A. El seed está anclado a `current_date` (momento de carga), no a la petición.** Las ventanas de período de `agregados.ts` dependen del "hoy" de la petición. Si el seed se carga y se ve el **mismo día**, los números coinciden con esta entrega; si se ve días después, los 14 días del seed van saliendo de la ventana "Semana" (y del delta). No es un bug de WP-05: es cómo está construido el seed de WP-01 (relativo a `current_date`). Los tests fijan "hoy" para ser deterministas. Si se quiere una demo estable en el tiempo, convendría un seed con fechas absolutas o re-seeding.
- **B. `observaciones` sin `fecha` propia.** Se resuelve por el `checkin` asociado (§3.1). Las observaciones cuyo check-in caiga fuera de la ventana de 180 días o que no tengan check-in mapeado se descartan del gráfico. Es coherente con el modelo (toda observación nace de un check-in), pero conviene tenerlo presente si en el futuro se insertan observaciones de reconciliación sin check-in del día.
- **C. Delta en "3 meses".** Requiere 90 días previos de datos; por eso se leen 180 días. Con menos historia, el delta sale `null` y la tarjeta simplemente no muestra badge de delta (no es error).
- **D. Escala de sueño y cognición asumidas 0–10 / automática.** El WP no fija la escala numérica de `sueno` ni de `cognicion`. Sueño se pinta 0–10 (coherente con ánimo/dolor) y Cognición con eje automático (el deck usaba 20–160, que parece un índice propio). Si el equipo clínico define escalas concretas, es un ajuste menor de `maxY`.
- **E. `evolucionMensualAdherencia` agrupa por mes natural** (`yyyy-MM`). Con 180 días se ven hasta ~6-7 barras; en el seed (14 días) sale 1 barra (julio). Correcto, pero si se quisiera "8 meses" como el deck haría falta más historia.
- **F. Ánimo/ansiedad/estrés comparten tarjeta con escalas homogéneas (0–10).** Si en el futuro `estres` usara otra escala, habría que separar ejes; hoy el WP los agrupa 0–10.

No se detectaron errores en el WP ni en el plan que requieran corrección; los puntos anteriores son decisiones de diseño y observaciones, no fallos a "arreglar" (según CLAUDE.md, quedan anotados aquí).
