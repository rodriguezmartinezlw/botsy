# WP-11 v2 — Núcleo de programas ONCOLOGÍA + disposición estructurada

**Versión 2 (2026-07-16):** reorientado por [ADR-003](../adr/ADR-003-pivote-oncologia.md) y [MEMORIA-PROYECTO.md](../MEMORIA-PROYECTO.md) — es el **módulo 1 de la fase piloto** ([PLAN-TECNICO-PILOTO.md](../PLAN-TECNICO-PILOTO.md) §5). La v1 multi-perfil (5 plantillas) queda en el historial git; la ARQUITECTURA es la misma, cambian seed y alcance.
**Depende de:** F1 completo; ideal tras WP-10 · **Puerta:** la arquitectura no tiene puerta; los UMBRALES clínicos se fijan tras la llamada 1 (psicooncólogo) — hasta entonces van configurables y marcados `[PENDIENTE CLÍNICO]`.

## Objetivo

La entidad **programa** con seed oncológico de mama, el gating server-side de módulos, el check-in dirigido por programa, y la **disposición estructurada obligatoria** en alertas (regla de oro 3 — no retrofiteable, por eso entra aquí y no después).

## Tareas

### A. Arquitectura de programas (idéntica al diseño v1)

1. Migración: `programas` (catálogo: `clave unique`, `nombre`, `descripcion`, `version`, `config jsonb`, `activo`; RLS: SELECT profesional/admin, escritura admin) + `programas_paciente` (`paciente_id FK`, `programa_id FK`, `config_override jsonb default '{}'`, `fase_actual int default 0`, `fecha_inicio date`, `fecha_evento date null`, `estado check in ('activo','completado','suspendido')`, `asignado_por FK`; **UNIQUE parcial: un programa activo por paciente**; RLS: paciente SELECT propio, profesional gestiona sus asignados, admin todo).
2. `src/lib/programas/config.ts` — `EsquemaConfigPrograma` (Zod, forma canónica): `modulos {voz, texto, recomendaciones}` (los flags `tareas/diario/fotos` NO se incluyen en v2 — módulos aparcados), `perfil_graficos {…}`, `checkin {frecuencia, dominios, preguntas_extra[], estilo {ritmo, frases_cortas, repeticion}}`, `escalado {reglas_clave[]}`, `instrumentos {termometro_distres: {activo, frecuencia}}` (consumido por WP-16), `fases?`. `configEfectiva(plantilla, override)`: deep-merge validado con fallback seguro. Puro, con tests.
3. Runtime: `obtenerProgramaActivo(pacienteId)` (server); paciente sin programa = **comportamiento F1 intacto** (config por defecto). Gating server-side: módulo desactivado → 403/redirección aunque se llame a la ruta directamente; jamás confiar solo en ocultar botones.
4. Check-in dirigido: `construirContexto` lee el programa → dominios activos, `preguntas_extra` y `estilo` entran en `construirInstrucciones` como sección `# PROGRAMA`; la checklist y `marcar_dominio_cubierto` respetan el subconjunto; la frecuencia gobierna recordatorios (cron WP-07).
5. Panel: pestaña **Programa** en la ficha 360º — asignar plantilla, config efectiva en lenguaje humano (sin JSON crudo), overrides con toggles, suspender/reactivar; activación de `reglas_clave` como filas de `reglas_escalado` del paciente (idempotente; al suspender, desactivar). Todo con `obtenerSesionPanel()` + auditoría.

### B. Disposición estructurada obligatoria (regla de oro 3)

