# Botsy — Plan Técnico de la Fase Piloto (oncología: mama + pediatría cuidador-proxy)

**Versión:** 1.0 · **Fecha:** 2026-07-16 · **Director técnico:** Fable · **Fuente de autoridad de producto:** [MEMORIA-PROYECTO.md](MEMORIA-PROYECTO.md) (v1.0) · **Decisión registrada en:** [ADR-003](adr/ADR-003-pivote-oncologia.md)

Este documento traduce la Memoria de Producto a ingeniería: objetivo reestructurado, qué se reusa / se replantea / se construye de cero, modelo de datos, especificación por módulo y plan de sprints con puertas. **Es el documento maestro de la fase piloto** — sustituye como hoja de ruta a los WP-11..14 multi-perfil (que quedan aparcados, no borrados). El protocolo director/implementador de `PLAN-MAESTRO.md` §5 y las convenciones de `CLAUDE.md` siguen vigentes íntegras.

---

## 1. Objetivo del producto (reestructurado)

Botsy es un **asistente sanitario conversacional por voz para pacientes oncológicos en tratamiento**, vendido a laboratorios farmacéuticos (PSP) y pagadores capitados. Convierte un check-in diario hablado en: (a) datos de **adherencia** a terapia oral, (b) **síntomas** en vocabulario CTCAE simplificado, (c) **distrés** (Termómetro NCCN conversacional), y escala señales por un **protocolo determinista de 4 niveles** al equipo clínico, que resuelve cada alerta con una **disposición estructurada obligatoria** (decisión + motivo codificado + desenlace) — la semilla del activo de datos.

- **Vertical de entrada:** cáncer de mama — 2 programas: «Terapia oral» y «Tratamiento activo».
- **Programa 2:** oncología pediátrica vía **cuidador-proxy** (la IA jamás conversa con menores).
- **Usuarios de la plataforma:** paciente (o cuidador-proxy), profesional/equipo clínico, **patrocinador** (farma — solo agregados pseudonimizados), admin.
- **Lo que v1 NO hace (regulatorio, §9 de la Memoria):** no diagnostica, no predice, no sugiere terapia. Captura, estructura, presenta y escala por reglas configuradas por humanos.

## 2. Reglas de oro v2 → implicaciones técnicas

| # | Regla | Implicación técnica concreta |
|---|---|---|
| 1 | Botsy nunca diagnostica ante el paciente | Ya implementada (prompts, textos centralizados, validador de cifras). Sin cambios |
| 2 | **La IA no conversa con menores** | Nuevo `pacientes.tipo_sujeto ('adulto'\|'menor_proxy')`. Si `menor_proxy`: el titular de la cuenta es el cuidador; TODO guion conversacional va en 3ª persona sobre el menor; gate server-side que impide instanciar sesión de conversación cuando el sujeto es menor sin proxy. Verificado por test |
| 3 | **Disposición estructurada obligatoria** en toda alerta | La acción "resolver/descartar" del panel (WP-06) deja de aceptar nota libre: exige `disposiciones` (decisión + motivo codificado + programación de desenlace a X días). No retrofiteable → entra en el PRIMER sprint (WP-11v2) |
| 4 | **v1 no predice ni sugiere** | Prohibición en CLAUDE.md: ningún módulo introduce scoring predictivo ni recomendaciones terapéuticas generadas por LLM. El motor de escalado permanece determinista. El resumen de informes sigue siendo descriptivo con validador anti-alucinación |

## 3. Matriz de módulos: reusar / adaptar / construir / aparcar

### 3.1 SE REUSA TAL CUAL (construido y auditado en F1 — nada que tocar)

| Módulo F1 | Papel en el piloto |
|---|---|
| Motor conversacional compartido texto/voz (builder + tools neutras + loop Zod) | El corazón del check-in oncológico; solo cambia el CONTENIDO (guiones por programa) |
| Voz WebRTC (`VoiceSession`, token efímero server-side, coste controlado) | La hipótesis diferencial del negocio; intacta |
| Motor de escalado determinista (reglas JSONB + alertas idempotentes + materialización inmediata) | Se le cargan reglas oncológicas; el motor no cambia |
| Esquema base + RLS 11 tablas + auth por roles | Base; se EXTIENDE con migraciones nuevas, nunca se edita |
| Dashboard profesional (lista/semáforo, ficha 360º, bandeja, medicación, reglas por plantillas) | Herramienta del equipo clínico del PSP |
| Perfil del paciente con gráficos (componentes que reciben series) | Reutilizado también por los informes de patrocinador/ROI |
| Informes + validador anti-alucinación de cifras | Base técnica de los 2 informes nuevos (patrocinador y ROI) |
| Cron de recordatorios (email) + consentimientos granulares con revocación | Se EXTIENDEN (uso secundario, parental) |
| Infra de calidad: 113 tests, auditoría de acceso cruzado, seed engine, `DESPLIEGUE.md` | Vigente |

