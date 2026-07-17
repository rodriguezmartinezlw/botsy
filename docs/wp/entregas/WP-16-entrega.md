# WP-16 — Termómetro de Distrés NCCN conversacional (entrega)

**Estado:** armazón COMPLETO y verificado. Umbral de escalado (≥4) y versión del
instrumento CONFIGURABLES y marcados `[PENDIENTE CLÍNICO]` hasta la validación del
psicooncólogo (llamada 1). Migración nueva **0011** (la siguiente era 0011).

## 1. Qué se hizo

Se construyó TODO el mecanismo del Termómetro de Distrés NCCN, administrado de
forma **conversacional** dentro del check-in existente, reutilizando el motor de
tools (builder + loop Zod), el motor de escalado determinista y los componentes
de gráfico de la ficha 360º. Botsy **administra y registra** el instrumento; NO
interpreta el resultado ante el paciente (reglas de oro 1 y 4).

Piezas entregadas:

1. **Modelo de datos (migración 0011).** Tabla `instrumentos_respuestas`
   (`paciente_id`, `checkin_id` null, `instrumento` check ampliable,
   `version_instrumento`, `puntuacion numeric 0–10`, `items jsonb` = problemas
   marcados, `origen` check `conversacional|formulario`, `creado_en`) con **RLS
   en la misma migración** (paciente su propio registro append-only; profesional
   de sus pacientes; admin todo). Además, **activa el termómetro** en los 2
   programas de mama y **añade la regla de escalado por distrés** a la config de
   cada uno (data update sobre el seed de 0006, idempotente).

2. **Instrumento (módulo puro `src/lib/instrumentos/termometro.ts`).** Fuente
   única de verdad: versión trazada (`TERMOMETRO_DISTRES_VERSION` por env, con
   defecto `[PENDIENTE CLÍNICO]`), catálogo es-ES de problemas por las 5
   categorías NCCN (prácticos, familiares, emocionales, físicos, espirituales),
   decisión de **frecuencia** (`tocaInstrumento`), umbral de referencia (4) y
   agregaciones del panel (`serieDistres`, `problemasFrecuentes`).

3. **Administración conversacional.** Nueva tool **`registrar_instrumento`**
   (Zod `esquemaRegistrarInstrumento`), añadida al patrón de tools existente y
   **ofrecida solo cuando toca administrar hoy** (`construirToolsCheckin`). El
   guion introduce el termómetro con naturalidad ("De 0 a 10, ¿cuánto malestar…")
   y **solo recorre la lista de problemas si la puntuación ≥ umbral** (no alarga
   el check-in). La versión y el origen los **estampa el servidor** (integridad).

4. **Frecuencia por programa.** Se lee de `instrumentos.termometro_distres.frecuencia`
   (semanal en tratamiento activo; quincenal en oral). `obtenerContextoInstrumento`
   resuelve si TOCA hoy según la frecuencia y el último registro; solo entonces se
   ofrece la tool y el guion pregunta.

5. **Escalado.** Nuevo tipo de condición **`instrumento`** en el motor
   determinista (`CondInstrumento`, aditivo). La regla `distres_termometro`
   (`puntuacion_gte 4 → contactar`, CONFIGURABLE + `[PENDIENTE CLÍNICO]`) vive en
   la config del programa y se **materializa** como `reglas_escalado` al asignar
   (misma maquinaria `sincronizarReglasPrograma`). `cargarDatosEvaluacion` carga
   las respuestas del instrumento del check-in; `evaluarCheckin` (cierre) crea la
   alerta al profesional. Sin cambios que rompan el motor.

6. **Panel (ficha 360º).** `TendenciasCompactas.distres` con **serie temporal**
   (reutiliza `GraficoAreaTemporal`, escala 0–10) + **media** + **última
   puntuación** + **problemas más frecuentes** (chips). Se muestra solo si hay
   registros. Es una vista **profesional**.

7. **Gating** (como los módulos de WP-11), en TRES capas: la tool solo se ofrece
   cuando el instrumento está activo y toca hoy (texto y voz); el guion solo lo
   menciona entonces; y `ejecutarHerramienta` **rechaza** `registrar_instrumento`
   si `instrumentoActivo !== true` (defensa en profundidad: no basta con no
   ofrecerla).

