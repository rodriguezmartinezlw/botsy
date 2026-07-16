# WP-11 — Programas de monitorización (núcleo multi-perfil)

**Depende de:** F1 completo; ideal tras WP-10 · **Decisión:** [ADR-002](../adr/ADR-002-programas-de-monitorizacion.md) (léela ENTERA antes de empezar) · **Funcional:** RF-DB-04, RF-CV-06, RF-CV-09.

## Objetivo

La entidad **programa** y toda su tubería: catálogo de plantillas → asignación con overrides por el profesional → gating server-side de módulos en la app del paciente → check-in dirigido por el programa. Con esto, WP-12/13/14 solo añaden módulos y plantillas.

## Tareas

### 1. Migración (siguiente número libre): `programas` + `programas_paciente`

- `programas`: `clave text unique`, `nombre`, `descripcion`, `version int default 1`, `config jsonb not null`, `activo boolean default true`. RLS: SELECT profesionales/admin; escritura solo admin.
- `programas_paciente`: `paciente_id FK`, `programa_id FK`, `config_override jsonb default '{}'`, `fase_actual int default 0`, `fecha_inicio date`, `fecha_evento date null` (p. ej. cirugía), `estado check in ('activo','completado','suspendido')`, `asignado_por FK perfiles`. **UNIQUE parcial: un solo programa `activo` por paciente** (pregunta abierta #1 de ADR-002: si el usuario decide "combinables", se relaja en migración posterior — por defecto implementa ÚNICO). RLS: paciente SELECT lo suyo; profesional SELECT/INSERT/UPDATE de sus asignados; admin todo.
- Validar con libpg_query.

### 2. Config canónica tipada (`src/lib/programas/config.ts`)

Esquema Zod `EsquemaConfigPrograma` (una sola forma canónica):

```ts
{
  modulos: { voz: bool, texto: bool, tareas: bool, diario: bool, fotos: bool, recomendaciones: bool },
  perfil_graficos: { dolor: bool, animo: bool, adherencia: bool, sueno: bool, cognicion: bool, sintomas: bool },
  checkin: {
    frecuencia: "diaria" | "dos_veces_dia" | "dias_alternos" | "semanal",
    dominios: DominioCheckin[],            // subconjunto de DOMINIOS_CHECKIN
    preguntas_extra: string[],             // se inyectan al guion
    estilo: { ritmo: "normal"|"lento", frases_cortas: bool, repeticion: bool }
  },
  escalado: { reglas_clave: string[] },    // claves de reglas de la plantilla
  fases?: [{ dias: number, frecuencia: ..., dominios?: [...] }]   // programas temporales (usado por WP-13)
}
```

- `configEfectiva(plantilla, override)`: deep-merge validado (override gana campo a campo; el resultado SIEMPRE revalida con Zod; si el merge no valida, se usa la plantilla y se registra). Función pura con tests.

### 3. Runtime del paciente (gating)

- `obtenerProgramaActivo(pacienteId)` (server, `src/lib/programas/activo.ts`): asignación activa + config efectiva; si el paciente no tiene programa → **config por defecto = comportamiento actual de F1** (todo activo, dominios completos) para no romper nada.
- La app del paciente muestra SOLO módulos activos (inicio, navegación, CTAs). **Y** cada Route Handler/página de módulo verifica server-side: módulo desactivado → 403 con mensaje amable o redirección (p. ej. `texto:false` → `/checkin` redirige a `/checkin/voz`). Prohibido confiar solo en ocultar botones.
- `voz:false` → el CTA y la ruta de voz quedan inertes de la misma forma.

### 4. Check-in dirigido por programa

- `construirContexto` (WP-02) pasa a leer el programa activo: `dominios` activos (la checklist y `marcar_dominio_cubierto` respetan el subconjunto), `preguntas_extra` y `estilo` entran en `construirInstrucciones` como sección `# PROGRAMA DE MONITORIZACIÓN` (ritmo lento → instrucciones de frases más cortas, repetición paciente).
- La frecuencia gobierna el recordatorio (integrar con el cron de WP-07: `dias_alternos`/`semanal` no avisan a diario) y el texto de inicio ("tu próximo check-in es el…").

### 5. Panel: pestaña "Programa" en la ficha 360º

- Asignar plantilla (selector con descripción), ver la config efectiva en lenguaje humano (nada de JSON crudo), overrides con toggles por módulo/dominio y frecuencia, suspender/reactivar. Toda acción audita en `eventos_auditoria` y usa `obtenerSesionPanel()`.
- Al asignar: activar las reglas de la plantilla (`escalado.reglas_clave` → filas en `reglas_escalado` del paciente, **idempotente**; al suspender el programa, desactivarlas).

### 6. Seed: las 5 plantillas de ADR-002

`tcc`, `psiquiatria`, `psicooncologia`, `alzheimer`, `postcirugia` con la matriz del ADR (versión conservadora; los módulos `tareas`/`diario`/`fotos` pueden ir `true` en config aunque sus features lleguen en WP-12/13 — el gating los mostrará como "próximamente" o los ocultará: elige ocultar y documenta). Reglas nuevas de plantilla que no existan aún (p. ej. fiebre) se dejan para WP-13 salvo las triviales.

## Fuera de alcance

Tareas terapéuticas y diario (WP-12), fotos y fases post-cirugía (WP-13), modo Alzheimer UI + cuidador (WP-14), combinables (pregunta abierta #1).

## Criterios de aceptación

- Build/lint/test verdes (no romper los existentes; añadir): merge de config (plantilla+override, inválido→fallback), gating server-side (módulo off → 403/redirección aunque se llame a la ruta directamente), instrucciones con `preguntas_extra` y estilo, idempotencia de activación de reglas, paciente sin programa = comportamiento F1 intacto.
- Migración validada; RLS en ambas tablas en la misma migración.
- Demo documentada: asignar `alzheimer` a Carmen → su app solo ofrece voz, con estilo lento; asignar `tcc` a Luis → sus dominios/preguntas cambian en las instrucciones generadas.
