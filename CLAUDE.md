# CLAUDE.md — Convenciones obligatorias del proyecto Botsy

Este archivo es vinculante para cualquier agente que escriba código en este repositorio. Léelo entero antes de tocar nada.

## Contexto mínimo

Botsy es un asistente sanitario: app del paciente (check-in diario por voz/texto) + dashboard profesional. La especificación vive en `docs/funcional-v0.2.md`; la arquitectura y el orden de trabajo en `docs/PLAN-MAESTRO.md`; tu tarea concreta en `docs/wp/WP-XX-*.md`.

## Flujo de trabajo del implementador

1. Lee: `CLAUDE.md` (este archivo) → `docs/PLAN-MAESTRO.md` → tu `docs/wp/WP-XX-*.md` → las secciones de `docs/funcional-v0.2.md` que tu WP referencie.
2. Implementa SOLO el alcance de tu WP. Lo marcado como "fuera de alcance" no se toca aunque parezca fácil.
3. Verifica: `npm run build` y `npm run lint` deben terminar sin errores, más los criterios de aceptación de tu WP.
4. Escribe tu entrega en `docs/wp/entregas/WP-XX-entrega.md`: qué hiciste, archivos creados/modificados, decisiones tomadas que no estaban en el WP, dudas o riesgos detectados, y el resultado literal de build y lint.
5. **NO hagas commit ni push.** Los commits los hace el director tras revisar.
6. No modifiques `docs/` salvo tu archivo de entrega. Si crees que un WP o el plan tienen un error, anótalo en tu entrega; no lo "arregles" tú.

## Reglas clínicas (innegociables)

- Botsy **nunca diagnostica** ante el paciente. Detecta señales, informa con lenguaje empático no alarmista y deriva al profesional.
- Toda pantalla o mensaje con contenido de salud dirigido al paciente incluye tono calmado; las urgencias dan instrucciones claras sin dramatizar.
- Ninguna recomendación al paciente puede contradecir la pauta del profesional.
- Los textos visibles siempre distinguen "señal detectada" de "diagnóstico".

## Reglas técnicas

- **Idioma:** UI y textos en español (es-ES). Identificadores de base de datos en español y snake_case (`pacientes`, `tomas_medicacion`). Código (variables, funciones, componentes) en español o inglés, pero consistente dentro de cada archivo; nombres de componentes en PascalCase.
- **TypeScript estricto.** Prohibido `any` (usa `unknown` + narrowing). Zod para validar toda entrada externa (body de API routes, respuestas de LLM).
- **Next.js App Router:** Server Components por defecto; `"use client"` solo donde haya interactividad real. Route Handlers para API. Recuerda: en Next 16 el middleware/proxy NO intercepta `/api/*` — la autorización de cada Route Handler se comprueba DENTRO del handler vía sesión de Supabase.
- **Supabase:**
  - RLS habilitada en TODAS las tablas, sin excepción. Ninguna tabla se crea sin sus políticas en la misma migración.
  - Cliente browser (`src/lib/supabase/client.ts`), cliente servidor con cookies (`src/lib/supabase/server.ts`), cliente service-role (`src/lib/supabase/admin.ts`) que SOLO se importa desde código de servidor.
  - Migraciones SQL numeradas en `supabase/migrations/NNNN_descripcion.sql`. Nunca edites una migración ya entregada; crea una nueva.
- **Secretos:** jamás en el código ni en archivos commiteados. Todo por variables de entorno; mantén `.env.example` actualizado con cada variable nueva (sin valores reales).
- **LLM:** las llamadas a OpenAI van en `src/lib/ia/`. Modelos configurables por env (`OPENAI_TEXT_MODEL`, `OPENAI_REALTIME_MODEL`), nunca hardcodeados en más de un sitio. Toda salida estructurada del LLM se valida con Zod antes de persistir; si no valida, se registra y se descarta, nunca se inserta a ciegas.
- **Gráficos:** Recharts. Fechas con `date-fns` y locale `es`.
- **Accesibilidad:** fuentes ≥16px en la app del paciente, contraste AA, botones grandes (perfil geriátrico).
- **Errores:** ninguna promesa sin manejo; los Route Handlers devuelven JSON `{ error: string }` con status apropiado; nunca filtres mensajes internos o stack traces al cliente.

## Verificación antes de entregar

```bash
npm run build   # debe terminar sin errores
npm run lint    # debe terminar sin errores
```

Si tu WP tiene criterios de aceptación adicionales (los tiene), demuéstralos en tu entrega (comandos ejecutados y su salida, o pasos manuales seguidos).