## 2. Archivos

### Creados
- `supabase/migrations/0011_instrumentos.sql` — tabla + RLS + activación/regla en los programas.
- `src/lib/instrumentos/termometro.ts` — instrumento (versión, catálogo, frecuencia, agregaciones).
- `src/lib/instrumentos/termometro.test.ts` — frecuencia, serie, problemas, versión (10 tests).
- `src/lib/ia/instrumento.test.ts` — tool `registrar_instrumento`: persiste/rechaza/gating (5 tests).
- `src/lib/escalado/distres-escalado.test.ts` — regla de umbral → contactar (6 tests).
- `docs/wp/entregas/WP-16-entrega.md` — esta entrega.

### Modificados
- `src/lib/ia/schemas.ts` — `esquemaRegistrarInstrumento` (Zod).
- `src/lib/ia/loop.ts` — `InstrumentoEntrada` + método `registrarInstrumento` en `RepositorioCheckin`, gating `instrumentoActivo`, caso de la tool, tools dinámicas.
- `src/lib/ia/conversacion.ts` — `InstrumentoContexto`, sección de guion, `TOOL_REGISTRAR_INSTRUMENTO`, `construirToolsCheckin`, contexto poblado.
- `src/lib/ia/repositorio-supabase.ts` — implementa `registrarInstrumento`.
- `src/lib/ia/voz-tool.ts` — `CheckinVoz.instrumentoActivo` propagado a `ejecutarHerramienta`.
- `src/lib/escalado/motor.ts` — `CondInstrumento` + esquema + `evalInstrumento` + carga de `instrumentos_respuestas`.
- `src/lib/panel/reglas-plantillas.ts` — caso `instrumento` en `describirCondicion`.
- `src/lib/programas/servidor.ts` — `obtenerContextoInstrumento`.
- `src/lib/panel/tipos.ts` — `DistresTendencia` + `TendenciasCompactas.distres`.
- `src/lib/panel/datos.ts` — carga de respuestas + `construirDistres`.
- `src/components/panel/ficha/ColumnaTendencias.tsx` — tarjeta del termómetro (serie + problemas).
- `src/types/db.ts` — `InstrumentoRespuesta`(+Insert) + tabla en `BaseDatos`.
- `src/app/api/checkin/mensaje/route.ts`, `src/app/api/voz/sesion/route.ts`, `src/app/api/voz/tool/route.ts` — cableado del gating/tools.
- `src/lib/ia/checkin-texto.test.ts`, `src/lib/ia/voz-tool.test.ts` — repos en memoria + `instrumentoActivo`.
- `.env.example` — `TERMOMETRO_DISTRES_VERSION`.

## 3. Decisiones (no explícitas en el WP)

- **Escalado por tipo de condición `instrumento`, no por observación.** El score
  vive SOLO en `instrumentos_respuestas` (única fuente de verdad, con versión
  trazada). Añadir un tipo de condición al motor es aditivo y evita duplicar el
  dato como observación. La regla de programa lo usa como cualquier otra.
- **La versión la estampa el servidor**, no el modelo (integridad del dato para
  RWE). El modelo solo aporta puntuación y problemas.
- **Los problemas se validan contra el catálogo NCCN** (Zod `enum`): un problema
  fuera de catálogo se rechaza (traza fiable), consistente con la regla de oro de
  validar toda salida del LLM.
- **La alerta de distrés se materializa al CIERRE del check-in** (vía
  `evaluarCheckin` en `finalizarCheckin`), no en vivo mid-turno. Es deliberado: el
  termómetro es una medida periódica, no una alarma aguda como el dolor torácico;
  y la decisión de escalar es del motor determinista, no de la tool (la tool NO
  conoce el umbral — regla de oro 4). El umbral es configurable en la regla.
- **Frecuencia del panel a 3 meses** para la serie del termómetro (semanal/quincenal
  → la ventana mensual de dolor/ánimo mostraría muy pocos puntos).
- **Activación del instrumento en 0011** (el seed de 0006 lo dejó `activo:false`).
  El WP pide "el armazón completo" y el gating "activo"; se activa con el umbral
  provisional claramente marcado, para que la demo (WP-17) muestre el termómetro.