### 3.2 SE REPLANTEA / ADAPTA (existe, cambia de forma)

| Qué | Cómo cambia | Dónde se especifica |
|---|---|---|
| **WP-11 núcleo de programas** | La ARQUITECTURA sobrevive intacta (tablas `programas`/`programas_paciente`, config Zod + merge, gating server-side, check-in dirigido por programa, pestaña Programa). Cambia el SEED: de 5 plantillas multi-perfil a **2 programas de mama**; y se le añade la **disposición estructurada** (regla de oro 3) | WP-11 v2 (reescrito) |
| **Resolución de alertas (WP-06)** | "Resolver" y "descartar" pasan a exigir disposición estructurada; nueva vista de desenlaces pendientes de registrar | WP-11 v2 §D |
| **Vocabulario de síntomas** | `observaciones.codigo` adopta un catálogo **CTCAE simplificado** (subconjunto es-ES revisable por el psicooncólogo); el rango de `fiebre` en °C ya estaba especificado en WP-13 §3 — se absorbe | WP-11 v2 §C |
| **Reglas oncológicas de WP-13 §3** | Se absorben en el seed de reglas del piloto (fiebre ≥38 tratamiento activo → urgencia; diarrea severa; dolor sostenido; distrés) con umbrales `[PENDIENTE CLÍNICO]` hasta la llamada 1 | WP-11 v2 §C |
| **Consentimientos** | + tipo `uso_secundario` (opt-in SEPARADO, opcional, revocable, trazabilidad propia — habilitador del activo de datos §7.4) y tipos parentales para pediatría | WP-11 v2 §E y WP-19 |
| **Seed demo** | El seed actual (Luis cardiovascular / Carmen geriátrica) se sustituye por cohorte oncológica demo: ~8-12 pacientes de mama con 45 días coherentes (adherencia, síntomas de ciclo, 2 discontinuaciones codificadas, distrés variado, alertas con disposición) — la demo ES la primera reunión de venta | WP-17 §seed |
| **Informe por paciente (WP-07)** | Sigue; se reetiqueta hacia el equipo clínico. Los informes nuevos (patrocinador/ROI) son módulos aparte | WP-17 / WP-15 |
| **WP-09 puesta en producción** | Vigente sin cambios, sigue bloqueado por claves. Matiz de la Memoria: la demo vendible corre en LOCAL sobre seed — vender no espera a las claves | WP-09 (sin cambios) |
| **WP-10 deuda técnica** | Vigente sin cambios; se ejecuta en paralelo a las tres llamadas (Memoria §13) | WP-10 (sin cambios) |

### 3.3 SE CONSTRUYE DE CERO (no existe nada equivalente)

| # Memoria | Módulo | WP asignado |
|---|---|---|
| 2 | Termómetro de Distrés NCCN conversacional | **WP-16** |
| 3 | Dashboard del patrocinador (agregados pseudonimizados + modo demo) | **WP-17** |
| 4 | Informe ROI pagador (línea base desde el paciente 1) | **WP-15** (número fijado por la Memoria) |
| 5 | Farmacovigilancia mínima viable (EA → cola → paquete exportable, SLA 24h) | **WP-18** |
| 6 | Cuidador-proxy pediátrico | **WP-19** |
| — | Catálogos codificados (motivos de disposición/descarte/discontinuación) | dentro de WP-11 v2 |

### 3.4 APARCADO (no muerto — Memoria §8.2)

`WP-12` (TCC: tareas terapéuticas + diario) · `WP-13` (post-cirugía + fotos; **su §3 de reglas oncológicas se absorbe en WP-11 v2**) · `WP-14` (Alzheimer + cuidador sin cuenta; el cuidador-proxy pediátrico de WP-19 es un diseño DISTINTO: allí el cuidador no tenía cuenta, aquí es el titular) · toda predicción/sugerencia · todo B2C · pt-BR (entregable pagado del primer contrato brasileño) · push nativas · Expo/HealthKit. Los archivos WP se conservan con cabecera "APARCADO".

## 4. Cambios transversales al modelo de datos (migraciones 0005+)

Todas con RLS en la misma migración, validadas con libpg_query, inmutables una vez commiteadas.

