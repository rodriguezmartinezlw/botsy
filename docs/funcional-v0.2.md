# Botsy — Documentación Funcional (v0.2)

**Asistente inteligente sanitario multimodal**
Versión ampliada. Incorpora la visión extendida: conversación por voz natural, análisis de biomarcadores vocales, video-llamadas con IA y análisis facial/visual, recomendaciones de estilo de vida y protocolo de escalado al médico.

---

## 1. Visión ampliada del producto

Botsy es una plataforma de salud digital multimodal que acompaña al paciente a diario mediante **conversación natural por voz y video**, y que convierte cada interacción en datos clínicos estructurados y **biomarcadores digitales** (voz, rostro, comportamiento). Con ello:

1. **Monitoriza** el estado físico, cognitivo y emocional del paciente sin fricción — hablando, no rellenando formularios.
2. **Detecta y predice** complicaciones combinando lo que el paciente *dice* (contenido), *cómo lo dice* (voz) y *cómo se ve* (video).
3. **Interviene** en dos niveles: recomendaciones de estilo de vida/dieta al paciente, y alertas con protocolo de escalado ("llama a tu médico") cuando detecta señales de riesgo.
4. **Informa** al profesional sanitario mediante un dashboard predictivo con tendencias, alertas e informes.

### 1.1 Principio de diseño: pirámide de intervención

| Nivel | Quién actúa | Ejemplo |
|---|---|---|
| 1. Autocuidado | Botsy → paciente | Sugerencias de dieta, sueño, actividad, adherencia |
| 2. Escalado guiado | Botsy → paciente | "He detectado X, te recomiendo llamar a tu médico hoy" |
| 3. Alerta clínica | Botsy → profesional | Notificación en dashboard con evidencia y tendencia |
| 4. Emergencia | Botsy → paciente/contacto | Indicación de acudir a urgencias / llamar a emergencias (a definir alcance legal) |

**Regla de oro:** Botsy nunca diagnostica ante el paciente; detecta señales, las comunica con lenguaje no alarmista y deriva al profesional. El diagnóstico y la decisión clínica son siempre humanos.

---

## 2. Módulo: Check-in conversacional por voz (núcleo de la app)

### 2.1 Descripción

Conversación diaria guiada por voz natural (con alternativa por texto). Botsy conduce la conversación con un objetivo claro: **completar la ficha diaria del paciente**, y no termina hasta cubrir todos los dominios pendientes o hasta que el paciente decida parar.

### 2.2 Flujo de la conversación diaria

1. **Apertura** — saludo personalizado y pregunta abierta: "Hola Luis, ¿cómo te ha ido hoy?"
2. **Escucha abierta** — el paciente habla libremente; la IA extrae todo lo que ya responde espontáneamente (dolor, ánimo, medicación…) para no repetir preguntas.
3. **Recorrido dirigido** — Botsy pregunta solo por los dominios aún sin cubrir:
   - Adherencia farmacológica ("¿Tomaste la warfarina esta mañana?") — confirmación por fármaco y toma.
   - Dolor (presencia, localización, intensidad 0–10, comparación con días previos).
   - Síntomas físicos (nuevos o recurrentes: infecciones, alergias, otros).
   - Estado mental y emocional (ánimo, ansiedad, estrés, sueño percibido).
   - Cognición (preguntas ligeras integradas de forma natural; ver módulo de voz §3).
   - Terapias y tratamientos (efectos, efectos adversos).
   - Estilo de vida (comida, actividad, hábitos del día).
4. **Repreguntas inteligentes** — si una respuesta es ambigua o clínicamente relevante, Botsy profundiza ("¿Ese dolor de cabeza es distinto al habitual?").
5. **Detección en tiempo real** — si durante la conversación se detecta una señal de riesgo (síntoma de alarma, combinación peligrosa, no-adherencia crítica), se activa el **protocolo de escalado** (§2.4).
6. **Cierre con avances** — resumen hablado + visual: "Hoy completaste tu medicación, tu dolor bajó respecto a ayer y llevas 5 días seguidos de registro". Refuerzo positivo y racha (streak).
7. **Recomendación del día** — una sugerencia accionable de estilo de vida (§5).

### 2.3 Requisitos funcionales

