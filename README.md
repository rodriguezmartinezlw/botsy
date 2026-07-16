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

## Desarrollo local

Requisitos: Node.js 20+ y `npm`. Para probar los flujos completos, un proyecto
Supabase y claves de OpenAI/Resend (la app **compila y arranca sin ellas**; las
peticiones que las necesiten fallan de forma controlada con un mensaje claro).

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno: copia la plantilla y rellena los valores reales
cp .env.example .env.local        # y edita .env.local (nunca lo subas al repo)

# 3. Arrancar en desarrollo (http://localhost:3000)
npm run dev
```

Comandos:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción (comprueba también TypeScript) |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint (config de Next) |
| `npm test` | Tests unitarios/lógicos con Vitest |

**Base de datos local (opcional).** Con la [Supabase CLI](https://supabase.com/docs/guides/cli):
`supabase start` levanta el stack local y `supabase db reset` aplica las
migraciones de `supabase/migrations/` + el seed de demo (`supabase/seed.sql`,
usuarios con contraseña `Botsy1234!`). El segundo profesional se añade con
`psql "$DATABASE_URL" -f supabase/seed_wp06_segundo_profesional.sql`. Para
verificar el aislamiento por RLS: `psql "$DATABASE_URL" -f supabase/tests/acceso_cruzado.sql`.

Todas las variables de entorno usadas están documentadas en `.env.example`. El
despliegue a producción (Supabase + Vercel) está en **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**.

## Estado

**F1 (plataforma conversacional) completa** — 113 tests en verde, RLS auditada, guía de despliegue en `docs/DESPLIEGUE.md`. **El producto pivotó a oncología** (julio 2026): cáncer de mama (programas «Terapia oral» y «Tratamiento activo») + oncología pediátrica vía cuidador-proxy, con pagador farma (PSP) y capitados — ver **[docs/MEMORIA-PROYECTO.md](docs/MEMORIA-PROYECTO.md)** (autoridad de producto) y **[docs/PLAN-TECNICO-PILOTO.md](docs/PLAN-TECNICO-PILOTO.md)** (hoja de ruta técnica). Para continuar el trabajo: **[docs/PENDIENTE.md](docs/PENDIENTE.md)**.
