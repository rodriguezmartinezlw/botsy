# Auditoría de verificación profunda — 2026-07-17

**Revisor:** Fable/Opus (director) · **Motivo:** el usuario pidió una pasada para atrapar cualquier defecto latente como los que la verificación en vivo destapó en WP-09. Enfoque: lo invisible a los tests unitarios y al modo demo — BD real, bundle compilado, linters propios de Supabase.

## Qué se verificó y resultado

| # | Verificación | Resultado |
|---|---|---|
| 1 | Secretos en git (histórico + árbol) | ✅ `.env.local` nunca trackeado; sin secretos reales en código |
| 2 | Secretos en el bundle de CLIENTE (`.next/static`, build limpio) | ✅ La firma única de la service_role NO aparece (el acierto inicial era la cabecera JWT compartida con la anon; la anon SÍ está, es pública por diseño) |
| 3 | `acceso_cruzado.sql` EN VIVO tras WP-20 | ✅ Pasa completo (RLS intacta) |
| 4 | Linter de SEGURIDAD de Supabase | 35 → 26 hallazgos tras el fix (ver abajo) |
| 5 | Linter de RENDIMIENTO de Supabase | 95 → 75 tras índices FK (resto documentado, no urgente) |
| 6 | Suite completa + build | ✅ 243 tests, build/lint verdes |

## Defectos REALES encontrados y corregidos

1. **`revoke ... from anon` inefectivo en las RPC del patrocinador (0010).** El linter + verificación en vivo mostraron que `patro_roi` (y las 8 hermanas) tenían `EXECUTE` para `PUBLIC` → **anon podía invocarlas**. No hay fuga de datos (el guard interno `es_patrocinador()` devuelve vacío a no-patrocinadores), pero el cierre que 0010 pretendía nunca ocurrió: no se puede revocar de `anon` un permiso concedido a `PUBLIC`. **Fix (migración 0014):** `revoke ... from public` + `grant ... to authenticated, service_role`. Confirmado en vivo: `patro_roi` ya no la ejecuta PUBLIC/anon. Es el mismo patrón de "algo que se creía cerrado y no lo estaba" que WP-09 destapó.
2. **20 claves foráneas sin índice de cobertura.** Penaliza JOINs y comprobaciones de RLS (`es_profesional_de` filtra por `pacientes.profesional_id`). **Fix (migración 0015):** 20 índices `if not exists`. Confirmado: `unindexed_foreign_keys` 20 → 0.
3. **Protección de contraseñas filtradas (HIBP) desactivada.** Intenté habilitarla → HTTP 402: requiere **plan Pro** de Supabase. Limitación de plan, no de código. Anotado como config pendiente (relevante para población vulnerable).

## Hallazgos revisados y ACEPTADOS (no accionables o de bajo valor/alto riesgo)

- **8 avisos "anon puede ejecutar security-definer helper"** (`es_admin`, `es_profesional_de`, `es_profesional_o_admin`, `paciente_de_checkin`, `paciente_de_alerta`, `es_patrocinador`, `patrocinador_del_usuario`, `gestionar_nuevo_usuario`): devuelven SOLO booleanos sobre el propio usuario (sin dato sensible; anon → false/null). Se usan DENTRO de políticas RLS evaluadas por `authenticated` y en el trigger de alta; tocar sus grants arriesgaría la RLS/el signup por un aviso cosmético. **Aceptado.**
- **17 avisos "authenticated puede ejecutar security-definer"**: es CÓMO funciona la RLS (los helpers) y la API del patrocinador (los `patro_*`). Esperado y necesario.
- **6 `unused_index`**: la BD es nueva/pequeña; los índices se usarán con tráfico real.

## Diferido a WP-21 (rendimiento de RLS a escala — NO urgente para el piloto)

- **28 `auth_rls_initplan`**: políticas que reevalúan `auth.uid()`/funciones por fila; el patrón recomendado es `(select auth.uid())`. Requiere recrear políticas.
- **41 `multiple_permissive_policies`**: varias políticas permisivas por rol/acción; consolidarlas mejora el plan. Requiere recrear políticas.

Ambos son puramente de rendimiento a escala (miles de filas); con decenas de pacientes del piloto son negligibles. Requieren tocar muchas políticas con cuidado → mejor un WP dedicado que inline en esta auditoría. Ver `docs/wp/WP-21-rendimiento-rls.md`.

## Conclusión

No se encontró ningún defecto de CORRECCIÓN ni de FUGA de datos nuevo. Sí un cierre de seguridad latente (anon-ejecutabilidad de RPC, ya corregido) y mejoras de rendimiento (índices FK aplicados; RLS-initplan diferido). El sistema sigue en verde (243 tests, RLS en vivo verificada). Migraciones nuevas: 0014, 0015.
