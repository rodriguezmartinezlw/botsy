# BOTSY — Memoria de Producto y Proyecto

**Versión:** 1.0 · **Fecha:** 16 de julio de 2026
**Autor:** Luis Rodríguez (fundador)
**Estado:** Documento fundacional — pendiente de validación clínica (psicooncólogo) y de las tres conversaciones de apertura (§14)
**Ubicación sugerida en repo:** `docs/MEMORIA-PROYECTO.md`

---

## 1. Resumen ejecutivo

**Botsy** es un asistente sanitario conversacional por voz que acompaña a diario a pacientes oncológicos en tratamiento, convierte la conversación en datos clínicos estructurados (adherencia, síntomas, distrés) y escala señales de riesgo al equipo clínico mediante un protocolo determinista de 4 niveles. El paciente habla; el profesional decide; la IA nunca diagnostica.

**Vertical de entrada:** cáncer de mama (terapia oral y tratamiento activo), en español, en Perú/Colombia como primeros mercados. **Programa segundo:** oncología pediátrica mediante módulo cuidador-proxy (la IA no conversa con menores).

**Quién paga:** los laboratorios farmacéuticos, vía Programas de Soporte al Paciente (PSP) — el mecanismo por el que farma ya financia adherencia y monitorización en LatAm precisamente porque no existe reembolso público. Segundo pagador (año 2): aseguradoras oncológicas capitadas (Oncosalud, Hapvida), para quienes cada hospitalización evitada es ahorro directo — la capitación sustituye al código de reembolso.

**Por qué ahora y por qué nosotros:** el modelo está validado dos veces con exit (Kaiku Health→Elekta; Noona→Varian) y el modelo de contrato farma está firmado dos veces con Pfizer (Sidekick Health). Ninguno de los precedentes es conversacional por voz ni opera en español/portugués ni en LatAm. El fundador aporta lo que ningún entrante tiene: 8 años vendiendo tecnología clínica a los compradores exactos de este plan (Auna, Oncosalud Radioncología, Instituto de Salud del Niño), contactos activos en Pfizer, Roche y Boston Scientific en Perú, Colombia y Brasil, relaciones con asociaciones de pacientes, y un producto en fase F1 completa con arquitectura de calidad auditada.

**Objetivo del proyecto:** primera factura en Q4 2026–Q1 2027; $200-400K en 2027; EBITDA positivo en 2028; opción de venta estratégica en 2030 en rango $5-12M. **Regla de corte:** si en abril de 2027 no hay un piloto pagado ≥$40K firmado, el proyecto se cierra ordenadamente (§13).

---

## 2. Origen y fundador

FeelsGood (feelsgood.care, fundada 2018) — realidad virtual para reducción de dolor en procedimientos médicos, nacida de la experiencia de la abuela del fundador tras un ictus:

- +10.000 procedimientos sin dolor en **5 países** (Perú, Brasil, Colombia, México, Ecuador).
- Clientes: Clínica Delgado Auna, **Oncosalud Radioncología**, Instituto de Salud del Niño de San Borja, Las Américas Auna (Colombia).
- 4 productos, incluido **VR Physio para post-mastectomía** — experiencia directa con la población de cáncer de mama.
- Comité científico con psicooncólogo. Beneficiario de Innóvate Perú.

**Activos aplicables a Botsy:**

| Activo | Aplicación directa |
|---|---|
| Contactos en Pfizer, Roche y Boston Scientific (Perú, Colombia, Brasil) | Ruta A de venta: piloto PSP con filial |
| Relaciones con asociaciones de pacientes | Canal de co-diseño, reclutamiento del piloto y legitimidad |
| Médicos de cáncer de mama y oncopediatría | Validación clínica de umbrales y primeros centros |
| Clientes históricos Auna / Oncosalud | Pagador capitado del año 2 |
| Credibilidad en radioncología | Los compradores de los dos exits precedentes (Varian, Elekta) son proveedores de ese ecosistema |
| Capacidad técnica full-stack propia | CTO = fundador; margen alto en fase servicios |

**Lección incorporada de la etapa anterior:** FeelsGood demostró que se puede vender a hospitales LatAm y no poder cobrar a escala — el mercado carecía de mecanismo de pago. Botsy invierte el orden: el pagador (farma / capitado) está identificado antes de terminar el producto, y cada módulo clínico se desbloquea con una conversación real, no con fe.

---

## 3. El problema