1. Migración: `disposiciones` + `catalogo_motivos` según [PLAN-TECNICO-PILOTO.md](../PLAN-TECNICO-PILOTO.md) §4.1-2 (alerta_id UNIQUE, decisión codificada, motivo del catálogo, `dias_seguimiento`, desenlace; RLS: profesional del paciente escribe, paciente no lee, admin lee). Seed de `catalogo_motivos` marcado `[PENDIENTE CLÍNICO]`.
2. Las Server Actions de alertas (WP-06) cambian: `resolver` y `descartar` EXIGEN disposición completa (Zod estricto); sin ella, la mutación se rechaza. La UI de la bandeja presenta decisión/motivo/segimiento en un formulario de 3 clics (selects del catálogo + texto opcional).
3. Vista "**Desenlaces pendientes**" en el panel: disposiciones con `dias_seguimiento` vencido y `desenlace='pendiente'`; registro del desenlace en 2 clics; badge con recuento. Auditoría completa.

### C. Contenido oncológico (mama)

1. **Seed de 2 programas:** `mama_terapia_oral` (check-in diario; dominios adherencia/síntomas/ánimo-distrés-breve; preguntas_extra: fiebre —"¿te has tomado la temperatura?"—, diarrea, fatiga; recordatorio de toma) y `mama_tratamiento_activo` (síntomas de ciclo: náuseas, vómitos, mucositis, fatiga; distrés completo semanal vía WP-16; adherencia a orales concomitantes).
2. **Catálogo CTCAE simplificado es-ES** para `observaciones.codigo` (constantes tipadas en `src/lib/ia/vocabulario-onco.ts` + guía en el prompt para que el LLM use esos códigos): fiebre (°C — absorbe la spec de rango de WP-13 §3: 34–43 para `fiebre`, documentando la convivencia con las escalas 0–10), nauseas, vomitos, diarrea, estrenimiento, mucositis, fatiga, dolor, neuropatia, alopecia, reaccion_cutanea, disnea… (subconjunto inicial ~20 códigos, revisable por el psicooncólogo).
3. **Reglas seed oncológicas** (todas `[PENDIENTE CLÍNICO]`, formato JSONB de WP-04): fiebre ≥38 en `mama_tratamiento_activo` → **urgencia** · fiebre ≥38 en `mama_terapia_oral` → contactar · diarrea intensa/persistente → contactar · vómitos que impiden ingesta → contactar · dolor ≥7 sostenido 2 días → contactar. Las globales existentes (ideación autolítica → urgencia, no-adherencia crítica) siguen aplicando.
4. **Discontinuación codificada:** migración `pautas_medicacion` + `discontinuada_en`, `motivo_discontinuacion FK catalogo_motivos`; el panel pide el motivo al discontinuar (distinto de "desactivar por error"); alimenta las curvas de persistencia (WP-17).

### D. Consentimiento de uso secundario

- Migración: ampliar `consentimientos.tipo` con `'uso_secundario'`. Opt-in SEPARADO en la pantalla de consentimientos, texto propio `[PENDIENTE LEGAL]`, revocable, trazado. Ninguna funcionalidad depende de él (estrictamente opcional — habilitador del activo de datos, Memoria §7.4).

## Fuera de alcance

Termómetro NCCN (WP-16 — aquí solo el hueco `instrumentos` en la config), dashboard patrocinador y seed demo oncológico (WP-17), ROI (WP-15), farmacovigilancia (WP-18), pediatría (WP-19), módulos aparcados (tareas/diario/fotos/Alzheimer).

## Criterios de aceptación

- Build/lint/test verdes (no romper los 113; añadir): merge de config, gating server-side, instrucciones con preguntas extra/estilo, idempotencia de reglas, **resolver/descartar alerta sin disposición → rechazado** (test), desenlaces pendientes listados y registrables, reglas oncológicas disparan en el motor (fiebre 38.5 en activo → urgencia; 37.5 → nada), paciente sin programa = F1 intacto.
- Migraciones validadas (libpg_query) con RLS en el mismo archivo; ninguna migración commiteada editada.
- Todos los umbrales en constantes/reglas configurables y marcados `[PENDIENTE CLÍNICO]`; cero textos que describan predicción/diagnóstico.
- Demo documentada: asignar `mama_terapia_oral` a una paciente → check-in con preguntas de fiebre/adherencia → reporta 38.4 → contactar → alerta → disposición estructurada → desenlace a 7 días.
