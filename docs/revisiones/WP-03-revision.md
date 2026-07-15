# Revisión WP-03 — Check-in por voz (OpenAI Realtime / WebRTC)

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` → **32/32 verde** (25 previos intactos + 7 nuevos de voz).
- `npm run lint` → exit 0. `npm run build` (limpio, `rm -rf .next` antes) → verde.
- `grep any` en `src/lib/voz`, `src/app/api/voz`, `realtime.ts`, `voz-tool.ts` → sin coincidencias.

## Seguridad — verificada a mano (lo más crítico de este WP)

1. **La clave de OpenAI NO se filtra al cliente.** Build limpio y `grep` del bundle real: `OPENAI_API_KEY`, `SERVICE_ROLE`, `service_role` → **0** ocurrencias en `.next/static`; ninguna clave `sk-...` real (el único acierto de mi grep laxo fue `mask-type`, CSS). En `.next/server` sí aparece (correcto). **El secreto no llega al navegador.**
2. **Token efímero.** Al cliente solo llega el `client_secret` de corta vida (emitido server-side en `realtime.ts`), conforme al ADR-001. Correcto.
3. **La UI depende solo de la interfaz.** `grep` de `openai-realtime` en `src/app/` → 0; la UI importa únicamente `src/lib/voz/index.ts` (fábrica `crearSesionVoz`). Portabilidad de proveedor preservada (ADR-001).
4. **Mi corrección de escalado de WP-04 sigue intacta** en `/api/checkin/mensaje`, y la reutiliza `/api/voz/tool` (escalado inmediato también por voz).

## Refactor que hizo el agente — revisado

Para reutilizar sin duplicar, el agente (a) exportó `ejecutarHerramienta` de `loop.ts` (aditivo) y (b) extrajo el cierre a `src/lib/ia/finalizar.ts`, con `/api/checkin/finalizar` delegando en él con respuesta idéntica. Los 25 tests previos siguen verdes → el refactor no cambió el comportamiento de WP-02/WP-04. Aprobado.

## Decisiones y riesgos del agente — decisión

- **Consentimiento:** `conversacion` bloquea la sesión; sin `voz_grabacion` NO se instancia `MediaRecorder` (correcto, RF-VZ-05/§consentimiento). Subida de audio best-effort que no bloquea el cierre. Ruta validada con prefijo `{userId}/`.
- **Volatilidad de la API Realtime (nombres de eventos/endpoints):** riesgo real y honesto. El código es tolerante pero NO se ejercita en CI (necesita navegador+micrófono+env). **Aceptado para F1**; debe validarse en el E2E manual documentado cuando el usuario ponga la clave Realtime. Anotado para el arranque real.
- **Límite de coste** `VOZ_MAX_MINUTOS` (defecto 8) en `.env.example`, con aviso a los 7 y corte suave — coherente con ADR-001.

## Para WP-05 (siguiente)

- Sin relación directa; WP-05 (perfil con gráficos) consume datos de `observaciones`/`tomas_medicacion` ya poblados por texto y voz.
- Recordatorio: los componentes de gráfico deben recibir series ya calculadas y NO importar Supabase (los reutiliza WP-06).