1. **Adherencia en terapia oncológica oral.** La hormonoterapia adyuvante en cáncer de mama dura 5-10 años de pastilla diaria; las tasas de abandono documentadas son altas y cada paciente que discontinúa representa decenas de miles de dólares anuales de tratamiento perdido para el laboratorio y peor pronóstico para la paciente. En terapias dirigidas orales (p. ej. palbociclib), los efectos adversos gestionables mal detectados (neutropenia febril, diarrea, fatiga) provocan discontinuaciones evitables y urgencias caras.
2. **Monitorización de síntomas entre visitas.** El estándar actual es "espere a la próxima cita o vaya a urgencias". La evidencia (Basch et al., JAMA — *pendiente de revisión con psicooncólogo del proyecto*) asocia la monitorización sistemática de síntomas reportados por el paciente con menos urgencias, menos hospitalizaciones y beneficio de supervivencia.
3. **Distrés psicológico no cribado.** El cribado de distrés es estándar de cuidado en oncología (NCCN) y requisito de acreditación, y en la práctica se hace de forma irregular. El sufrimiento oncológico (distrés, trastorno adaptativo, miedo a la recurrencia, desmoralización) no es el objeto de las plataformas de salud mental generalistas.
4. **El hueco geográfico-lingüístico.** Los precedentes (Kaiku, Noona) operan en Europa/EE.UU. con formularios en inglés. No existe un actor conversacional por voz en español/portugués en LatAm/Iberia. Los call centers de enfermería de los PSP actuales llaman una vez al mes; el problema ocurre a diario.

---

## 4. La solución

**Dos caras conectadas** (estado técnico en §10):

- **App del paciente (PWA móvil-first):** check-in conversacional diario por voz o texto ("Hola María, ¿cómo te ha ido hoy?"). La conversación se estructura en: adherencia a medicación, dolor 0-10, síntomas (vocabulario CTCAE simplificado), ánimo/ansiedad/estrés, sueño, cognición. Señal de riesgo → protocolo de escalado de 4 niveles (normal → vigilancia → contactar médico → urgencia) con lenguaje empático.
- **Dashboard del profesional (web):** lista de pacientes con semáforo, ficha 360º con tendencias, bandeja de alertas con evidencia, reglas de escalado configurables por programa, informes con resumen ejecutivo validado (el LLM no puede introducir cifras ausentes de los datos).

**Reglas de oro innegociables:**

1. Botsy **nunca diagnostica ante el paciente**. Detecta señales, las comunica con calma y deriva. El diagnóstico es humano.
2. **La IA no conversa con menores.** En pediatría, el interlocutor es siempre el cuidador adulto (§5.2).
3. **Toda alerta se resuelve con disposición estructurada obligatoria** (decisión + motivo codificado + desenlace a X días). Es la semilla del activo de datos (§7.4) y no es retrofiteable.
4. **v1 no predice ni sugiere.** El sistema captura decisiones clínicas; no las genera. "Capturar primero, aprender después" (§9).

**Arquitectura de programas:** cada paciente recibe un *programa* = prescripción empaquetada de módulos, guion de check-in, reglas de escalado, frecuencia y ciclo de vida. La misma plataforma sirve a verticales distintas sin bifurcar el código.

---

## 5. Vertical de entrada

### 5.1 Cáncer de mama — la convergencia de activos

Única indicación donde todos los activos del proyecto apuntan al mismo punto:

| Dimensión | Evidencia |
|---|---|
| Contacto Pfizer | Ibrance (palbociclib) es fármaco estrella en mama; su efecto adverso principal es la neutropenia — la regla "fiebre ≥38 en tratamiento activo = urgencia" ya está en la spec de Botsy |
| Contacto Roche | Franquicia HER2+ (Herceptin, Perjeta, Phesgo); su programa DPMM publicó el estudio con Kaiku Health precisamente en **mama** y pulmón |
| Historia del fundador | VR Physio para post-mastectomía: población ya conocida |
| Red médica | Oncólogos de mama confirmados |
| Asociaciones | Las de cáncer de mama son las más organizadas y activas de la región |
| Clínica | Terapia oral de 5-10 años: el problema de adherencia más caro y mejor documentado de la oncología |

**Dos programas iniciales:** «Terapia oral» (adherencia diaria + fiebre/diarrea/fatiga) y «Tratamiento activo» (quimio/HER2: síntomas de ciclo, distrés).

### 5.2 Oncología pediátrica — programa 2, con rediseño innegociable