1. **`disposiciones`** — `alerta_id FK UNIQUE not null`, `decision check in ('contactado_paciente','ajuste_pauta','derivado_consulta','derivado_urgencias','observacion','sin_accion_justificada')`, `motivo_codigo FK catalogo_motivos`, `motivo_texto text null`, `dias_seguimiento int default 7`, `desenlace check in ('pendiente','resuelto_sin_evento','visita_no_programada','urgencias','hospitalizacion','discontinuacion','otro') default 'pendiente'`, `desenlace_nota`, `desenlace_registrado_en`, `creada_por FK`. RLS: profesional del paciente escribe; paciente NO lee (dato de gestión clínica); admin lee.
2. **`catalogo_motivos`** — `ambito check in ('disposicion','descarte','discontinuacion')`, `codigo`, `etiqueta`, `activo`. Seed inicial marcado `[PENDIENTE CLÍNICO]`; el psicooncólogo lo depura. Motivos de discontinuación típicos: toxicidad, decisión del paciente, coste/acceso, progresión, indicación médica, fin de tratamiento.
3. **`pautas_medicacion`** — añadir `discontinuada_en date null`, `motivo_discontinuacion FK catalogo_motivos null` (alimenta curvas de persistencia). Complementa el `desactivada_en` de WP-10.
4. **`instrumentos_respuestas`** — `paciente_id`, `checkin_id null`, `instrumento check in ('termometro_distres_nccn')` (ampliable), `version_instrumento text`, `puntuacion numeric`, `items jsonb` (lista de problemas marcados), `origen check in ('conversacional','formulario')`. RLS estándar.
5. **`eventos_adversos`** — ver WP-18 (cola de farmacovigilancia con SLA y auditoría).
6. **`patrocinadores`** + `programas_patrocinados` + rol `patrocinador` en `perfiles` — ver WP-17. El patrocinador **no tiene ninguna política de lectura sobre tablas de pacientes**: solo funciones RPC `security definer` que devuelven agregados con **k-anonimato ≥5** (ningún corte con <5 pacientes se devuelve).
7. **`consentimientos.tipo`** — ampliar check con `'uso_secundario'`, `'parental'`, `'asentimiento_menor'` (migración nueva).
8. **`pacientes`** — `tipo_sujeto check in ('adulto','menor_proxy') default 'adulto'`, `cuidador_titular_id FK perfiles null`, `fecha_nacimiento` ya existe (edad del menor para asentimiento).

## 5. Especificación por módulo

> Los WP individuales detallados se emiten cuando su **puerta** (Memoria §8.3) se abre; las especificaciones de esta sección son la base de cada uno. WP-11 v2 ya está emitido (arquitectura sin puerta; sus umbrales clínicos van marcados).

### WP-11 v2 — Núcleo de programas oncología + disposición estructurada *(sprint 1; puerta parcial: umbrales ← llamada 1)*

- **A. Arquitectura de programas:** ejecutar el WP-11 ya especificado (tablas, config Zod, merge, gating server-side, check-in dirigido por programa, pestaña Programa, activación idempotente de reglas) **cambiando el seed**: 2 programas — `mama_terapia_oral` (check-in diario; dominios adherencia/síntomas/distrés-breve; preguntas de fiebre, diarrea, fatiga; recordatorio de toma) y `mama_tratamiento_activo` (síntomas de ciclo quimio/HER2, distrés completo semanal, adherencia a orales concomitantes).
- **B. Disposición estructurada (regla de oro 3):** migración `disposiciones` + `catalogo_motivos`; las Server Actions de alertas exigen disposición para `resuelta`/`descartada`; vista "Desenlaces pendientes" en el panel (disposiciones cuyo `dias_seguimiento` venció sin desenlace) con registro en 2 clics; todo auditado.
- **C. Vocabulario y reglas oncológicas:** catálogo CTCAE simplificado es-ES para `observaciones.codigo` (constantes tipadas + guía en el prompt); reglas seed: fiebre ≥38 (tratamiento activo) → urgencia · fiebre ≥38 (oral) → contactar · diarrea intensa/persistente → contactar · vómitos que impiden ingesta → contactar · dolor ≥7 sostenido 2 días → contactar · no-adherencia crítica ≥2 días (ya existe) · distrés ≥ umbral → contactar (ver WP-16). **Todos los umbrales llevan comentario `[PENDIENTE CLÍNICO]` y se revisan tras la llamada 1.**
- **D. Discontinuación codificada:** al desactivar/discontinuar pauta, el panel pide motivo del catálogo → alimenta persistencia (WP-17).
- **E. Consentimiento `uso_secundario`:** opt-in separado en la pantalla de consentimientos, texto propio `[PENDIENTE LEGAL]`, revocable, con trazabilidad; NINGUNA función depende de él (es estrictamente opcional).
- **Criterios:** los del WP-11 original + disposición obligatoria demostrada por test (resolver sin disposición → rechazado) + reglas oncológicas testeadas en el motor + paciente sin programa = comportamiento F1 intacto.

