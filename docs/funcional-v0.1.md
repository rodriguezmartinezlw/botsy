# Botsy — Documentación Funcional Inicial (v0.1)

**Asistente inteligente sanitario**
Documento de reconstrucción funcional elaborado a partir del pitch deck original. Sirve como punto de partida para reconstruir el sistema (aplicación del paciente y panel de administración/profesional) tras la pérdida del código fuente.

> **NOTA:** este documento es histórico. La versión vigente es [funcional-v0.2.md](funcional-v0.2.md), que lo sustituye y amplía.

---

## 1. Visión general del producto

Botsy es un asistente inteligente sanitario que **monitoriza, gestiona y predice complicaciones en la salud de los pacientes**. El sistema se compone de dos productos conectados:

| Producto | Usuario objetivo | Propósito |
|---|---|---|
| **Botsy App** (móvil) | Pacientes | Recogida diaria de información mediante conversación natural con IA y sensores del dispositivo |
| **Botsy Dashboard** (web) | Profesionales de la salud, aseguradoras, proveedores | Visualización, análisis predictivo, alertas e informes sobre los pacientes |

### 1.1 Flujo principal del sistema

1. **Recopilamos información** — La app conversa diariamente con el paciente ("Hola, ¿cómo te sientes hoy?") y captura datos del dispositivo.
2. **Analizamos y procesamos** — Un motor de IA en la nube procesa la información conversacional y biométrica.
3. **Predecimos y sugerimos** — El sistema predice complicaciones sanitarias y sugiere intervenciones preventivas personalizadas al profesional.

### 1.2 Áreas clínicas de enfoque

- **Salud cardiovascular** — primera causa de muerte mundial; desde accidentes cerebrovasculares hasta enfermedades coronarias.
- **Enfermedades crónicas** — predicción de complicaciones en pacientes renales, evolución de pacientes con enfermedades inmunológicas.
- **Salud ocupacional** — monitorización, gestión y prevención de complicaciones.
- **Salud geriátrica** — monitorización de condiciones comunes en adultos mayores (Alzheimer, demencia).
- **Salud mental** — vigilancia y gestión de trastornos.

---

## 2. Botsy App (aplicación del paciente)

### 2.1 Monitorización conversacional

Módulo central de la app: un agente conversacional de IA que, mediante diálogo natural diario con el paciente, extrae y estructura información sobre:

1. **Adherencia farmacológica** — registro y seguimiento de la toma de medicación (p. ej., Ácido Acetilsalicílico, Warfarina), con estados positivo/negativo por fármaco y por día.
2. **Respuestas a terapias y tratamientos** — evolución percibida del tratamiento.
3. **Atención y resolución de consultas comunes** — el asistente responde dudas frecuentes del paciente de forma automatizada.
4. **Síntomas físicos** — dolor, infecciones, alergias (etiquetado por categorías).
5. **Estado mental y emocional** — ansiedad, estrés, dolor emocional.
6. **Cognición y estado neurológico** — memoria, concentración, desorientación (con métricas porcentuales de variación, p. ej. −19% memoria, 25% concentración, 17% desorientación).
7. **Estilo de vida y hábitos**.
8. **Reacciones y entorno** — reacciones adversas y factores contextuales.

Implicaciones funcionales para la reconstrucción:

- Motor de conversación (LLM) con extracción estructurada de datos clínicos a partir de texto/voz libre.
- Taxonomía de síntomas y categorías (físicos, mentales, cognitivos) con etiquetas configurables.
- Registro diario con recordatorios/notificaciones para iniciar la conversación.
- Histórico conversacional asociado al perfil del paciente.

### 2.2 Monitorización del dispositivo

Captura pasiva de datos desde el smartphone y/o wearables:

- **Datos biométricos**.
- **Actividad física**.
- **Monitorización del sueño**.
- **Geoposición** (relevante p. ej. para pacientes con demencia/desorientación).

Implicaciones: integración con APIs de salud del sistema operativo (HealthKit / Health Connect), permisos de localización y política clara de consentimiento.

### 2.3 Perfil del paciente (pantallas visibles en el deck)

- Cabecera con foto, nombre e indicador de estado (online/activo).
- **Cognición y estado neurológico** — mini-gráfico de evolución.
- **Sintomatología cognitiva** — tarjetas mensuales con variación porcentual de memoria, concentración y desorientación.
- **Niveles de dolor** — gráfico semanal (lunes–domingo) con marcadores de picos (55%, 75%) y tendencia (p. ej. ↑57% mensual).
- **Adherencia farmacológica** — vista semanal por medicamento con series positivo/negativo, y gráfico de evolución a 8 meses.
- **Síntomas físicos** — chips: Dolor, Infecciones, Alergias.
- **Estado mental** — chips: Ansiedad, Estrés, Dolor.
- Vista de **Cognición** con selector Día/Semana/Mes y gráfico de área con escala numérica (20–160), navegación por fecha.

---

## 3. Botsy Dashboard (panel para profesionales)

Dashboard web inteligente para profesionales de la salud que **predice complicaciones sanitarias y sugiere intervenciones preventivas de manera eficiente y personalizada**.

