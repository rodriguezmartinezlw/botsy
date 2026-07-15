# WP-06 — Dashboard profesional

**Depende de:** WP-04 (y reutiliza gráficos de WP-05) · **Funcional:** v0.1 §3, v0.2 §7 (RF-DB-01/02/04 en versión F1)

## Objetivo

El panel `(panel)` completo para el profesional: lista de pacientes con semáforo de riesgo, ficha 360º, bandeja de alertas gestionable, gestión de medicación y configuración de reglas/umbrales por paciente.

## Pantallas

### `(panel)/pacientes`
- Tabla/lista con búsqueda por nombre: avatar, nombre, edad, vertical, adherencia 7 días (%), último check-in (hace N días, con aviso si >2), semáforo = nivel de la alerta abierta más grave (verde si ninguna).
- Orden por defecto: mayor riesgo primero, luego más días sin check-in.

### `(panel)/pacientes/[id]` — ficha 360º (RF-DB-02, versión F1)
- Cabecera: datos del paciente, condiciones, racha, botones "Ver informe" (WP-07) y teléfono.
- **Línea temporal unificada** (columna central): mezcla cronológica de checkins (con resumen expandible → transcript completo), alertas (con evidencia), cambios de medicación y consentimientos. Paginada.
- **Columna de tendencias**: reutiliza los componentes de gráfico de WP-05 (dolor, ánimo, adherencia) en tamaño compacto.
- **Pestaña Medicación**: pautas activas/históricas; alta/edición/desactivación de pautas (fármaco, dosis, momentos, crítica) — escribe `pautas_medicacion` + `eventos_auditoria`.
- **Pestaña Reglas**: reglas globales aplicables (solo lectura) + reglas propias del paciente: crear/activar/desactivar a partir de plantillas amigables ("Avisarme si el dolor supera X", "…si omite [fármaco] N días", "…si el ánimo baja de X durante N días") que generan el JSONB de condición de WP-04. Nada de editor JSON crudo.

### `(panel)/alertas` — bandeja (RF-DB-01, versión F1)
- Lista priorizada: urgencia > contactar > vigilancia, luego por fecha. Filtros: estado, nivel, paciente.
- Cada alerta expandible: motivo, evidencia (observaciones + fragmento de conversación), enlace a la ficha.
- Acciones: **marcar vista**, **resolver** (nota opcional), **descartar** (motivo OBLIGATORIO — alimenta el ciclo de mejora RF-MF-05 futuro). Toda acción → `eventos_auditoria`.
- Badge con nº de alertas nuevas en el sidebar del panel (y en el título de la página).

### `(panel)/configuracion`
- Datos del profesional; F1 mínimo: nombre, teléfono de contacto que ven sus pacientes.

## Reglas

- Todo acceso a datos con el cliente de servidor (RLS de profesional hace el trabajo; NO uses el cliente admin para leer datos de pacientes — si una consulta "necesita" service role, es que falta una política en WP-01: anótalo en la entrega en vez de saltarte la RLS).
- Route guard del layout `(panel)`: solo roles `profesional` y `admin`.
- Mutaciones vía Server Actions o Route Handlers con validación Zod y comprobación de sesión interna.

## Fuera de alcance

Informes (WP-07). Vista poblacional B2B, multi-organización, catálogo de fármacos central, plantillas de guiones (F2+/RF-DB-08).

## Criterios de aceptación

- Build + lint + tests verdes.
- Flujo E2E con el seed: la Dra. García entra → ve a Luis con semáforo por la alerta abierta → abre la alerta, la resuelve con nota → crea una regla "dolor > 7" para Luis → da de alta una pauta nueva → todo queda en `eventos_auditoria` (lista las filas en la entrega).
- Un paciente logueado que fuerce URLs `/pacientes/*` recibe redirección; un profesional no ve pacientes de otro profesional (demuéstralo con el segundo paciente del seed sin asignar o creando un profesional extra en seed si hace falta — puedes añadir migración/seed nuevo, documentado).