- **RF-CV-01** — Conversación por voz full-duplex: STT (speech-to-text) + LLM + TTS con voz natural, con latencia conversacional (< ~1,5 s por turno como objetivo).
- **RF-CV-02** — Modo texto equivalente para entornos donde no se pueda hablar.
- **RF-CV-03** — Motor de "completitud de ficha": checklist interna de dominios; la conversación termina cuando todos están cubiertos o el paciente la cierra.
- **RF-CV-04** — Extracción estructurada: cada turno se mapea a entidades clínicas (síntoma, intensidad, fármaco, toma, emoción) con confianza asociada.
- **RF-CV-05** — Memoria longitudinal: Botsy recuerda conversaciones anteriores ("Ayer me dijiste que te dolía la rodilla, ¿cómo sigue?").
- **RF-CV-06** — Personalización del guion por condición clínica (cardiovascular, geriátrica, mental, crónica, ocupacional) y por prescripción del profesional.
- **RF-CV-07** — Recordatorios push si el paciente no ha hecho el check-in a su hora habitual.
- **RF-CV-08** — Resolución de consultas comunes durante la conversación (dudas de medicación, citas), con límites claros de lo que no puede responder.
- **RF-CV-09** — Accesibilidad: ritmo de habla ajustable, repetición, subtítulos, vocabulario sencillo (crítico en geriatría).
- **RF-CV-10** — Multiidioma (ES/PT/EN como mínimo, según mercados del deck).

### 2.4 Protocolo de escalado ("llama a tu médico")

- **RF-ES-01** — Motor de reglas + modelo de riesgo que clasifica cada check-in en: normal / vigilancia / contactar médico / urgencia.
- **RF-ES-02** — Ante "contactar médico": mensaje empático no alarmista, botón de llamada directa al médico/centro configurado, y registro del evento.
- **RF-ES-03** — Ante "urgencia" (síntomas de alarma definidos clínicamente por vertical, p. ej. dolor torácico + disnea en paciente cardiovascular): indicación clara de acudir a urgencias/llamar a emergencias y notificación inmediata al profesional y, opcionalmente, a un contacto de confianza.
- **RF-ES-04** — Toda escalada genera una alerta en el dashboard con la evidencia (fragmento de conversación, métricas, tendencia) para revisión del profesional.
- **RF-ES-05** — Los umbrales y síntomas de alarma son configurables por el profesional por paciente/cohorte.
- **RF-ES-06** — Registro auditable de cada escalado (qué se detectó, qué se recomendó, qué hizo el paciente).

---

## 3. Módulo: Análisis de voz (biomarcadores vocales)

### 3.1 Descripción

Además del *contenido* de la conversación, Botsy analiza la *señal* de voz para extraer patrones de comportamiento y salud. La voz es un biomarcador digital con evidencia creciente en varios dominios; cada análisis debe tratarse como **señal de cribado**, nunca como diagnóstico.

### 3.2 Señales y casos de uso candidatos

| Dominio | Señales acústicas/lingüísticas | Uso en Botsy |
|---|---|---|
| Estado de ánimo / depresión / ansiedad | Prosodia plana, tono, energía, velocidad de habla, pausas | Tendencia emocional; complemento al autorreporte |
| Deterioro cognitivo (Alzheimer, demencia) | Pausas de búsqueda léxica, riqueza de vocabulario, repeticiones, coherencia del discurso | Seguimiento longitudinal en salud geriátrica |
| Fatiga / dolor | Cambios de intensidad, tensión vocal | Correlación con niveles de dolor reportados |
| Salud respiratoria | Patrón respiratorio al hablar, tos detectada | Vigilancia en crónicos/respiratorios |
| Párkinson y neurológico | Temblor vocal (jitter/shimmer), monotonía, articulación | Señal de seguimiento (exploratorio) |
| Estado general del día | Comparación con la línea base vocal del propio paciente | Detección de anomalías individuales |

### 3.3 Requisitos funcionales

