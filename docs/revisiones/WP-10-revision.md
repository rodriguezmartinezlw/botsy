# Revisión WP-10 — Deuda técnica

**Fecha:** 2026-07-16 · **Revisor:** Fable/Opus (auto-revisión — mismo modelo construye y verifica) · **Veredicto:** ✅ Aprobado.

## Verificación independiente

- `npx vitest run` → **122/122**. `npm run lint` → exit 0. `npm run build` → exit 0 (proxy registrado, sin deprecación).
- `grep any` en el código nuevo/tocado → limpio.

## Chequeo de las reglas de oro (v2) y seguridad

- **Sin datos clínicos en el email de urgencia (ítem 5):** el asunto y el cuerpo de `plantillaUrgenciaProfesional` no revelan diagnóstico, síntoma ni nombre — solo dirigen a la bandeja. Cumple "no diagnostica" y minimización.
- **RLS:** ítem 2 endurece la auditoría (`actor_id = auth.uid()`) sin abrir nada; verificado que ningún camino autenticado se rompe (cron/motor son service-role). `informes` conserva su RLS de WP-07 para el guardado explícito (ítem 3). Ninguna tabla nueva.
- **Anti open-redirect (ítem 6):** `destinoSeguro` rechaza `//`, `https://`, `/\`, esquemas; testeado. El proxy no toca `/api` (regla Next 16) y falla abierto sin env.
- **v1 no predice:** el validador de cifras en letras (ítem 4) REFUERZA la barrera anti-alucinación; nada añade capacidad predictiva.

## Notas

- Idempotencia del aviso de urgencia verificada por test (una vez; re-evaluar no re-avisa; `contactar` no avisa). Buen patrón: un único choke point para los 3 orígenes.
- `npm audit` (ítem 7): 2 moderadas build-time vía next→postcss; no se aplica `--force` (downgrade a next@9). Correcto; vigilar en bumps de Next.
- Pendiente heredado (no de WP-10): validar el seed GoTrue en vivo (WP-09).

## Para WP-11 v2 (siguiente)

- Base lista: `desactivada_en` ya existe (WP-11 v2 añadirá `motivo_discontinuacion`); el patrón de Server Actions de panel con `obtenerSesionPanel` + Zod + auditoría es el molde para la disposición estructurada.
