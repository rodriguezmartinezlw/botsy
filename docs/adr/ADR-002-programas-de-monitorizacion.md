# ADR-002 — Programas de monitorización (plataforma multi-perfil)

**Estado:** Aceptada en arquitectura; **plantillas clínicas pendientes de validación con el usuario y asesoría clínica** · **Fecha:** 2026-07-16 · **Origen:** conversación con el CEO (Luis): "el profesional, según el tipo de paciente, debe activarle o no ciertas funcionalidades de la app".

## Contexto

Botsy debe servir a perfiles clínicos muy distintos con **el mismo producto**: psicología (TCC), psiquiatría, psicooncología, Alzheimer/deterioro cognitivo, post-cirugía… Cada perfil necesita módulos distintos (un paciente con Alzheimer no debe teclear; un paciente de TCC necesita tareas terapéuticas y un "cuaderno hablado"), un guion de check-in distinto, reglas de escalado distintas y hasta una frecuencia distinta. Sin una estructura para esto, el producto se bifurcaría en N apps.

La spec ya lo apuntaba sin desarrollarlo: **RF-DB-04** (prescripción de monitorización) y **RF-CV-06** (personalización del guion por condición y por prescripción). Esta ADR los eleva a arquitectura central.

## Decisión

**Una sola app, N programas.** Se introduce la entidad **Programa de monitorización** = prescripción clínica empaquetada que el profesional asigna al paciente:

1. **Módulos** (flags por paciente): `voz`, `texto`, `tareas` (terapéuticas), `diario` (registro libre por voz 24/7), `fotos` (imágenes clínicas dirigidas), `perfil_graficos` (qué tarjetas ve el propio paciente), `recomendaciones` (por categoría).
2. **Guion del check-in**: dominios activos, preguntas extra del programa, frecuencia (diaria/2x día/semanal/por fases), estilo conversacional (ritmo, longitud de frase, repetición — clave en geriatría).
3. **Reglas de escalado** del programa (se apoyan en el motor de WP-04: al asignar el programa se activan sus reglas para ese paciente).
4. **Contenido**: recomendaciones y psicoeducación propias del perfil.
5. **Ciclo de vida**: permanente (crónicos) o **por fases con alta** (post-cirugía: días 1–7 diario → 8–30 alterno → alta con resumen final).

### Tres capas

| Capa | Quién | Qué |
|---|---|---|
| **Catálogo de plantillas** | Admin (con validación clínica) | Programas versionados con su config por defecto |
| **Asignación** | Profesional, por paciente | Plantilla + ajustes (overrides): activar/desactivar módulos, ajustar frecuencia/umbrales |
| **Runtime** | App + motor conversacional | La app del paciente muestra SOLO los módulos activos; el builder de instrucciones (WP-02) lee el programa; **todo gate se verifica server-side** (regla Next 16 de CLAUDE.md), nunca solo ocultando botones |

### Modelo de datos (nuevo)

- `programas` — catálogo: `clave`, `nombre`, `descripcion`, `version`, `config jsonb`, `activo`.
- `programas_paciente` — asignación: `paciente_id`, `programa_id`, `config_override jsonb`, `fase_actual`, `fecha_inicio`, `fecha_evento` (p. ej. fecha de cirugía), `estado (activo|completado|suspendido)`, `asignado_por`.
- `tareas_terapeuticas` + `tareas_registros` (WP-12), `diario_entradas` (WP-12), `fotos_clinicas` (WP-13).
- RLS idéntica al patrón existente (paciente lo suyo; profesional sus asignados; admin catálogo).

La `config` efectiva = merge(plantilla.config, asignación.config_override), tipada y validada con Zod (una sola forma canónica).

## Plantillas iniciales (5) — borrador a validar clínicamente

| Programa | Canal | Módulos clave | Check-in (dominios/preguntas extra) | Escalado específico | Particularidades |
|---|---|---|---|---|---|
| **Psicología TCC** | Voz + texto | Tareas terapéuticas, diario de pensamientos por voz | Ánimo, ansiedad, sueño, cumplimiento de tareas | Ideación autolítica (ya existe), empeoramiento sostenido del ánimo | El "cuaderno" se habla: la IA guía el registro situación→pensamiento→emoción (0–10)→respuesta alternativa y lo estructura para el terapeuta |
| **Psiquiatría** | Voz + texto | Adherencia CRÍTICA | Ánimo, sueño, efectos adversos, señales tempranas de recaída | No-adherencia crítica (ya existe), señales de recaída/agitación | Combinable con TCC; pautas marcadas `critica` |
| **Psicooncología** | Voz + texto | Recomendaciones, contenido | Síntomas del tratamiento (náuseas, fatiga, fiebre, dolor), distrés emocional, alimentación | **Fiebre ≥38 en tratamiento activo → urgencia** (señal, nunca "neutropenia" ante el paciente); dolor ≥7 sostenido → contactar; distrés alto → contactar | Seguimiento por ciclos de tratamiento |
| **Alzheimer / deterioro cognitivo** | **SOLO voz** | UI ultra-simple (un botón), rol cuidador | Preguntas muy simples; cognición ligera integrada (nunca interrogatorio); adherencia confirmable por cuidador | Desorientación aguda, agitación, caída → contactar (aviso a cuidador + profesional) | Ritmo lento, repetición, frases cortas (RF-CV-09); la línea base vocal (F3) es especialmente valiosa aquí |
| **Post-cirugía** | Voz + texto | Foto dirigida de herida, programa POR FASES temporal | Dolor, estado de la herida, fiebre, movilidad, medicación | Fiebre ≥38 → contactar; fiebre + dolor creciente o supuración → urgencia (señal de la herida, sin diagnosticar) | Alta automática al completar fases, con resumen final al profesional |

## Consecuencias

- El check-in de WP-02 se parametriza: `construirContexto` lee el programa activo → dominios + preguntas extra + estilo entran en `construirInstrucciones`. No se reescribe el motor; se alimenta.
- Los módulos nuevos (tareas, diario, fotos, cuidador) se construyen **una vez** y se activan por programa: el producto escala a nuevos perfiles añadiendo plantillas, no código.
- **Regulatorio:** la personalización clínica acerca las funciones a MDR. F2 se mantiene como registro/señal (lenguaje no diagnóstico ya vigente) y **cada plantilla debe validarse con asesoría clínica antes de usarse con pacientes reales** (los umbrales de las tablas son borrador).

## Preguntas abiertas (a decidir con el usuario antes o durante WP-11)

1. **¿Programa único o combinables?** Propuesta: un programa base por paciente + módulos adicionales activables (cubre "psiquiatría + TCC").
2. **Rol cuidador (Alzheimer):** propuesta v1 sin cuenta (email/teléfono que recibe avisos y confirma tomas por enlace firmado); cuenta completa con acceso limitado en v2.
3. **Tareas terapéuticas:** ¿catálogo de plantillas + creación libre del profesional? Propuesta: ambas.
4. **Diario de pensamientos:** ¿sesión separada del check-in, disponible 24/7? Propuesta: sí ("Cuéntale a Botsy"), con el escalado en vivo también activo ahí.
5. **¿Qué ve el paciente de sus propios gráficos** en perfiles de salud mental? Propuesta: configurable por programa (`perfil_graficos`), decisión del profesional.
