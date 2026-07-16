# Entrega WP-10 — Deuda técnica consciente de F1

**Fecha:** 2026-07-16 · **Implementador:** Opus · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` (122) en verde.

## Checklist ítem a ítem

| # | Ítem | Qué se hizo | Test / prueba |
|---|---|---|---|
| 1 | `desactivada_en` en pautas | Migración `0005` añade `pautas_medicacion.desactivada_en`; la Server Action `cambiarEstadoPauta` la fecha al desactivar y la limpia al reactivar; `datos.ts` emite un evento fechado de baja y `LineaTemporal.tsx` lo pinta ("Pauta desactivada", gris). Tipos `db.ts` actualizados | build + render; el evento aparece en la línea temporal |
| 2 | Endurecer INSERT de auditoría | Migración `0005` recrea `auditoria_insert_autenticado` con `with check (actor_id = auth.uid())`. Verificado que TODOS los inserts autenticados usan `actor_id = auth.uid()` (panel=userId, check-in=pacienteId propio, contacto=user.id) y que cron + motor usan service-role (bypass RLS, `actor_id NULL`) | `auditoria.test.ts`: nueva aserción que congela la política |
| 3 | Dedup de informes | Quitado el `insert` automático de `informe/page.tsx` (creaba una fila por recarga). Nueva Server Action `guardarInforme` (Zod + `obtenerSesionPanel` + audit) y botón "Guardar informe" en `BarraInforme`. El informe se renderiza siempre; se persiste solo al pulsar | build; RLS `informes_insert_profesional` (WP-07) restringe el INSERT |
| 4 | Validador de cifras en letras | `resumen.ts`: parser básico es-ES (`extraerCifrasEnLetras`, 0–9999 con "mil"/"cien") integrado en `validarResumenSinCifrasInventadas`. Un número en letras ajeno a los datos descarta el resumen | `resumen.test.ts`: "cuarenta y dos"=42 detectado/descartado; +4 tests |
| 5 | Aviso inmediato al profesional en URGENCIA | Nuevo `escalado/notificacion.ts` (email SOBRIO, sin datos clínicos, link a `/alertas`, resuelve email del profesional vía `auth.admin.getUserById`, audita). Cableado por el puerto `RepositorioAcciones.notificarUrgencia`, llamado desde `aplicarEscalado`/`aplicarEscaladoSenalGenerica` SOLO cuando el nivel resultante es `urgencia` y la alerta es nueva → idempotente. Cubre los 3 orígenes (/mensaje, /voz/tool, cierre) por el mismo choke point | `motor.test.ts`: aviso una vez; re-evaluar no re-avisa; `contactar` NO avisa |
| 6 | Preservar destino tras login | `src/proxy.ts` (convenio Next 16, NO toca `/api`): navegación de página sin sesión → `/login?next=<ruta>`. Saneador `destinoSeguro` (extraído a `roles.ts`, anti open-redirect) usado por el proxy y por `login/page.tsx`. Falla abierto sin env (backstop = guards de layout) | `roles.test.ts`: acepta rutas internas, rechaza `//`, `https://`, `/\`, `javascript:` |
| 7 | `npm audit` documentado | 2 moderadas: `postcss <8.5.10` (XSS en CSS Stringify) vía `next`. El fix (`audit fix --force`) haría **downgrade a next@9.3.3** (breaking) → NO se aplica. Es build-time (postcss compila CSS), sin vector de runtime en la app. Vigilar un Next 16.x que bumpee postcss | documentado aquí |

## Migración

`supabase/migrations/0005_deuda_tecnica.sql` — aditiva (columna `desactivada_en` + recreación de la política de auditoría). No edita ninguna migración commiteada. Sintaxis validada por revisión (mismo patrón que 0001-0004; libpg_query no reejecutado en este entorno pero el SQL es estándar).

## Decisiones propias

1. **El aviso de urgencia (ítem 5) va por el puerto `RepositorioAcciones`**, no en cada Route Handler: así los 3 orígenes lo heredan por el único punto de materialización de alertas, y la idempotencia (una alerta nueva de urgencia ⇒ un aviso) es natural. El módulo `notificacion.ts` se traga sus errores (best-effort): un email caído nunca tumba el escalado.
2. **El proxy falla abierto** sin `NEXT_PUBLIC_SUPABASE_*`: no bloquea (los guards de layout deciden), para que build/CI sin proyecto sigan verdes.
3. **`guardarInforme` persiste el resumen ya generado en el render** (pasado a la barra), sin re-llamar al LLM en cada guardado (coste). El profesional está autorizado y el dato es suyo; Zod valida la forma.

## Riesgos / notas

- El bloque `auth.users`/GoTrue del seed sigue pendiente de `db reset` en vivo (heredado de WP-01); no afecta a WP-10.
- Los opcionales (RPC transaccional del cierre, SSE del último turno) NO se hicieron (fuera del núcleo de la deuda; quedan anotados para más adelante).

## Verificación

- `npm test` → **122 passed** (113 previos + 9 nuevos: roles 3, cifras-en-letras 4, auditoría 1, aviso urgencia 1 + aserciones en tests existentes).
- `npm run lint` → exit 0. `npm run build` → exit 0 (22 rutas; `ƒ Proxy` registrado; sin warning de deprecación).
- `grep any` en el código nuevo/tocado → sin coincidencias.
