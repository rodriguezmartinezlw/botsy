# WP-09 — Puesta en producción y E2E reales

**Depende de:** F1 completo (WP-00..08) · **Bloqueado por insumos del usuario** (abajo) · Puede ejecutarse en paralelo a WP-10..14.

## Prerequisitos que aporta el USUARIO (no empezar sin ellos)

1. Proyecto **Supabase** creado (anotar ref y región UE) y credenciales: URL, anon key, service-role key. *(El repo GitHub ya está en la cuenta personal `rodriguezmartinezlw`; confirmar si Supabase/Vercel van también en personal.)*
2. `OPENAI_API_KEY` con acceso a un modelo de texto económico y a **Realtime** (`gpt-realtime-2.1-mini` o vigente).
3. Cuenta **Resend** + dominio verificado (para `RESEND_FROM`) y `RESEND_API_KEY`.
4. Proyecto **Vercel** (el cron horario de recordatorios requiere plan **Pro**; si es Hobby, degradar el cron a 1/día y documentarlo).
5. Un `CRON_SECRET` generado (aleatorio largo).

## Tareas del implementador

1. **Base de datos.** Aplicar en orden `supabase/migrations/0001..0004` sobre el proyecto vacío (CLI `supabase link` + `db push`, o Management API). Aplicar `supabase/seed.sql`; **validar el bloque `auth.users`/`auth.identities`** (pendiente vivo desde WP-01): si el esquema de GoTrue lo rechaza, crear los 4+2 usuarios demo vía Auth Admin API y ejecutar el resto del seed (el propio seed documenta la alternativa). Aplicar `supabase/seed_wp06_segundo_profesional.sql`. Verificar bucket `audios-checkin` y sus políticas de Storage.
2. **Verificación RLS en vivo.** Ejecutar `supabase/tests/acceso_cruzado.sql` (6 escenarios por JWT) y adjuntar el resultado en la entrega. Cualquier fallo = corregir con migración nueva, jamás editando las commiteadas.
3. **Entorno.** `.env.local` completo (12 variables de `.env.example`); ajustar `OPENAI_TEXT_MODEL` y `OPENAI_REALTIME_MODEL` a los vigentes. `npm run build && npm test` con env reales.
4. **E2E reales** — ejecutar los guiones documentados en las entregas, en este orden, y corregir lo que falle:
   - WP-02 §5.2: check-in por TEXTO completo (login Luis → conversación → extracción en BD → racha).
   - WP-04: escenario dolor torácico + disnea → `riesgo='urgencia'`, alerta inmediata con evidencia, pantalla de urgencia, evento de auditoría.
   - WP-03: check-in por VOZ en navegador real con micrófono (token efímero, subtítulos, tool-calls persistidas, grabación SOLO con consentimiento, colgar → cierre). Los nombres de eventos de la API Realtime son volátiles (riesgo anotado en WP-03): ajustar `openai-realtime.ts` si el protocolo cambió.
   - WP-06: flujo Dra. García (semáforo → alerta → resolver → regla → pauta → auditoría) + aislamiento con Dr. Ruiz.
   - WP-07: informe imprimible de Luis (verificar que el resumen LLM pasa el validador de cifras con datos reales), cron con `CRON_SECRET` (200 + email real) y sin él (401), bloqueo por consentimiento.
5. **Deploy Vercel.** Variables de entorno (todas las de `.env.example` menos las `NEXT_PUBLIC_` duplicadas donde aplique), `vercel.json` (cron), dominio. Smoke test en producción: landing, login, check-in texto, panel.
6. **Coste real de voz.** Medir el coste de 3 sesiones de voz reales (tokens de audio in/out del dashboard de OpenAI) y compararlo con la previsión de ADR-001 ($0.02–0.05/min). Si se sale, anotar y proponer ajustes (duración, caching, modelo).
7. **Primer admin real** creado y documentado; rotar/retirar los usuarios demo si el proyecto va a recibir datos reales.

## Fuera de alcance

Textos legales (los aporta el usuario), features nuevas, cambiar arquitectura de voz (eso sería revisar ADR-001 con datos del punto 6).

## Criterios de aceptación

- Migraciones + seeds aplicados sin errores; `acceso_cruzado.sql` en verde (adjunto).
- Los 5 bloques E2E ejecutados con evidencia (capturas o filas de BD citadas) y cualquier corrección explicada.
- App desplegada en Vercel con smoke test verde; cron auditado en `eventos_auditoria`.
- Coste/min de voz medido y comparado con ADR-001.
- `docs/DESPLIEGUE.md` corregido con cualquier desviación encontrada al seguirlo.