- La IA **no conversa con el niño** (v1 ni v2). Razones: escrutinio regulatorio máximo sobre menores+IA conversacional (ola legislativa 2026), consentimiento parental y estándar de interés superior (RGPD/LGPD), y modo de fallo intolerable.
- Diseño: **módulo cuidador-proxy** — el padre/madre hace el check-in por voz sobre su hijo; asentimiento del menor según edad; escalado al equipo hospitalario.
- Rol en el proyecto: reputacional y de misión (con las asociaciones y el historial en el Instituto de Salud del Niño), financiado vía fundación/RSC de laboratorio ($20-60K). **Mama financia la empresa; pediatría la legitima.**

---

## 6. Precedentes verificados (evidencia de mercado)

| Empresa | Qué era | Contratos farma | Desenlace | Qué prueba |
|---|---|---|---|---|
| **Kaiku Health** (Finlandia) | Monitorización ePRO de síntomas oncológicos | Novartis (melanoma), Amgen (mieloma), **Roche** (partnership estratégico DPMM 2022, estudio conjunto en mama/pulmón en *The Oncologist*), BMS | **Adquirida por Elekta (2020)** con solo $5,4M de Serie A, 40+ clínicas europeas, módulos para 25+ cánceres | El producto exacto se vende a farma y sale a estratégico sin megarrondas |
| **Noona** (Finlandia) | App de PROs oncológicos | — (venta a clínicas/redes: Tennessee Oncology, 30+ centros, ~25.000 pac/año) | **Adquirida por Varian (2018)**, hoy Siemens Healthineers | Métricas de compra: reducir hospitalizaciones/urgencias; 60 min/día ahorrados por clínico; 90% tasa de respuesta; triaje por severidad |
| **Sidekick Health** (Islandia) | Plataforma DTx/PSP gamificada | **Pfizer** (2020 cesación tabáquica; 2022 dermatitis atópica, despliegue UK→8 países, relación "multimillonaria" con plan a 24 mercados; KPI: adherencia, +83% en estudio de viabilidad), Bayer (2019) | Activa; $75M levantados | El modelo de contrato "farma paga PSP digital white-label" está firmado dos veces con Pfizer |

**Lecturas estratégicas:** (a) los tres nacen en países de ≤5,5M de habitantes — mercado doméstico pequeño no es obstáculo, es el patrón; (b) la secuencia fue clínicas locales → evidencia → farma por filial → multi-mercado → exit a estratégico; (c) **los compradores de los dos exits (Varian, Elekta) son los fabricantes del duopolio de radioterapia — proveedores del ecosistema donde el fundador operó 8 años** (verificar qué marca de acelerador usa Oncosalud Radioncología); (d) los exits fueron de decenas de millones, no unicornios — coherente con el plan a 5 años de este proyecto.

**Diferenciación de Botsy frente a los precedentes:** conversacional por **voz** (ellos: formularios), **español/portugués nativo**, **LatAm/Iberia** (territorio vacío), y componente de **distrés psicooncológico** (Termómetro NCCN conversacional).

**Honestidad estratégica:** nadie ha validado aún voz conversacional en PSP oncológico. Es la hipótesis diferencial y también el riesgo; el piloto existe para medirla contra el benchmark conocido (90% de respuesta de Noona con formularios).

---

## 7. Modelo de negocio

### 7.1 Pagadores y precios

| Cliente | Qué compra | Precio | Primera factura estimada |
|---|---|---|---|
| **Ruta A — Filial farma** (Pfizer/Roche, PE-CO-BR) | Piloto PSP conversacional para 1 fármaco (100-300 pacientes, 6-9 meses) | **$60-200K piloto** → $150-500K/año al escalar | 4-8 meses desde primera llamada con intro caliente |
| **Ruta B — Operador PSP establecido** (Interplayers, Funcional Health Tech, Axenya) | Licencia de la capa conversacional sobre su cartera | $10-20/pac/mes + setup $30-80K | 2-4 meses; cheque menor, distribución mayor |
| **Pagador capitado** (Oncosalud, Auna, Hapvida, Unimed) — año 2 | Monitorización de pacientes en tratamiento activo | $25-50/pac activo/mes → $150-900K/año | 9-15 meses; requiere el informe ROI del piloto 1 |
| **España/Europa** (Sanitas y aseguradoras integradas; DiGA alemana como opción tardía) — año 3 | Ídem, con evidencia LatAm | $60-100/pac/mes | Año 3 |
| **Fundación/RSC farma** (programa pediátrico vía asociación) | Programa de acompañamiento | $20-60K | Potencialmente la primera factura del proyecto (ciclo más corto) |

