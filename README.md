# Botsy — Asistente inteligente sanitario

Reconstrucción del sistema Botsy (app del paciente + dashboard profesional) a partir del pitch deck original, tras la pérdida del código fuente.

## Qué es

Botsy monitoriza, gestiona y predice complicaciones en la salud de los pacientes mediante:

- **Check-in conversacional diario** por voz natural (OpenAI Realtime) o texto, que convierte la conversación en datos clínicos estructurados.
- **Protocolo de escalado** (normal → vigilancia → contactar médico → urgencia) con lenguaje no alarmista.
- **Dashboard profesional** con bandeja de alertas, ficha 360º, gestión de medicación e informes.

**Regla de oro:** Botsy nunca diagnostica ante el paciente; detecta señales, las comunica sin alarmar y deriva al profesional.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/funcional-v0.2.md](docs/funcional-v0.2.md) | Especificación funcional completa (visión multimodal) |
| [docs/funcional-v0.1.md](docs/funcional-v0.1.md) | Versión inicial (histórico, superada por v0.2) |
| [docs/PLAN-MAESTRO.md](docs/PLAN-MAESTRO.md) | Arquitectura, stack, fases y paquetes de trabajo |
| [docs/adr/ADR-001-api-de-voz.md](docs/adr/ADR-001-api-de-voz.md) | Decisión: qué API de voz usar y por qué |
| [docs/wp/](docs/wp/) | Paquetes de trabajo (indicaciones pre-escritas para el agente implementador) |
| [CLAUDE.md](CLAUDE.md) | Convenciones obligatorias para cualquier agente que toque el código |

## Modelo de trabajo

Este proyecto se construye con un flujo **director / implementador**:

1. El director (Fable) escribe y mantiene los paquetes de trabajo en `docs/wp/`.
2. Un agente implementador (Opus) lee su WP + `CLAUDE.md` + el plan, codifica y deja su entrega en `docs/wp/entregas/`.
3. El director revisa el diff contra los criterios de aceptación, pide correcciones si hace falta y hace commit al aprobar.

## Stack (F1)

Next.js 16 (App Router, TypeScript estricto, Tailwind) · Supabase (Postgres + Auth + Storage, RLS) · OpenAI (Realtime API para voz, modelo de texto para extracción) · Recharts · Vercel.

## Estado

Fase F1 (MVP conversacional) en construcción. Ver progreso en `docs/PLAN-MAESTRO.md` §7.
