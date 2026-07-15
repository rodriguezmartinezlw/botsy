# Revisión WP-04 — Motor de escalado + alertas

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado con una corrección de seguridad clínica aplicada por el director.

## Verificación independiente

- `npx vitest run` → **25/25 verde** (17 nuevos de escalado + 8 de WP-02 intactos).
- `npm run lint` → exit 0. `npm run build` → verde.
- `grep any` en `src/lib/escalado` y `src/app/api/escalado` → sin coincidencias.

## Lo que verifiqué a mano

1. **`textos.ts` (lo más crítico):** los textos al paciente son calmados y NO diagnostican. Distinguen "señal detectada" de "diagnóstico" (`aclaracionSenal`), dan instrucciones de urgencia sin dramatizar y marcan el aviso de responsabilidad con `[PENDIENTE LEGAL]`. Los únicos aciertos del grep de términos prohibidos estaban en un comentario (documenta lo vetado) y en "no tiene por qué ser nada grave" (lenguaje tranquilizador, no alarmista). **Cumple CLAUDE.md.**
2. **`acciones.ts` — idempotencia:** comprueba `alertaExiste(checkin, regla)` antes de crear; solo escribe riesgo/auditoría si hubo alerta nueva; el riesgo solo sube (`nivelMaximoRiesgo`). Correcto.
3. **Service-role:** justificado (por RLS de WP-01 el paciente no puede leer `reglas_escalado` ni insertar `alertas`), confinado al servidor (import diferido de `admin`), tras autenticar y verificar pertenencia en el handler. Correcto.
4. **`finalizar/route.ts`:** escalado best-effort en try/catch que nunca impide cerrar; idempotente (retorno temprano si ya está `completado`).

## Corrección de seguridad aplicada por el director

**Hueco: la alerta al profesional solo se materializaba al cerrar el check-in.** El escalado en vivo (`evaluarSenal` en `/api/checkin/mensaje`) subía el riesgo del check-in y mostraba al paciente la pantalla de urgencia, pero la fila `alertas` para el profesional solo se creaba en `/finalizar`. Escenario roto (el más crítico del producto): paciente reporta dolor torácico + disnea → ve la pantalla de urgencia → llama al 112 / cierra la app **sin pulsar "terminar"** → el profesional **nunca recibe la alerta**. Contradice RF-ES-03/04 ("notificación inmediata al profesional").

- **Acción:** en `/api/checkin/mensaje`, tras un turno que eleva el riesgo a `contactar`/`urgencia`, se materializa la alerta en el acto reutilizando la misma maquinaria idempotente de `/finalizar` (`evaluarCheckin` + `aplicarEscalado` con service-role). Best-effort en try/catch: no bloquea la respuesta al paciente. La idempotencia por `(checkin_id, regla_id)` garantiza que `/finalizar` no duplique.
- **Verificado:** lint/build verdes, 25/25 tests intactos.
- **Alcance de la corrección:** cubre las escaladas con regla asociada (el caso urgencia dolor torácico+disnea del seed). Las señales genéricas sin regla (`regla_id` null, nivel `contactar` por defecto) siguen consolidándose al cierre; es aceptable en F1 (menor criticidad temporal) y queda anotado para WP-08.

## Discrepancia del agente (§5.A) — resuelta bien

El WP-04 describía `evaluarSenal(checkinId, senal)` (con IO) mientras la revisión de WP-02 exigía conservar la firma pura que consume `loop.ts`. El agente resolvió a favor de la firma pura (reglas `senal` inyectadas por contexto), cambio aditivo que no rompe WP-02. Correcto.

## Para los siguientes WP

- **WP-06** ya tiene `obtenerAlertas(filtros)` (`consultas.ts`) con RLS de profesional listo para la bandeja.
- **WP-08** debe: (a) revisar la consolidación de señales genéricas sin regla, (b) considerar envolver finalizar en RPC transaccional si se quiere atomicidad estricta.