- **RF-VZ-01** — Extracción de features acústicas por sesión (pitch, energía, jitter, shimmer, velocidad, pausas, ratio habla/silencio) y lingüísticas (riqueza léxica, coherencia, sentimiento).
- **RF-VZ-02** — **Línea base individual**: cada paciente se compara contra sí mismo (primeras N sesiones de calibración), no contra población general.
- **RF-VZ-03** — Series temporales de biomarcadores vocales visibles en el dashboard, con detección de desviaciones sostenidas (no puntuales).
- **RF-VZ-04** — Las señales vocales alimentan el motor de riesgo (§2.4) como una fuente más, ponderada y explicable.
- **RF-VZ-05** — Consentimiento específico y separado para el análisis de la señal de voz (distinto del consentimiento de la conversación).
- **RF-VZ-06** — Política de retención: definir si se guarda el audio crudo o solo las features derivadas (recomendado: features + fragmentos mínimos para auditoría clínica, con caducidad).
- **RF-VZ-07** — Robustez: control de calidad de audio (ruido, micrófono, distancia) para no generar falsas anomalías.

---

## 4. Módulo: Video-consulta con IA (análisis facial y visual)

### 4.1 Descripción

Sesiones de video-llamada con el avatar/asistente de Botsy en las que, además de la conversación, se analiza la imagen para obtener señales clínicas visuales. Puede ser una modalidad opcional del check-in diario o una "revisión semanal" más completa.

### 4.2 Señales y casos de uso candidatos

| Dominio | Señales visuales | Uso en Botsy |
|---|---|---|
| Estado emocional | Expresión facial, microexpresiones, frecuencia de sonrisa, mirada | Complemento al análisis de voz y autorreporte |
| Neurológico | Asimetría facial (señal de alarma de ictus), parpadeo, temblor, hipomimia | Escalado urgente en cardiovascular/neuro; seguimiento en Párkinson |
| Constantes por video (rPPG) | Fotopletismografía remota: frecuencia cardíaca, variabilidad, frecuencia respiratoria estimadas desde la cámara | Constantes sin wearable (exploratorio, requiere validación) |
| Dolor | Gestos de dolor (escalas tipo FACS aplicadas a dolor) | Contraste con dolor autorreportado |
| Aspecto general | Palidez, ictericia aparente, edema facial, cambios de peso aparente | Señales de cribado para el profesional |
| Fatiga / sueño | Ojeras, ptosis palpebral, bostezos | Correlación con monitorización del sueño |
| Piel (foto dirigida) | El paciente muestra a cámara una lesión/herida | Registro fotográfico evolutivo para el profesional |

### 4.3 Requisitos funcionales

- **RF-VD-01** — Video-llamada con el asistente (avatar o interfaz de voz con cámara activa), con guion clínico propio (puede incluir mini-pruebas guiadas: "sonríe", "levanta los brazos", "sigue mi dedo con la mirada" — protocolo tipo FAST para ictus en pacientes de riesgo).
- **RF-VD-02** — Análisis en tiempo real de señales de alarma visual (p. ej. asimetría facial súbita) con activación inmediata del protocolo de urgencia (§2.4).
- **RF-VD-03** — Análisis diferido del resto de señales (emocionales, fatiga, rPPG) con series temporales y línea base individual.
- **RF-VD-04** — Captura fotográfica dirigida de lesiones/heridas con etiquetado y línea de tiempo visual en la ficha del paciente.
- **RF-VD-05** — Los frames/video se procesan y se descartan por defecto; solo se conservan features, capturas autorizadas y clips mínimos de evidencia para revisión clínica.
- **RF-VD-06** — Consentimiento específico para video y para cada subtipo de análisis (emocional, constantes, facial), activables por separado.
- **RF-VD-07** — Condiciones de captura: guía al usuario (iluminación, encuadre) y control de calidad para descartar sesiones no válidas.
- **RF-VD-08** — Todas las inferencias visuales se muestran al profesional con nivel de confianza y disclaimer de cribado.

---

## 5. Módulo: Recomendaciones de estilo de vida y dieta

### 5.1 Descripción

Con toda la información recopilada (conversación, voz, video, dispositivo), Botsy genera sugerencias personalizadas de autocuidado: alimentación, actividad física, sueño, gestión del estrés y hábitos.

### 5.2 Requisitos funcionales