### WP-16 — Termómetro de Distrés NCCN conversacional *(sprint 1-2; puerta: llamada 1 — psicooncólogo)*

- Instrumento: puntuación 0–10 + lista de problemas (prácticos, familiares, emocionales, físicos, espirituales — versión es-ES a validar). Administración **conversacional**: el check-in lo introduce con naturalidad ("De 0 a 10, ¿cuánto malestar o angustia has sentido esta semana?"), tool `registrar_instrumento` (Zod) persiste en `instrumentos_respuestas`; la lista de problemas se recorre solo si puntuación ≥ umbral (para no alargar el check-in).
- Frecuencia por programa (semanal en tratamiento activo; quincenal en oral — `[PENDIENTE CLÍNICO]`).
- Umbral NCCN estándar (≥4 deriva a evaluación) como regla de escalado `contactar` — configurable, `[PENDIENTE CLÍNICO]`.
- Panel: serie temporal del termómetro en la ficha + problemas más frecuentes; el instrumento y su versión quedan trazados (integridad del dato para RWE).
- **Restricción regulatoria:** el instrumento se ADMINISTRA y REGISTRA; Botsy no interpreta el resultado ante el paciente (regla de oro 1 y 4).

### WP-17 — Dashboard del patrocinador + modo demo *(sprint 2; sin puerta clínica — es la pantalla de venta)*

- Rol `patrocinador` + `patrocinadores` + `programas_patrocinados` (qué cohorte/programa financia).
- Área `(patrocinador)` con login propio: **solo agregados pseudonimizados** vía RPC `security definer` con k-anonimato ≥5: curva de persistencia (Kaplan-Meier simple sobre `pautas_medicacion.discontinuada_en`), meses-en-tratamiento (mediana/distribución), adherencia media mensual, motivos de discontinuación codificados (barras), tasa de check-in (el KPI de engagement contra el benchmark Noona 90%), alertas por nivel y tiempo-hasta-disposición. CERO datos identificables; export PDF con el patrón de informes existente.
- **Modo demo:** flag `DEMO_MODE` que sirve el dashboard sobre el seed oncológico con marca de agua "DEMO — datos sintéticos". Es la pantalla de la primera reunión con farma; debe funcionar en local sin claves.
- **Seed oncológico demo** (sustituye al cardiovascular): 8–12 pacientes de mama, 45 días, tendencias creíbles, 2 discontinuaciones con motivo, distrés variado, alertas en todos los estados CON disposición y desenlace. Guion de demo documentado (qué enseñar en 10 minutos).
- Test de privacidad: la suite de acceso cruzado se amplía — el rol patrocinador no puede leer NINGUNA tabla de pacientes ni cortes <5.

### WP-15 — Informe ROI pagador *(sprint 2; captura desde el paciente 1)*

- Métricas: urgencias evitadas/100 pacientes-mes (proxy v1: disposiciones con desenlace `resuelto_sin_evento` sobre alertas contactar/urgencia — definición honesta documentada en el propio informe), tiempo-hasta-escalado (señal→alerta→disposición), tasa de respuesta al check-in, persistencia. Todas salen de datos ya capturados por la regla de oro 3 — por eso la disposición entra en el sprint 1.
- Entregable: informe imprimible por cohorte/período (reutiliza el patrón de informes + validador de cifras) con las definiciones metodológicas al pie.
- Sin ML, sin proyecciones: v1 reporta lo observado (regla de oro 4).

### WP-18 — Farmacovigilancia mínima viable *(se construye tras la primera LOI; se muestra en el deck desde ya)*

- `eventos_adversos`: `paciente_id`, `origen` (observación/señal/checkin FK), `farmaco_sospechoso` (pauta FK), `descripcion`, `gravedad check in ('no_grave','grave')`, `estado check in ('detectado','en_revision','confirmado','descartado','exportado','acusado')`, `detectado_en`, `sla_vence_en` (= detectado_en + 24h), `revisado_por`, `paquete jsonb`, `exportado_en`, `acuse jsonb`.
- Detección: heurística determinista sobre observaciones/señales que mencionan fármaco activo + evento (sin LLM decisor: el LLM solo PRE-señala candidatos; la confirmación es humana — regla de oro 4).
- Cola de revisión en el panel (rol profesional designado): confirmar/descartar con motivo; al confirmar se genera **paquete exportable** (JSON+PDF con los campos mínimos de un ICSR simplificado: paciente pseudonimizado, fármaco, evento, fechas, desenlace, reportador) con acuse de recibo y auditoría completa.
- Reloj SLA visible (24h) + email de aviso al vencimiento (reutiliza Resend). El formato exacto del paquete se ajusta al contrato del laboratorio (por eso se construye tras la LOI).

