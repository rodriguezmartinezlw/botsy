# Botsy — Guion de la demo vendible (10 minutos)

**Objetivo:** en local, compartiendo pantalla, contar la historia completa de Botsy con una paciente oncológica real del seed: **check-in por voz → escalado → bandeja del profesional con disposición → ficha 360º → dashboard del patrocinador → informe ROI**. Es la "definición de hecho" de fin de sprint 2 (PLAN §8, Memoria §13).

> **Regla de oro que se demuestra sola:** el paciente habla; el profesional decide; la IA nunca diagnostica; el patrocinador solo ve agregados con k-anonimato ≥ 5.

---

## 0. Preparación (antes de la reunión)

**Dos modos según lo que tengas a mano:**

- **Modo completo (con Supabase local + seed):** ejecuta las migraciones `0001..0010` y `supabase/seed.sql`, luego `supabase/seed_wp06_segundo_profesional.sql`. Permite hacer los pasos 1–4 (app del paciente y panel profesional REALES) además del 5–6.
- **Modo demo del patrocinador (sin claves):** `DEMO_MODE=true npm run dev`. El área `/patrocinador` (pasos 5–6) funciona **sin base de datos ni claves**, sobre la cohorte sintética, con marca de agua "DEMO — datos sintéticos". Es el mínimo imprescindible para la reunión con farma.

**Usuarios demo (contraseña común `Botsy1234!`):**

| Rol | Email | Uso en la demo |
|---|---|---|
| Paciente (protagonista) | `maria@botsy.local` | Pasos 1–2 (check-in con fiebre) |
| Profesional (oncóloga) | `dra.garcia@botsy.local` | Pasos 3–4 (bandeja, disposición, ficha) |
| Patrocinador (farma) | `patrocinador@botsy.local` | Pasos 5–6 (dashboard + ROI) |
| Admin | `admin@botsy.local` | — |

La cohorte: **10 pacientes de cáncer de mama**, 6 en «Terapia oral» y 4 en «Tratamiento activo», 45 días de historial, 2 discontinuaciones codificadas, alertas en todos los estados.

---

## 1. Check-in por voz de la paciente (2 min)

**Login como `maria@botsy.local` → app del paciente → "Hacer check-in por voz".**

- María inicia el check-in hablado. Botsy la saluda con calma ("Hola María, ¿cómo te encuentras hoy? ¿Te has tomado la temperatura?").
- María responde que se nota destemplada y que tiene **38,2 ºC**.
- Botsy lo recoge con tono empático y **sin dramatizar**: le dice que va a avisar a su equipo y le da instrucciones claras (reposo, líquidos). **No diagnostica.**

**Frase para el cliente:** *"El problema ocurre a diario; el call center del PSP llama una vez al mes. Aquí la paciente habla dos minutos y el dato queda estructurado."*

> En el seed, el check-in de María de HOY ya trae la observación de fiebre 38,2 ºC y la conversación de ejemplo; si no puedes hacer voz en vivo, enséñalo desde la ficha (paso 4).

## 2. Escalado empático (30 s)

- El programa «Terapia oral» tiene la regla `fiebre ≥ 38 → contactar` (`[PENDIENTE CLÍNICO]`). La señal genera una **alerta determinista** de nivel *contactar* — no hay scoring de IA.
- La app muestra a María una pantalla de **escalado empático**: "Vamos a avisar a tu equipo", sin alarmismo.

**Frase:** *"El escalado es por reglas que configura el equipo clínico, no una predicción de la IA. Eso nos mantiene fuera de la zona regulatoria de predicción en v1."*

## 3. Bandeja del profesional + disposición estructurada (2,5 min)

**Login como `dra.garcia@botsy.local` → Panel → Alertas.**

- Aparece la alerta de María (*Fiebre en terapia oral*, contactar, **nueva**) con su **evidencia** (el fragmento del check-in).
- La Dra. García la resuelve: el sistema **exige una disposición estructurada** — decisión (p. ej. *Contactado el paciente*) + **motivo codificado del catálogo** + días de seguimiento. **No se puede cerrar sin disposición** (regla de oro 3).
- Enseña la vista **Desenlaces** (badge de pendientes): el desenlace se registra en 2 clics cuando vence el seguimiento.