- **RF-RL-01** — Motor de recomendaciones basado en: condición clínica, medicación activa (interacciones alimentarias, p. ej. vitamina K–warfarina), tendencias recientes y preferencias del paciente.
- **RF-RL-02** — Formato "una recomendación al día" al cierre del check-in + sección de plan semanal en la app.
- **RF-RL-03** — Planes de dieta orientativos por condición (cardiosaludable, renal, etc.) con contenido revisado clínicamente; nunca pautas nutricionales terapéuticas sin validación del profesional.
- **RF-RL-04** — El profesional puede activar/desactivar categorías de recomendaciones, prescribir objetivos (pasos, sueño) y ver la adherencia a los mismos.
- **RF-RL-05** — Seguimiento de objetivos con datos del dispositivo (actividad, sueño) y refuerzo conversacional ("Llevas 3 días caminando 30 min, ¿seguimos mañana?").
- **RF-RL-06** — Biblioteca de contenidos educativos por condición (micro-lecciones, recetas, ejercicios) gestionable desde el panel de administración.
- **RF-RL-07** — Salvaguardas: ninguna recomendación puede contradecir la pauta del profesional; casos con banderas rojas (p. ej. trastornos de conducta alimentaria) desactivan recomendaciones numéricas de dieta.

---

## 6. Módulo: Motor de fusión multimodal y predicción

Pieza central del backend: combina todas las fuentes en un **perfil de riesgo dinámico** por paciente.

- **RF-MF-01** — Ingesta unificada de: datos conversacionales estructurados, biomarcadores vocales, señales visuales, datos del dispositivo (biometría, actividad, sueño, geoposición) y adherencia.
- **RF-MF-02** — Score de riesgo por vertical clínica con explicabilidad (qué señales lo componen y su peso) — imprescindible para confianza clínica y para regulación.
- **RF-MF-03** — Detección de anomalías respecto a la línea base individual en cualquier señal.
- **RF-MF-04** — Predicción de eventos definidos por vertical (p. ej. descompensación, recaída, deterioro cognitivo acelerado) con horizonte temporal declarado.
- **RF-MF-05** — Ciclo de mejora: los desenlaces confirmados por el profesional (verdadero/falso positivo) retroalimentan los modelos.
- **RF-MF-06** — Versionado y trazabilidad de modelos (qué versión generó cada alerta).

---

## 7. Botsy Dashboard — ampliaciones

Además de lo documentado en v0.1 (widgets de sintomatología, dolor, adherencia, estado emocional, informes):

- **RF-DB-01** — **Bandeja de alertas** priorizada por riesgo, con evidencia multimodal adjunta (fragmento de conversación, gráfica vocal, captura autorizada) y acciones: contactar, ajustar pauta, descartar con motivo.
- **RF-DB-02** — **Ficha 360º del paciente**: línea temporal unificada de todos los dominios + eventos (escalados, cambios de medicación, videollamadas).
- **RF-DB-03** — Vista de **biomarcadores vocales y visuales** con línea base y desviaciones.
- **RF-DB-04** — **Prescripción de monitorización**: el profesional configura qué módulos, frecuencia, preguntas extra y umbrales aplican a cada paciente.
- **RF-DB-05** — Galería evolutiva de imágenes clínicas autorizadas (heridas, lesiones).
- **RF-DB-06** — Informes descargables por paciente y por cohorte (visible ya como botón "REPORTE" en el deck), con periodicidad programable.
- **RF-DB-07** — Vista poblacional para B2B (aseguradoras): métricas agregadas y anonimizadas de cohortes.
- **RF-DB-08** — Administración: gestión de organizaciones, profesionales, roles, catálogo de fármacos, contenidos educativos y plantillas de guiones conversacionales.

---

## 8. Mapa de módulos (resumen)

```
BOTSY APP (paciente)
├── Check-in conversacional por voz/texto (diario)
│   ├── Extracción clínica estructurada
│   ├── Resumen de avances + rachas
│   └── Protocolo de escalado (médico / urgencias)
├── Video-consulta con IA (opcional / semanal)
│   ├── Mini-pruebas guiadas (protocolo visual)
│   └── Captura dirigida de imágenes clínicas
├── Recomendaciones de estilo de vida y dieta
├── Monitorización del dispositivo (biometría, actividad, sueño, geoposición)
├── Perfil y evolución (cognición, dolor, adherencia, ánimo)
└── Consultas comunes 24/7

BACKEND / IA
├── Pipeline de voz (STT ⇄ LLM ⇄ TTS)
├── Biomarcadores vocales (features + línea base individual)
├── Análisis visual (facial, rPPG, dolor, alarma neurológica)
├── Motor de fusión multimodal + score de riesgo explicable
├── Motor de reglas de escalado y alertas
└── Motor de recomendaciones

BOTSY DASHBOARD (profesional / B2B)
├── Bandeja de alertas priorizadas con evidencia
├── Ficha 360º y línea temporal del paciente
├── Prescripción de monitorización y umbrales
├── Biomarcadores e imágenes clínicas
├── Informes por paciente y cohorte
└── Administración (organizaciones, roles, catálogos, contenidos)
```