**Lógica del pagador capitado:** en LatAm los grandes pagadores privados son verticalmente integrados (dueños de las clínicas) o planes prepagados (Oncosalud). Cada complicación evitada es ahorro directo suyo — **la capitación sustituye al código de reembolso**. No hay que esperar a que un regulador cree la vía de pago.

**Asociaciones de pacientes = canal, no pagador.** Aportan confianza, co-diseño y reclutamiento del piloto; su dinero es de farma con otra camiseta. Se les pide compromiso concreto (5 pacientes con nombre para la fase demo), no dinero.

### 7.2 Lo que NO es el modelo

- No B2C: el paciente no paga (cementerio documentado del sector: caída de financiación -50% 2021→2024; cierre de Woebot consumer).
- No suscripción al clínico autónomo (peor comprador de SaaS; deber de vigilancia sin guardia 24/7).
- No $29/mes: el precio declara quién es el cliente, y el cliente es farma/pagador, no el paciente.

### 7.3 Estructura de costes relevante

Voz vía OpenAI Realtime (gpt-realtime-2.1-mini, WebRTC): $3-7,5/usuario/mes, tras abstracción `VoiceSession` migrable de proveedor. A precios de PSP ($60-200K/piloto) el coste de voz es marginal; a $29/mes era letal. El pricing por paciente debe mantener margen bruto ≥75%.

### 7.4 El activo de datos (valor de opción, no modelo de negocio del año 1)

- **Corpus longitudinal de conversación clínica oncológica en español/portugués** + **dataset etiquetado de triaje real** (señal → disposición estructurada del clínico → desenlace). Nadie lo tiene; no se puede raspar; solo se acumula operando.
- Habilitadores desde el día 1: disposición estructurada obligatoria; consentimiento **separado y opcional** de uso secundario con trazabilidad propia.
- Monetización realista: RWE para farma (el propio patrocinador del PSP es el primer comprador), EHDS europeo en su despliegue 2027-2029, y base del futuro producto Clase IIa entrenado sobre datos propios.
- Regla: se diseña ahora, se cobra ≥2029. No se pitchea como revenue del año 1.

---

## 8. Roadmap de producto

### 8.1 Fase Piloto (~3 sprints)

| # | Módulo | Contenido | Exigido por |
|---|---|---|---|
| 1 | **Núcleo de programas** (WP-11 recortado) | Arquitectura de programas con seed de **2 programas de mama** («Terapia oral», «Tratamiento activo») + disposición estructurada obligatoria en alertas | Base de todo; corpus |
| 2 | **Termómetro de Distrés conversacional** | Instrumento NCCN (0-10 + lista de problemas) administrado por voz en el check-in; umbrales validados por psicooncólogo | Diferencial psicooncológico |
| 3 | **Dashboard del patrocinador** | Vista agregada/pseudonimizada para farma: curvas de persistencia, meses-en-tratamiento, motivos de discontinuación codificados; **modo demo sobre seed de 45 días** | Farma — es la pantalla de la primera reunión |
| 4 | **Informe ROI pagador** (WP-15) | Urgencias evitadas/100 pacientes-mes, tiempo-hasta-escalado; línea base desde el paciente 1 | Pagador capitado (año 2), capturado desde el día 1 |
| 5 | **Farmacovigilancia mínima viable** | Detección de evento adverso → cola de revisión → paquete de reporte exportable con acuse y auditoría (SLA 24h) | **Condición de entrada de todo contrato farma**; se construye tras la primera LOI, se enseña en el deck desde ya |
| 6 | **Cuidador-proxy pediátrico** | El adulto reporta por voz sobre el menor; consentimiento parental + asentimiento; el menor no interactúa con la IA | Asociación/fundación; programa 2 |

### 8.2 Aparcado deliberadamente (no muerto)

Alzheimer · plantilla TCC · post-cirugía (se despierta solo si Boston Scientific tira: su modelo es monitorización ligada a dispositivo — carril de año 2) · toda predicción/sugerencia de IA (§9) · todo B2C · **pt-BR** (se construye como entregable pagado del primer contrato brasileño, no por fe).

### 8.3 Regla de puertas

**Cada WP clínico queda bloqueado no solo por claves, sino por una conversación con su clínico o su pagador.** WP de mama ↔ psicooncólogo/oncólogo de mama; módulo 6 ↔ asociación o fundación; pt-BR ↔ contrato brasileño. Si un módulo no consigue su llamada, no tenía mercado y se ahorra el sprint. El coste de cada módulo no es tiempo de programación: es una llamada.