**Frase:** *"Cada alerta deja una decisión clínica estructurada: decisión + motivo + desenlace. Esa es la semilla del activo de datos y la base del ROI que os enseño luego."*

## 4. Ficha 360º de la paciente (1,5 min)

**Panel → Pacientes → María.**

- **Tendencias**: adherencia a la toma, síntomas de ciclo, ánimo/ansiedad/estrés (distrés).
- **Medicación**: la pauta oral, con opción de discontinuar (pidiendo motivo codificado).
- **Pestaña Programa**: «Mama · Terapia oral» con su config efectiva en lenguaje humano.
- **Línea temporal**: check-ins, alertas y disposiciones fechadas.

**Frase:** *"El equipo clínico ve al paciente entre visitas. 60 minutos/día ahorrados por clínico es el número que compró Varian cuando adquirió Noona."*

## 5. Dashboard del patrocinador — MODO DEMO (2 min)

**Login como `patrocinador@botsy.local`** (o simplemente abre `/patrocinador` con `DEMO_MODE=true`, sin claves).

- Marca de agua **"DEMO — datos sintéticos"**. El patrocinador (Laboratorio Demo) ve **solo agregados pseudonimizados** de las cohortes que financia:
  - **Persistencia** (curva simple sobre discontinuaciones), **meses en tratamiento** (mediana), **adherencia media mensual**, **motivos de discontinuación codificados**, **tasa de check-in** (contra el benchmark Noona 90 %), **alertas por nivel**, **tiempo hasta disposición**.
- **El momento clave de privacidad:** baja a "Por programa financiado". «Terapia oral» (6 pacientes) muestra sus gráficas. **«Tratamiento activo» (4 pacientes) aparece como "Datos insuficientes"** — el patrocinador *literalmente no puede* ver un corte con menos de 5 pacientes (k-anonimato ≥ 5). No es una opción de configuración: es la arquitectura.

**Frase:** *"Farma nunca ve un paciente. Ni un nombre, ni un corte tan pequeño que pudiera reidentificar a alguien. Esto está en la base de datos, no en la UI: el rol patrocinador no tiene permiso de lectura sobre ninguna tabla clínica."*

## 6. Informe ROI del pagador (1,5 min)

**Dashboard del patrocinador → "Ver informe ROI del pagador"** (`/patrocinador/roi`).

- **Urgencias evitadas / 100 pacientes-mes** — con su **definición honesta** al pie: es un *proxy* (alertas contactar/urgencia resueltas sin evento), no una medición de urgencias realmente evitadas. Se dice así, en el propio informe.
- **Tiempo de escalado** (señal→alerta→disposición), **tasa de respuesta al check-in**, **persistencia**.
- Al pie, las **definiciones metodológicas** y la nota: *"v1 reporta lo observado: sin ML, sin proyecciones."* Botón **Imprimir / PDF** para llevárselo a la reunión.

**Frase de cierre:** *"Para el pagador capitado, cada hospitalización evitada es ahorro directo. Capturamos la línea base desde el paciente 1, con cifras que solo salen de datos reales — nada inventado. Esto es lo que convierte el piloto en contrato anual."*

---

## Qué demuestra la demo (checklist para ti)

- [x] **(a)** Una RPC de agregado **omite un corte con < 5 pacientes** → «Tratamiento activo» = "Datos insuficientes".
- [x] **(b)** El **patrocinador no puede leer ninguna tabla de pacientes** → solo agregados; garantía en RLS + RPC, no en la UI.
- [x] **(c)** El **informe ROI solo usa cifras reales** → validador anti-cifras-inventadas; proxy honesto documentado.
- [x] Check-in por **voz** (la hipótesis diferencial), escalado **determinista** y empático, **disposición estructurada obligatoria**, ficha 360º, y las dos pantallas de venta (dashboard + ROI) **funcionando en local**.

## Notas honestas (por si preguntan)

- La voz conversacional en PSP oncológico **no está validada aún** por nadie: es nuestra hipótesis diferencial y el piloto existe para medirla contra el 90 % de Noona.
- Los **umbrales clínicos** (fiebre, distrés, etc.) van marcados `[PENDIENTE CLÍNICO]` hasta la validación del psicooncólogo; los **textos legales**, `[PENDIENTE LEGAL]`.
- El seed es **sintético**: personas y cifras inventadas para la demo, no pacientes reales.