---

## 9. Consideraciones regulatorias y éticas (ampliadas — crítico)

La ampliación multimodal **eleva el nivel regulatorio** respecto a v0.1:

1. **RGPD reforzado** — voz e imagen facial son datos biométricos + datos de salud (doble categoría especial, art. 9). Se requiere: consentimiento explícito, granular y revocable por modalidad; EIPD/DPIA obligatoria; minimización (features en lugar de crudo); cifrado extremo a extremo en tránsito y reposo.
2. **AI Act (UE)** — un sistema de IA con fines sanitarios y análisis biométrico/emocional entra con alta probabilidad en **alto riesgo**; el reconocimiento de emociones tiene restricciones específicas (prohibido en ámbito laboral — relevante para la vertical de salud ocupacional, que habría que rediseñar o excluir del análisis emocional). Requisitos: gestión de riesgos, calidad de datos, supervisión humana, transparencia, registro.
3. **MDR (producto sanitario)** — la funcionalidad de detección/predicción de complicaciones y escalado clínico encaja en software como producto sanitario (probable **clase IIa o superior** según la regla 11). Implica: sistema de calidad (ISO 13485), evaluación clínica, marcado CE antes de comercializar esas funciones en la UE. Estrategia recomendada: **arquitectura por capas** que permita lanzar primero las funciones de bienestar/registro (no MDR) y certificar progresivamente las funciones clínicas.
4. **Validación clínica** — los biomarcadores vocales/visuales deben validarse (estudios piloto con profesionales) antes de influir en decisiones; mientras tanto, modo "sombra" (se calculan pero no disparan alertas).
5. **Transparencia con el paciente** — siempre debe saber que habla con una IA, qué se analiza de su voz/imagen y poder desactivarlo sin perder el servicio básico.
6. **Sesgos** — validar los modelos de voz/visión en los acentos, edades y fototipos de los mercados objetivo (España, Brasil, Latinoamérica).
7. **Emergencias** — definir con asesoría legal el alcance de las indicaciones de urgencia y los avisos de responsabilidad.

---

## 10. Roadmap propuesto por fases

| Fase | Alcance | Nivel regulatorio |
|---|---|---|
| **F1 — MVP conversacional** | Check-in por voz/texto, extracción estructurada, resumen de avances, adherencia, perfil, dashboard básico con tendencias e informes | Bienestar/registro |
| **F2 — Inteligencia y escalado** | Motor de reglas de escalado, alertas al profesional, recomendaciones de estilo de vida, prescripción de monitorización | Frontera MDR — iniciar certificación |
| **F3 — Biomarcadores vocales** | Features de voz, línea base individual, modo sombra → validación clínica → activación en el motor de riesgo | MDR + AI Act |
| **F4 — Video-consulta IA** | Videollamada con guion clínico, análisis facial de alarma (FAST), captura de imágenes; después rPPG y señales emocionales validadas | MDR + AI Act |
| **F5 — Fusión y predicción** | Score de riesgo multimodal explicable, predicción de eventos por vertical, vista poblacional B2B | MDR clase superior |

---

## 11. Preguntas abiertas (v0.2)

- ¿El avatar de las videollamadas era un personaje visual o solo voz con cámara del paciente activa?
- ¿Idiomas de lanzamiento para la voz (ES España, ES LatAm, PT-BR)?
- ¿Se contemplaba integración con wearables concretos o solo el teléfono?
- ¿Existía ya relación con profesionales/clínicas para la validación clínica de biomarcadores?
- ¿Presupuesto/estrategia regulatoria: lanzar como bienestar primero (F1) o ir directo a certificación MDR?
- ¿Preferencia de stack para el pipeline de voz (APIs comerciales tipo realtime vs. componentes propios)?

---

*Versión 0.2 — visión ampliada multimodal. Sustituye y extiende la v0.1.*
