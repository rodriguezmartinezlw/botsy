# Revisión WP-11 v2 — Núcleo de programas oncología + disposición estructurada

**Fecha:** 2026-07-17 · **Revisor:** Fable/Opus (auto-revisión) · **Veredicto:** ✅ Aprobado sin cambios de código. Es el paquete más grande y sensible del piloto; verificado a fondo.

## Verificación independiente

- `npx vitest run` → **161/161** (122 previos intactos + 39 nuevos). `npm run lint` → exit 0. `npm run build` → exit 0 (23 rutas, incl. `/desenlaces`).
- Migraciones nuevas: `0006_programas` (2 tablas, RLS en ambas, 8 políticas), `0007_disposiciones` (2 tablas, RLS, 6 políticas), `0008_consentimiento_uso_secundario` (altera el check de `consentimientos.tipo`; sin tabla nueva → sin RLS, correcto). Ninguna migración commiteada (0001–0005) editada.
- `grep any` en `programas`/`disposiciones`/`vocabulario-onco` → limpio.

## Reglas de oro — verificadas a mano (lo que importa de este WP)

1. **Regla de oro 3 — disposición estructurada OBLIGATORIA.** Leí `alertas/acciones.ts`: `resolverAlerta`/`descartarAlerta` pasan por `cerrarConDisposicion`, que (a) exige `validarDisposicion` (Zod real, no stub — rechaza disposición incompleta con mensaje claro), (b) verifica que el motivo existe, está activo y es del ámbito correcto del `catalogo_motivos`, (c) INSERTA la `disposicion` como fuente de verdad (con `alerta_id` UNIQUE → idempotente, no se cierra dos veces) y solo entonces cierra la alerta y audita. **Cerrar una alerta sin disposición es imposible por diseño.** `marcarVista` no cierra, así que no la exige — correcto.
2. **Gating server-side (§A.3).** `iniciar/route.ts` llama a `moduloActivoPaciente(supabase, user.id, "texto")` y devuelve **403** si el módulo está apagado; ídem en `mensaje` y `voz/sesion`. No se confía en ocultar botones.
3. **v1 no predice / no diagnostica.** Reglas de escalado deterministas; todos los umbrales `[PENDIENTE CLÍNICO]`. La expresión clínica "neutropenia febril" aparece SOLO en comentarios SQL y en la `descripcion` interna de la regla (para el profesional), nunca en texto al paciente. Sin lenguaje predictivo en UI.
4. **Paciente sin programa = F1 intacto** (`CONFIG_POR_DEFECTO`), probado por el agente.

## Contenido oncológico

Seed de 2 programas de mama; `vocabulario-onco.ts` (CTCAE es-ES); reglas seed `[PENDIENTE CLÍNICO]` (fiebre≥38 en tratamiento activo→urgencia; oral→contactar; diarrea/vómitos/dolor sostenido→contactar); `fiebre` en °C (34–43) conviviendo con las escalas 0–10; `pautas_medicacion.motivo_discontinuacion` + acción `discontinuarPauta` con motivo codificado. `uso_secundario`: opt-in separado, `[PENDIENTE LEGAL]`, opcional (ninguna función depende de él).

## Decisiones del agente — aprobadas

1. `reglas_escalado.programa_paciente_id` (aditivo): buena traza + idempotencia + cascada al desasignar. OK.
2. `disposiciones.motivo_codigo` y `pautas.motivo_discontinuacion` son FK a `catalogo_motivos(id)` (el `codigo` no es único global): correcto; conserva el nombre del PLAN.
3. Política `programas_select_asignado` (el paciente lee SOLO su programa asignado): necesaria porque el check-in dirigido corre como el paciente. Verificado que no sobreexpone (solo su asignación).
4. `valor_num` con `superRefine` por código → el JSON Schema de la tool ya no publica bounds estáticos. Aceptable: la validación Zod sigue rechazando fuera de rango antes de persistir (el test de rechazo Zod de WP-02 sigue verde); la guía va en el prompt. Riesgo menor, anotado.

## Pendiente (no de este WP)

- Aplicar las migraciones `0001–0008` al proyecto Supabase en vivo (`hjkvmhccgorphhykoarg`, BD vacía) → WP-09. Las claves (Supabase + OpenAI) ya están en `.env.local`; falta Resend.
- Umbrales `[PENDIENTE CLÍNICO]` → llamada al psicooncólogo.

## Para lo siguiente

- WP-17 (dashboard patrocinador) reutiliza `programas_paciente`/`pautas.motivo_discontinuacion` (persistencia) y `disposiciones.desenlace` (ROI de WP-15).
- WP-16 (termómetro NCCN) enchufa en el hueco `instrumentos` de la config de programa ya tipado.
