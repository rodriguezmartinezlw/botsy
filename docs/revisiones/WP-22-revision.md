# Revisión WP-22 — Instituciones, país y multi-institución

**Fecha:** 2026-07-17 · **Revisor:** Fable/Opus · **Veredicto:** ✅ Aprobado con una corrección de seguridad aplicada por el director + verificación EN VIVO exhaustiva (por ser el cambio de RLS de mayor radio del proyecto).

## Verificación independiente

- `npx vitest run` → **247/247**. `npm run lint` → exit 0. `npm run build` → exit 0.
- Migraciones 0016 (esquema + RLS + reescritura `es_profesional_de`) y 0017 (filtro país/institución en las 9 RPC del patrocinador). 3 tablas nuevas con RLS. Sin `any`.

## Verificación EN VIVO (lo crítico — RLS de alto radio)

Apliqué 0016 + 0017 al Supabase real, backfilleé el catálogo (países PE/CO/BR/ES, 2 instituciones, membresías García→A, Ruiz→B, + Vega A+B) y asigné `institucion_id` a los 11 pacientes existentes (0 quedaron sin institución). Resultado de las pruebas con simulación de JWT por usuario:

- **`acceso_cruzado.sql` COMPLETO en verde en vivo** — todos los escenarios, incluidos los nuevos de institución (9: Vega A+B ve ambas; 10: catálogo; 11: paciente).
- Verificación puntual adicional: García (A) ve 10 pacientes de A y **0** de Marta (B); Ruiz (B) ve solo a Marta y **0** de A; un paciente ve solo lo suyo; **multi-institución** (añadir García a B → ve a Marta, con rollback). El aislamiento se preserva y el modelo por institución funciona contra datos reales.
- `es_profesional_de` reescrita verificada: la visibilidad pasó de "médico directo" a "equipo de la institución" sin romper el aislamiento entre instituciones.

## Regresión REAL encontrada y corregida (migración 0018)

**0017 re-rompió el hardening de las RPC del patrocinador.** Al recrear las 9 funciones con nueva firma (DROP+CREATE ⇒ ACL reseteada a `PUBLIC EXECUTE`), 0017 repitió el patrón INEFECTIVO de 0010: `revoke ... from anon` (no revoca un permiso de PUBLIC) en vez de `revoke ... from public`. Confirmado en vivo: `patro_roi` volvía a tener `PUBLIC EXECUTE` → ejecutable por anon (el fix 0014 quedó deshecho por el cambio de firma). Es la misma cadena que ya vi con 0013.

- **Fix (0018):** DO-block que itera sobre TODAS las funciones `patro\_%` (robusto a la firma) y `revoke from public/anon` + `grant to authenticated/service_role`. Verificado en vivo: las 9 RPC ya tienen `anon = false`. (El helper `patrocinador_del_usuario`, sin `_` tras "patro", no matchea el patrón y conserva PUBLIC — es benigno: devuelve solo el id del patrocinador del propio usuario, categoría aceptada como los demás helpers.)
- El linter de seguridad bajó de nuevo a 8 avisos anon (solo helpers benignos).

## Decisiones del agente — aprobadas

- `es_profesional_de` reescrita sin cambiar firma (todas las políticas heredan el modelo). `profesional_id` conservado como "médico responsable" (contacto/escalado), documentado con `comment on column`.
- Enrolamiento exige institución (de las del profesional); panel filtra por institución; ficha muestra institución·país.
- Capacidad de filtro país/institución en las RPC (0017); el **selector de desglose por institución en el dashboard del patrocinador queda como mejora anotada** (la capacidad SQL está; falta la UI). Aceptado.
- Tests adaptados al modelo por institución (`enrolamiento`, `panel`) — cambios de expectativa legítimos, verificados.

## Riesgo operativo documentado (para producción)

- **Un paciente con `institucion_id = NULL` es invisible para todo profesional.** El enrolamiento (WP-20) siempre asigna institución, pero cualquier alta futura por otra vía debe fijarla. Antes de datos reales: `select count(*) from pacientes where institucion_id is null;` debe ser 0.
- La BD viva se backfilleó de forma dirigida (no reset); queda idéntica al seed committeado (incluido Vega). Un reset fresco re-aplica todo desde 0001..0018 + seed.

## Estado

Migraciones 0016, 0017 (agente) + 0018 (director). BD viva con el modelo por institución, RLS verificada en vivo end-to-end. 247 tests, build/lint verdes.
