# WP-05 — Perfil evolutivo del paciente (gráficos)

**Depende de:** WP-01 (datos); ejecutar tras WP-02 para tener datos reales · **Funcional:** v0.1 §2.3, v0.2 §2.2 punto 6

## Objetivo

La pantalla `(paciente)/perfil` con la evolución visual del paciente, replicando los conceptos del deck: dolor, ánimo/ansiedad/estrés, adherencia, cognición, rachas. Móvil-first, legible por personas mayores.

## Diseño

- **Cabecera:** avatar/iniciales, nombre, racha actual con icono de llama, "check-ins este mes: N".
- **Selector de período** global: Semana / Mes / 3 meses (día a día dentro; RF del deck "Day/Week/Month").
- **Tarjetas** (Recharts, cada una con estado vacío amable si no hay datos):
  1. **Dolor** — gráfico de área/línea de `observaciones dominio='dolor'` (media diaria de `valor_num`), con marcadores de picos y delta vs. período anterior (↑/↓ %).
  2. **Ánimo y estrés** — líneas comparadas de `animo`, `ansiedad`, `estres` (0–10).
  3. **Adherencia** — por fármaco activo: fila semanal L–D con puntos verde (tomada) / rojo (omitida) / gris (desconocido) a partir de `tomas_medicacion`, + % de adherencia del período; debajo, gráfico de barras de evolución mensual.
  4. **Sueño** — barras de `sueno` si hay datos.
  5. **Cognición** — gráfico de área con selector de fecha (concepto del deck); si no hay observaciones de `cognicion`, tarjeta con "Aún estamos conociéndote" (los datos llegan de las preguntas ligeras del check-in).
  6. **Síntomas recientes** — chips de los `codigo` de `sintoma_fisico` de los últimos 30 días con recuento.
- **Datos:** Server Component que agrega en SQL/JS desde Supabase (servidor) y pasa series ya calculadas a componentes cliente de gráfico (`src/components/graficos/`). Nada de fetch de datos desde el cliente.
- Utilidades de agregación en `src/lib/agregados.ts` con tests ligeros (medias diarias, deltas de período, % adherencia).
- Paleta y estilo: variables del tema; ejes y tooltips en español (date-fns locale es); fuentes de ejes ≥12px, títulos ≥18px.

## Fuera de alcance

Dashboard del profesional (WP-06 reutilizará estos componentes de gráfico — expórtalos pensando en eso: reciben series, no saben de Supabase). Biomarcadores.

## Criterios de aceptación

- Build + lint + tests verdes.
- Con el seed de WP-01: capturas o descripción verificable de las 6 tarjetas renderizadas con datos de Luis; el % de adherencia coincide con un cálculo manual sobre el seed (muéstralo en la entrega).
- Estados vacíos correctos con un paciente sin datos (Carmen).
- Ningún componente de gráfico importa Supabase.