---

## 9. Estrategia regulatoria

**Principio rector: modularizar el riesgo regulatorio igual que el producto.**

1. **v1 (piloto): fuera de la zona de predicción.** Botsy v1 captura reportes del paciente, los estructura y los presenta; el escalado es determinista por reglas configuradas por el profesional; no hay diagnóstico, predicción ni sugerencia terapéutica generada por IA. El *intended purpose* comercial se redactará con consultor regulatorio **antes** de publicar material de venta — la clase del dispositivo la determina el propósito declarado, no la tecnología (MDR Regla 11; MDCG 2019-11 rev.1 de junio 2025 lleva explícitamente prognosis/predicción a Clase ≥IIa).
2. **El motor de escalado es un módulo activable.** Configuraciones ligeras (diario estructurado, captura de PROs, scribe) frente a configuraciones que constituyen triaje clínico — vendibles por separado según mercado y clase.
3. **"Capturar primero, aprender después."** Años 1-2: el sistema registra decisiones clínicas (disposición estructurada) sin generarlas — sin problema regulatorio y acumulando el activo. Año 3+: con corpus y marcado CE en curso, evaluar la capa de sugerencia (algoritmo adaptativo ⇒ MDR + AI Act en su máxima exigencia).
4. **Brasil:** ANVISA regula SaMD (RDC 657/2022, 751/2022, 830/2023) e incluye "monitorización" en la definición; LGPD/ANPD en paralelo; prever residencia de datos local. La entrada a Brasil se hace con la configuración ligera y con el contrato pagando la adecuación.
5. **Farmacovigilancia:** todo programa financiado por laboratorio obliga contractualmente a reportar eventos adversos en plazos duros (típicamente 24h del proveedor al laboratorio). El módulo 5 convierte esta obligación en ventaja competitiva frente a operadores tradicionales.
6. **Menores:** consentimiento parental, asentimiento por edad, interlocución exclusiva con el cuidador (§5.2).
7. **Privacidad:** RLS estricta ya auditada; consentimientos granulares con opt-in separado de uso secundario; farma solo ve agregados/pseudonimizados — documentado así en contrato y en la arquitectura.

---

## 10. Estado técnico actual (F1 completo — julio 2026)

- **Repo:** github.com/rodriguezmartinezlw/botsy · 12 commits · **113 tests en verde** · RLS auditada en 11 tablas sin defectos · cero secretos en bundle cliente · TypeScript estricto sin `any`.
- **Stack:** Next.js 16 (App Router; áreas paciente/panel/auth) · Supabase (migraciones 0001-0004, RLS estricta) · OpenAI (texto con Zod; Realtime con token efímero server-side) · Recharts · Vitest · Vercel (previsto).
- **Construido (WP-00..08):** scaffolding · esquema+RLS+auth por roles · motor conversacional compartido texto/voz · voz WebRTC con grabación solo bajo consentimiento · motor de escalado determinista con alertas idempotentes y aviso inmediato · perfil con gráficos · dashboard profesional completo · informes con validador anti-alucinación de cifras · cron de recordatorios · consentimientos granulares · hardening + seed demo 45 días.
- **Protocolo de trabajo:** flujo director/implementador con WPs, entregas y revisiones documentadas; migraciones inmutables; CLAUDE.md vinculante (reglas clínicas, RLS, Zod en salidas de LLM, secretos por env, español).
- **Pendiente que solo el fundador puede aportar:** claves (Supabase, OpenAI incl. Realtime, Resend, Vercel Pro) · textos legales · diligencia RGPD/DPA · **validación clínica de umbrales** (= la llamada al psicooncólogo, §14).
- **Nota comercial clave:** el bloqueo de claves impide producción, **no impide vender** — la demo completa funciona en local sobre el seed compartiendo pantalla.

---

## 11. Plan financiero a 5 años

| Año | Hito | Ingresos | Estructura |
|---|---|---|---|
| **2026 H2** | 3 llamadas de apertura → 1 piloto firmado; demo sobre seed | Primera factura Q4'26-Q1'27 | Fundador solo |
| **2027** | 2 pilotos ejecutados; farmacovigilancia + pt-BR sobre contrato real; 1 piloto→anual | **$200-400K** | Fundador + clínico part-time + dev subcontratado |
| **2028** | 3-5 contratos (2 farma, 1 pagador, ±1 operador) | **$700K-1,2M · EBITDA positivo** | Equipo mínimo; corpus creciendo |
| **2029** | Brasil consolidado; España abre con evidencia LatAm | **$1,5-2,5M** | Conversaciones estratégicas entrantes |
| **2030** | Venta a estratégico (3-6× ingresos según mix producto/servicio y valor del corpus) | **Exit $5-12M** — o cosecha de dividendos ($2M/año al ~60% de margen) | — |