## 4. Dudas / riesgos

- **[PENDIENTE CLÍNICO]** umbral (≥4), versión es-ES y catálogo de problemas: son
  provisionales; el umbral es editable en `escalado.reglas_clave` de cada programa
  y la versión por env. La traducción de problemas está marcada en el módulo.
- **Materialización retroactiva:** un paciente cuyo programa se asignó ANTES de
  0011 no tendrá la regla de distrés materializada hasta reasignar/reactivar el
  programa (`sincronizarReglasPrograma` es idempotente y la añade al reactivar).
  Para el piloto/demo los programas se asignan tras 0011, así que no aplica.
- **Erratas detectadas en el WP/PLAN:** ninguna. El hueco `instrumentos:
  { termometro_distres: { activo, frecuencia } }` de `config.ts` y el punto §4.4
  de `instrumentos_respuestas` encajan exactamente con lo implementado.

## 5. Verificación (salida literal)

### build (`npm run build`)
```
  Creating an optimized production build ...
✓ Compiled successfully in 25.6s
  Running TypeScript ...
  Finished TypeScript in 32.2s ...
✓ Generating static pages using 3 workers (25/25) in 1024ms
  Finalizing page optimization ...
(25 rutas compiladas, incluidas /api/checkin/mensaje, /api/voz/sesion, /api/voz/tool, /pacientes/[id])
```

### lint (`npm run lint`)
```
> botsy@0.1.0 lint
> eslint
(sin salida = 0 errores, 0 warnings)
```

### test (`npm run test`)
```
 Test Files  20 passed (20)
      Tests  215 passed (215)
```
215 = 194 previos + 21 nuevos:
- `src/lib/instrumentos/termometro.test.ts` — 10
- `src/lib/ia/instrumento.test.ts` — 5
- `src/lib/escalado/distres-escalado.test.ts` — 6

### migración 0011 (libpg_query / pg-query-emscripten)
```
PARSE_OK statements: 10
```

## 6. Demostración de los criterios

### a) Administración conversacional del termómetro
`construirInstrucciones` inyecta la sección `# TERMÓMETRO DE DISTRÉS` SOLO cuando
`instrumento.administrar` (activo && toca hoy). El guion pide "De 0 a 10, ¿cuánto
malestar o angustia has sentido esta última semana?", registra SIEMPRE con
`registrar_instrumento`, y recorre los problemas **solo si la puntuación ≥ umbral**.
Prohíbe explícitamente interpretar/diagnosticar el resultado ante la persona. La
tool solo se ofrece cuando toca (texto vía `ejecutarTurno`, voz vía
`/api/voz/sesion`). Test de la frecuencia: `termometro.test.ts › tocaInstrumento`.

### b) Persistencia (Zod antes de insertar)
`instrumento.test.ts`:
- puntuación 8 + `["miedo","preocupacion"]` → persiste 1 respuesta con `origen:
  conversacional` y `version` trazada.
- puntuación 12 (fuera de rango) → **no** persiste.
- problema fuera del catálogo → **no** persiste.
- instrumento **no activo** hoy → **no** persiste aunque el modelo llame la tool
  (gating en `ejecutarHerramienta`).
En producción, `repositorio-supabase.registrarInstrumento` inserta en
`instrumentos_respuestas` como el paciente (RLS `propio`).

### c) Umbral → contactar (motor determinista)
`distres-escalado.test.ts` (condición idéntica al seed 0011):
- puntuación 4 (umbral inclusivo) → `contactar`, 1 regla disparada.
- puntuación 8 → `contactar`.
- puntuación 3 → `normal`, no dispara.
- sin respuesta / otro instrumento → `normal`.
La regla se materializa como `reglas_escalado` al asignar el programa; la alerta
se crea al cierre del check-in vía `evaluarCheckin`.

### d) Serie temporal en la ficha
`termometro.test.ts › serieDistres` (serie densa 0–10, promedia el día, ignora
fuera de rango) y `problemasFrecuentes` (recuento + etiquetas + orden). El panel
(`ColumnaTendencias`) muestra la tarjeta "Termómetro de distrés" con
`GraficoAreaTemporal` + chips de problemas, solo para el profesional.
