# Motor de escalado (`src/lib/escalado`)

Motor **determinista por reglas** (F1, decisión D8: sin ML) que clasifica cada
check-in en `normal / vigilancia / contactar / urgencia`, genera alertas
auditables para el profesional y guía al paciente con lenguaje empático y **no
diagnóstico** (reglas clínicas de `CLAUDE.md`).

## Módulos

| Archivo | Responsabilidad |
|---|---|
| `motor.ts` | `evaluarReglas(datos, reglas)` PURO + `evaluarCheckin(checkinId)` (carga datos/contexto y evalúa). Validación Zod del JSONB de `condicion`. |
| `senales.ts` | `evaluarSenal(entrada)` — clasificación EN VIVO de una señal durante la conversación (la consume `src/lib/ia/loop.ts`). `nivelMaximoRiesgo` (el riesgo solo sube). |
| `acciones.ts` | `aplicarEscalado(evaluacion, repo)` — crea alertas + auditoría (RF-ES-06) y sube el riesgo, IDEMPOTENTE. Puerto `RepositorioAcciones` (testeable) + implementación con service-role. |
| `textos.ts` | Textos al paciente centralizados (contactar / urgencia / vigilancia), con marca `[PENDIENTE LEGAL]`. Tono empático, sin diagnóstico ni alarmismo. |
| `consultas.ts` | `obtenerAlertas(filtros)` con RLS de profesional (helper para WP-06). |

## Niveles y acciones

| Nivel | Paciente | Profesional |
|---|---|---|
| `normal` | — | — |
| `vigilancia` | Sin fricción (nada visible) | Alerta de seguimiento |
| `contactar` | Tarjeta empática + botón `tel:` al médico | Alerta |
| `urgencia` | Pantalla dedicada (112 + médico), calmada | Alerta |

El riesgo de un check-in **solo sube** (`nivelMaximoRiesgo`): una re-evaluación
nunca lo rebaja.

## Formato de `reglas_escalado.condicion` (JSONB)

`condicion` es un objeto con un campo discriminador `tipo`. Se valida con Zod al
cargar (`parsearCondicion`); una regla malformada se **ignora** (no rompe el
motor). Debe coincidir con `supabase/migrations/0003_reglas_semilla.sql`
(coincide: **no** se requiere migración de reformateo).

### 1. `observacion`

Casa si existe una observación del check-in con el dominio (y, opcionalmente, el
código) indicados y que cumpla los umbrales numéricos.

```json
{ "tipo": "observacion", "dominio": "dolor", "valor_num_gte": 9 }
{ "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "dolor_toracico" }
```

| Campo | Req. | Significado |
|---|---|---|
| `dominio` | sí | Dominio de `observaciones.dominio` (dolor, sintoma_fisico, animo, …). |
| `codigo` | no | Código clínico exacto (p. ej. `dolor_toracico`). Si se omite, casa cualquier código del dominio. |
| `valor_num_gte` | no | La observación debe tener `valor_num >= gte`. |
| `valor_num_lte` | no | La observación debe tener `valor_num <= lte`. |

### 2. `senal`

Casa si durante el check-in se detectó una señal (`senal_alarma` del modelo) con
ese código. Las señales se leen de la auditoría del check-in.

```json
{ "tipo": "senal", "codigo": "ideacion_autolitica" }
```

Además, `evaluarSenal` usa las reglas `senal` para clasificar EN VIVO (sin
esperar al cierre): si una señal casa con una regla `urgencia`, el nivel se eleva
inmediatamente.

### 3. `combinacion`

Combina subcondiciones (anidables) con `todas` (AND) y/o `alguna` (OR). Casa si
se cumplen los bloques presentes: `todas` exige que **todas** sus subcondiciones
casen; `alguna`, que **al menos una** case. Debe haber al menos un bloque.

```json
{ "tipo": "combinacion", "todas": [
    { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "dolor_toracico" },
    { "tipo": "observacion", "dominio": "sintoma_fisico", "codigo": "disnea" }
]}
```

| Campo | Req. | Significado |
|---|---|---|
| `todas` | no* | Lista de condiciones; deben casar **todas**. |
| `alguna` | no* | Lista de condiciones; debe casar **alguna**. |

`*` Debe estar presente al menos uno de los dos.

### 4. `adherencia_critica`

Casa si un fármaco marcado como **crítico** (`pautas_medicacion.critica`) se
omitió `dias_consecutivos` o más **días de calendario consecutivos** (contados
sobre `tomas_medicacion.estado = 'omitida'`).

```json
{ "tipo": "adherencia_critica", "dias_consecutivos": 2 }
```

| Campo | Req. | Significado |
|---|---|---|
| `dias_consecutivos` | sí | Entero positivo: nº mínimo de días consecutivos con alguna toma crítica omitida. |

### 5. `tendencia`

Casa si el valor diario de un dominio cumple un umbral durante
`dias_consecutivos` días de calendario consecutivos. Por día se agrega el
`valor_num` (para `valor_num_lte` se usa el mínimo del día; para `valor_num_gte`,
el máximo).

```json
{ "tipo": "tendencia", "dominio": "animo", "valor_num_lte": 3, "dias_consecutivos": 3 }
```

| Campo | Req. | Significado |
|---|---|---|
| `dominio` | sí | Dominio observado (p. ej. `animo`). |
| `valor_num_lte` | no | Umbral: el valor del día debe ser `<= lte`. |
| `valor_num_gte` | no | Umbral: el valor del día debe ser `>= gte`. |
| `dias_consecutivos` | sí | Entero positivo: nº mínimo de días consecutivos que cumplen el umbral. |

## Aplicabilidad de una regla

Una regla se evalúa sobre un check-in si:

- **Ámbito:** es global (`paciente_id IS NULL`) **o** es de ese paciente
  (`paciente_id = <paciente>`), y
- **Vertical:** su `vertical` es `NULL` (cualquiera) **o** coincide con la del
  paciente.

`reglas_escalado.nivel` ∈ {`vigilancia`, `contactar`, `urgencia`}. El nivel del
check-in es el **más alto** entre las reglas disparadas.

## Datos que evalúa cada tipo (resumen)

| Tipo | Fuente de datos |
|---|---|
| `observacion` | `observaciones` del check-in actual. |
| `senal` | Señales detectadas en el check-in (auditoría `senal_alarma`). |
| `combinacion` | Recursivo sobre sus subcondiciones. |
| `adherencia_critica` | `tomas_medicacion` de fármacos críticos (últimos ~30 días). |
| `tendencia` | `observaciones` por día del dominio (últimos ~30 días). |

## Idempotencia

`aplicarEscalado` no duplica alertas de la misma regla en el mismo check-in
(clave `checkin_id` + `regla_id`) ni añade auditoría si no creó ninguna alerta
nueva. Re-evaluar un check-in ya escalado es seguro.