### 3.1 Funcionalidades

1. **Análisis predictivo** — modelos que anticipan complicaciones por paciente.
2. **Análisis de tendencias y patrones de salud** — evolución temporal por dominios (dolor, cognición, adherencia, estado emocional).
3. **Alertas y notificaciones personalizadas** — avisos tempranos configurables por umbrales o predicción de riesgo.
4. **Gestión del bienestar mental** — seguimiento específico de ansiedad y estrés.
5. **Informes de salud detallados** — generación de reportes (botón "REPORTE" visible en la vista de niveles de dolor).

### 3.2 Widgets visibles en el deck

- **Sintomatología cognitiva** — burbujas comparativas (Memoria 19%, Concentración 25%, Desorientación 17%).
- **Niveles de dolor** — gráfico de barras mensual (Jun 2024) con comparativa dual (valor actual vs. referencia), indicador de tendencia (↑57%) y acceso a reporte.
- **Adherencia farmacológica** — barras semanales (lunes–domingo) con doble serie.
- **Estado mental y emocional** — barras horizontales comparativas Ansiedad vs. Estrés por período.

### 3.3 Funcionalidad implícita a reconstruir

- Listado y búsqueda de pacientes, con ficha individual (equivalente al perfil de la app).
- Gestión de medicación por paciente (alta de fármacos, pautas).
- Configuración de alertas por paciente o cohorte.
- Roles y permisos (profesional, administrador, posiblemente aseguradora).

---

## 4. Propuesta de valor por segmento

### 4.1 Aseguradoras y proveedores de salud

1. Reducción de costos en el cuidado de la salud.
2. Reducción de cargas administrativas.
3. Mejora de la eficiencia operativa.
4. Análisis de mercado y predicción del mercado futuro.
5. Contribución al desarrollo de nuevos negocios.

### 4.2 Profesionales de la salud y pacientes

1. Prevención de complicaciones mediante monitoreo y predicción.
2. Atención personalizada basada en análisis de datos.
3. Mejora en la toma de decisiones basada en datos.
4. Alertas tempranas y recomendaciones basadas en el análisis de datos.
5. Automatización de respuestas para consultas comunes.
6. Reducción de tiempos de espera.
7. Soporte continuo 24/7.
8. Reducción de la carga de trabajo administrativo.
9. Gestión de pacientes más eficiente.
10. Personalización de la atención.

---

## 5. Contexto de negocio (según el deck)

- **Modelo de negocio:** B2C / B2B, suscripción mensual de **$29/mes**. Hipótesis: 10.000 usuarios → $3.480.000 de ingresos anuales potenciales.
- **Mercado potencial (basado en población):** ~$853M de personas. Brasil (66% — crónicas, salud mental, pre/postnatal), Latinoamérica (40% — cardiovascular, mental, pre/postnatal), Europa (48% — crónicas, geriátrica, cardiovascular, mental).
- **Equipo:** Luis Rodríguez, CEO/CTO — +20 años en tecnologías sanitarias, fundador de FeelsGood.

---

## 6. Requisitos transversales a definir en la reconstrucción

Estos puntos no aparecen en el deck pero son imprescindibles antes de desarrollar:

1. **Cumplimiento normativo** — el sistema trata datos de salud (categoría especial, art. 9 RGPD). Hará falta base jurídica, consentimiento explícito, EIPD/DPIA, y evaluar si la funcionalidad predictiva encaja en la definición de producto sanitario (MDR, clase según reglas de software).
2. **Arquitectura** — app móvil (¿iOS/Android nativo o multiplataforma?), backend/API, motor de IA (¿LLM externo vía API o modelo propio?), base de datos clínica, dashboard web.
3. **Autenticación y roles** — paciente, profesional, administrador, cliente B2B (aseguradora).
4. **Idiomas** — la interfaz del deck mezcla español e inglés ("Profile", "Day/Week/Month"); definir estrategia de internacionalización (mercados objetivo: Brasil → portugués).
5. **Integraciones** — HealthKit / Health Connect, wearables, posible interoperabilidad con historia clínica (HL7 FHIR).
6. **Modelos predictivos** — definir qué predicciones concretas se realizan por vertical clínica, datos de entrenamiento, métricas y validación clínica.
7. **Notificaciones** — push para pacientes (recordatorio de conversación/medicación) y alertas para profesionales.
8. **Facturación** — pasarela de pago para suscripción B2C y contratación B2B.

---

## 7. Preguntas abiertas

- ¿La conversación con el paciente era por texto, voz o ambas?
- ¿Qué stack tecnológico usaba la versión original (para decidir si replicar o modernizar)?
- ¿Existían ya modelos predictivos entrenados o eran reglas/heurísticas?
- ¿El dashboard soportaba multi-organización (varias clínicas/aseguradoras)?
- ¿Se conserva algún backup de la base de datos, diseños en Figma o documentación técnica parcial?

---

*Versión 0.1 — reconstrucción a partir del pitch deck. Pendiente de validación por el equipo.*
