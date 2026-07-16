# Revisión WP-08 — Hardening y preparación de salida (último de F1)

**Fecha:** 2026-07-15 · **Revisor:** Fable (director) · **Veredicto:** ✅ Aprobado sin cambios de código. **Con esto F1 queda completo.**

## Verificación independiente

- `npx vitest run` → **113/113 verde** (96 previos intactos + 4 de señal genérica + 13 de auditoría de acceso cruzado).
- `npm run lint` → exit 0. Build → verde (22 rutas).
- Entregables presentes: `docs/DESPLIEGUE.md`, `src/lib/seguridad/auditoria.test.ts`, `supabase/tests/acceso_cruzado.sql`.
- `grep` estricto del bundle `.next/static` (`OPENAI_API_KEY|service_role|SUPABASE_SERVICE_ROLE|sk-[A-Za-z0-9]{20}`) → **0**.
- `grep any` en `src/lib/seguridad`, `src/lib/escalado/acciones.ts` → sin coincidencias.

## Verificado a mano — el hueco clínico (b) y su idempotencia

El punto más importante: las **señales genéricas sin regla** ahora materializan alerta al profesional (antes el paciente veía "contacta con tu médico" pero no se creaba fila `alertas` → profesional a ciegas). Verifiqué que NO genera spam:

- `aplicarEscaladoSenalGenerica` solo actúa si el riesgo es `contactar`/`urgencia` y ninguna regla disparó, y **deduplica** con `alertaSinReglaExiste(checkinId)`.
- Esa consulta es real: `select id from alertas where checkin_id = X and regla_id is null limit 1`. Una única alerta genérica por check-in, aunque el paciente siga mandando mensajes en riesgo. 9 tests cubren señales genéricas.
- Cableado en `/mensaje`, `/voz/tool` y el cierre, coherente con la materialización inmediata que introduje en la revisión de WP-04. Extiende mi fix; no lo rompe.

## Seguridad — resultado

- **RLS revisada política por política** contra la matriz de WP-01: **sin defectos** → no hizo falta migración nueva (correcto: no inventar cambios de esquema sin causa).
- Auditoría de acceso cruzado en dos formas: test estático en CI (congela la matriz + invariantes de secreto) y script SQL en vivo (6 escenarios por JWT). Buen doble registro.
- Sin fugas de secreto en el bundle; sin `service-role` en cliente.

## Demo, robustez, accesibilidad, docs — OK

- Seed ampliado: Luis **45 días** (resuelve el desfase de 14 de WP-07), alertas en los 4 estados; Carmen 12 días; seed del 2º profesional intacto.
- Sesión expirada → login conservando destino (`?next=` saneado). Estados error/vacío verificados.
- Skip-link de teclado, `[PENDIENTE LEGAL]` en el informe, contraste AA / fuentes ≥16px / targets ≥44px.
- `docs/DESPLIEGUE.md` ejecutable + "Desarrollo local" en README; `.env.example` completo (12/12).

## Deuda consciente para F2 (aceptada, etiquetada)

1. `desactivada_en` en `pautas_medicacion` o exponer subconjunto de auditoría al profesional.
2. Dedup de `informes` (hoy se persiste cada emisión como traza).
3. `npm audit`: 2 moderadas en la cadena de `next`/`postcss` (build-only). **No** aplicar `audit fix --force` (haría downgrade a next@9). Vigilar en actualizaciones de Next.
4. Endurecer el INSERT de `eventos_auditoria` con `actor_id = auth.uid()` (defensa en profundidad; no es defecto vs. la matriz actual).
5. Preservar destino en navegaciones server directas (requeriría middleware).

Ninguno bloquea el lanzamiento de F1 como bienestar/registro.

## Cierre de F1

Los 9 paquetes (WP-00…WP-08) están implementados, revisados y commiteados. El sistema compila, pasa 113 tests, tiene RLS sin defectos, no filtra secretos y trae guía de despliegue. Pendiente antes de pacientes reales (fuera de F1, decisión del usuario): crear proyecto Supabase + claves reales y correr las pruebas E2E documentadas; textos legales reales; diligencia RGPD/DPA de proveedores.