### WP-19 — Cuidador-proxy pediátrico *(puerta: asociación/fundación)*

- `tipo_sujeto='menor_proxy'`: el **titular de la cuenta es el cuidador adulto** (`cuidador_titular_id`); el menor es el sujeto clínico pero NO usuario. Diferencia clave con el WP-14 aparcado (allí el paciente adulto era el titular).
- Consentimientos: `parental` (obligatorio, del titular) + `asentimiento_menor` registrado según edad (`[PENDIENTE LEGAL]` el umbral y texto por país) + los estándar.
- Guion conversacional 100% en 3ª persona ("¿Cómo ha pasado la noche ▸nombre del niño◂? ¿Le diste la medicación de la mañana?"); `construirContexto` inyecta el modo proxy; test que verifica que NINGÚN texto generado se dirige al menor.
- Gate técnico (regla de oro 2): si `tipo_sujeto='menor_proxy'` y la sesión no es del `cuidador_titular_id` → 403; imposible instanciar check-in "como el menor". Escalado: los avisos van al cuidador titular Y al equipo hospitalario.
- Programa seed `onco_pediatrica_proxy` (dominios: síntomas del niño, adherencia, estado del cuidador — el distrés DEL CUIDADOR también se criba, valor diferencial para la fundación).

## 6. Plan de sprints y puertas

| Cuándo | Trabajo técnico | Puerta que lo desbloquea |
|---|---|---|
| Semana 1-2 (paralelo a las 3 llamadas) | **WP-10** (deuda técnica, sin puerta) | — |
| Sprint 1 | **WP-11 v2** (arquitectura + disposición + catálogos con `[PENDIENTE CLÍNICO]`) → al volver la llamada 1, fijar umbrales | Arquitectura: ninguna · Umbrales: llamada 1 (psicooncólogo) |
| Sprint 1-2 | **WP-16** (termómetro) | Llamada 1 |
| Sprint 2 | **WP-17** (dashboard patrocinador + seed demo + modo demo) y **WP-15** (ROI) | Ninguna — es la demo de venta. **Fin de sprint 2 = demo completa vendible** (Memoria §13) |
| Tras primera LOI | **WP-18** (farmacovigilancia al formato del contrato) | LOI/contrato farma |
| Tras compromiso asociación/fundación | **WP-19** (pediátrico) | Llamada 2 / fundación |
| Cuando haya claves | **WP-09** (producción + E2E; la venta no lo espera) | Claves del fundador |

## 7. Privacidad y regulatorio técnico (resumen operativo)

- **Patrocinador nunca ve nivel paciente**: sin políticas RLS de lectura sobre tablas clínicas; solo RPC de agregados con k≥5; test automatizado en la suite de acceso cruzado.
- **Uso secundario**: opt-in separado, revocable, trazado; el corpus para RWE se construye SOLO sobre pacientes con ese consentimiento; exclusión efectiva al revocar (test).
- **Menores**: interlocución exclusiva con el titular adulto verificada server-side + por test; consentimiento parental bloqueante.
- **Intended purpose**: ningún texto de UI/marketing en el repo describe predicción, diagnóstico ni triaje autónomo; el escalado se describe como "reglas configuradas por su equipo clínico". Revisión de textos como criterio de aceptación de cada WP.
- **Auditoría**: disposiciones, exportaciones de farmacovigilancia y accesos de patrocinador quedan en `eventos_auditoria`.

## 8. La demo vendible (fin de sprint 2 — definición de "hecho")

En local, sin claves de producción, compartiendo pantalla: (1) check-in por voz de una paciente demo del programa terapia oral que reporta fiebre → pantalla de escalado empática; (2) bandeja del profesional con la alerta y su evidencia → disposición estructurada en 3 clics; (3) ficha 360º con termómetro de distrés y adherencia; (4) dashboard del patrocinador en modo demo: persistencia, motivos de discontinuación, tasa de check-in; (5) informe ROI. Guion de 10 minutos documentado en `docs/DEMO-GUION.md` (entregable de WP-17).