**Probabilidades honestas:** ~30-40% de que los pilotos no conviertan (<$150K acumulados a fin de 2027) · ~40% de escenario intermedio (negocio de servicios $500K-1M/año, vendible por pocos millones o cosechable) · ~20-25% del escenario de la tabla. **Coste de oportunidad de referencia:** perfil CTO/consultor senior en Europa ≈ €100-150K/año casi garantizados. La apuesta se hace sabiéndolo.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Hipótesis de voz no validada** (nadie ha probado voz conversacional en PSP oncológico) | El piloto mide tasa de respuesta contra el benchmark de Noona (90% con formularios); si la voz no supera al formulario en esta población, pivotar la capa de entrada sin tirar el motor |
| **Ingresos farma "lumpy"** (los PSP viven atados al ciclo del fármaco) | Diversificar a 2-3 laboratorios antes de año 3; añadir pagador capitado como segunda pata |
| **Ciclo de venta institucional lento** | Arrancar reloj de venta y de desarrollo el mismo día; ruta B (operadores PSP) como caja rápida; asociaciones como ciclo corto |
| **Deriva regulatoria** (que el escalado se lea como triaje clínico SaMD) | Intended purpose con consultor antes de material comercial; modularización; entrada a Brasil con configuración ligera |
| **Riesgo de copia por operadores PSP** (ruta B) | Velocidad, corpus propio, y contrato con farma a nombre propio (ruta A) en paralelo |
| **Fundador único** | Regla de corte dura (§13); no escalar equipo antes de la primera factura; buscar socio comercial si la ruta A se atasca por ancho de banda |
| **Engagement del paciente** (mayor, deprimido, en tratamiento) | Es precisamente la tesis de la voz; medir día 14 y día 45 en demo con las 5 pacientes de la asociación antes del piloto pagado |
| **Deber de vigilancia** (dato de riesgo fuera de horario) | Solo se vende a organizaciones con guardia 24/7 al otro lado del escalado; nunca a clínico autónomo sin cobertura |

---

## 13. Hitos y regla de corte

- **Semana 1-2:** las tres llamadas (§14). WP-10 (deuda técnica) en paralelo.
- **Fin sprint 2:** demo completa vendible (check-in por voz → escalado → dashboard patrocinador) sobre seed.
- **Q4 2026:** primera LOI o primer contrato (asociación/fundación o piloto farma).
- **Q1 2027:** primera factura.
- **⛔ ABRIL 2027 — REGLA DE CORTE:** si no hay un piloto pagado de **≥$40K firmado** (con red caliente, no en frío), el mercado ha hablado: cierre ordenado, corpus y código como activos, y transición al plan CTO sin drama. Sin esta regla, Botsy es el proyecto seis con mejor arquitectura.

---

## 14. Próximos pasos inmediatos (las tres llamadas)

1. **Psicooncólogo** — valida umbrales de los 2 programas de mama y la versión conversacional del Termómetro de Distrés. Desbloquea módulos 1-2. *Pregunta central: "¿Qué recibe realmente tu paciente un martes cualquiera, qué debería recibir, y qué señal te gustaría tener antes de la consulta?"*
2. **Asociación de pacientes de mama** — co-diseño + compromiso concreto: **5 pacientes con nombre** para la fase demo. Desbloquea la medición de engagement y sustituye al "paciente de relleno" del mockup por personas reales.
3. **Contacto Pfizer o Roche (Perú o Colombia)** — pregunta precisa: *"¿Quién lleva programas de soporte al paciente / DPMM en la filial? Estamos midiendo adherencia y síntomas en cáncer de mama con voz en español y quiero enseñároslo."* Desbloquea la ruta A.

**Orden recomendado:** 1 → 2 → 3 (la validación clínica arma la demo; la demo arma la reunión farma). Ventana objetivo: **antes del 1 de agosto de 2026**.

---

*Este documento consolida decisiones tomadas y evidencia verificada entre el 15 y el 16 de julio de 2026. No contiene hipótesis nuevas: contiene las conversaciones pendientes que las convierten en proyecto. La memoria se convierte en proyecto en el momento de la primera llamada — no antes.*
