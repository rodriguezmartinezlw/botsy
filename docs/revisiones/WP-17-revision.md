# Revisión WP-17 + WP-15 — Dashboard del patrocinador + demo + informe ROI

**Fecha:** 2026-07-17 · **Revisor:** Fable/Opus (auto-revisión) · **Veredicto:** ✅ Aprobado con una corrección de integridad de datos aplicada por el director.

## Verificación independiente

- `npx vitest run` → **194/194** (161 previos + 33 nuevos). `npm run lint` → exit 0. `npm run build` → exit 0 (25 rutas, `/patrocinador` + `/patrocinador/roi`).
- Migraciones nuevas `0009_patrocinador` y `0010_patrocinador_rpc` validadas (libpg_query por el agente); ninguna commiteada (0001–0008) editada.
- `grep any` en `patrocinador` → limpio.

## Privacidad — verificada a mano (lo más crítico del WP)

1. **El patrocinador NO tiene ninguna política de lectura sobre tablas de pacientes.** `grep` de `patrocinador` en `0009` → solo comentarios y las tablas propias (`patrocinadores`, `programas_patrocinados`); CERO `create policy ... on pacientes/checkins/observaciones/alertas ...` para el rol. Su único acceso a datos es vía RPC.
2. **k-anonimato ≥5 en doble capa:** las 9 RPC de `0010` (46 referencias a la supresión) y la capa TS `agregacion.ts` suprimen/omiten todo corte con <5 pacientes ("datos insuficientes"). Verificado en la demo en vivo: el corte de 4 pacientes muestra "Datos insuficientes".
3. **RPC endurecidas:** 11 `security definer`, 20 referencias a `set search_path` seguro / `revoke ... from anon`. Correcto.
4. **v1 no predice:** ROI con proxy HONESTO documentado en el propio informe (disposiciones `resuelto_sin_evento` sobre alertas contactar/urgencia), sin ML ni proyecciones; validador anti-cifras-inventadas reutilizado.

## Corrección aplicada por el director (integridad de datos)

**El agente añadió una columna `pautas_medicacion.discontinuada_en` que solo el seed rellenaba.** La curva de persistencia/ROI la lee, pero el flujo REAL del panel (`discontinuarPauta`, WP-11) rellenaba `desactivada_en` + `motivo_discontinuacion`, NO `discontinuada_en` → en producción las curvas saldrían VACÍAS (solo el seed las poblaba).

- **Acción:** `discontinuarPauta` ahora rellena también `discontinuada_en` (mismo instante que `desactivada_en`). Semántica documentada en el código: `desactivada_en` = cualquier baja; `discontinuada_en` = baja clínica REAL con motivo → alimenta persistencia/ROI. 194 tests siguen verdes, build verde.
- **Deuda aceptada (menor):** `discontinuada_en` es redundante con `desactivada_en WHERE motivo_discontinuacion IS NOT NULL`; se conserva la columna (todo el WP se construyó alrededor de ella) en vez de reescribir 0009/0010/seed/tests. Anotado para una limpieza futura opcional.

## Decisiones del agente — aprobadas

- **Bypass del proxy para `/patrocinador` en `DEMO_MODE`:** correcto y seguro — la garantía de privacidad NO depende del proxy, sino de la RLS (0009, sin lectura de patrocinador sobre pacientes) + las RPC k≥5 (0010). El bypass solo sirve para enseñar la demo en local.
- **Seed oncológico** (10 pacientes de mama, 45 días, 2 discontinuaciones codificadas, alertas en los 4 estados con disposición+desenlace, patrocinador demo): conserva `seed_wp06` (Dr. Ruiz/Marta) y los IDs de `acceso_cruzado.sql` (a validar en vivo en WP-09).
- `.env.example` **sí está trackeado** (el `.gitignore` `.env*` no destrackea un fichero ya versionado): la variable `DEMO_MODE` se commitea sin problema — el aviso del agente era infundado.

## Notas

- `docs/DEMO-GUION.md` (guion de 10 min de la demo vendible) entregado.
- El agente dejó vivo un `next dev` en el puerto 3123 (sandbox no lo dejó cerrar); inocuo.
- **Pendiente para WP-09:** aplicar `0001–0010` + seed al Supabase en vivo y validar `acceso_cruzado.sql` (incluidos los 2 escenarios nuevos de patrocinador) contra el proyecto real.

## Para WP-16 (siguiente)

- Enchufa en el hueco `instrumentos` de la config de programa (WP-11) y persiste en `instrumentos_respuestas` (nueva tabla); su serie temporal puede alimentar también al dashboard del patrocinador más adelante.
