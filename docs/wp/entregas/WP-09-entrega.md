# Entrega WP-09 — Puesta en producción (Supabase en vivo) + E2E

**Fecha:** 2026-07-17 · **Ejecutor:** Fable/Opus (director, en la sesión principal) · **Proyecto:** `hjkvmhccgorphhykoarg` (Supabase, cuenta personal).

## Qué se hizo

1. **Migraciones 0001–0011 aplicadas** al proyecto en vivo vía Management API (BD estaba vacía). Todas OK.
2. **Seed aplicado** (`supabase/seed.sql` + `seed_wp06_segundo_profesional.sql`). **El bloque `auth.users`/GoTrue funcionó** — resuelve la duda arrastrada desde WP-01. Estado resultante: 19 tablas (todas con RLS), 15 usuarios auth, 11 pacientes de mama con 2 programas asignados, 389 check-ins, 1250 observaciones, alertas en los 4 estados con 7 disposiciones.
3. **Verificación de acceso cruzado en vivo** (`supabase/tests/acceso_cruzado.sql`, con simulación de JWT por rol): **PASA completo** tras las correcciones de abajo.
4. **E2E de la IA con clave real:** `gpt-5-mini` extrajo 2 observaciones estructuradas de un mensaje de paciente ("me duele la cabeza 7/10 y tuve fiebre") → `dolor/cefalea/7` y `sintoma_fisico/fiebre`, vía function calling. El motor conversacional funciona end-to-end con OpenAI real.

## Bugs REALES encontrados por la verificación en vivo (y corregidos)

La prueba de acceso cruzado nunca se había podido ejecutar sin BD; al correrla contra el proyecto real destapó 2 defectos que ni los tests unitarios ni el modo demo detectaban:

1. **RLS: el paciente podía leer las reglas de escalado GLOBALES.** La política `reglas_select_profesional` (0002) usaba `paciente_id is null or es_profesional_de(...)`; la rama `paciente_id is null` abría las reglas globales a cualquier autenticado, contradiciendo el invariante de WP-01 ("paciente: SIN acceso"). **Fix: migración 0012** — gatea el SELECT a `es_profesional_o_admin()`. El motor lee reglas con service-role (no afectado). Congelado con una aserción nueva en `auditoria.test.ts`.
2. **RPC del patrocinador con `n` ambiguo.** 5 funciones (`patro_persistencia`, `patro_meses_tratamiento`, `patro_tasa_checkin`, `patro_tiempo_hasta_disposicion`, `patro_roi`) declaran una columna de salida `n` y referencian `(select n from npac)` → ambigüedad PL/pgSQL, error en tiempo de ejecución contra la BD real. El modo demo usa datos sintéticos en TS y no ejecuta las RPC, por eso no se vio. **Fix: migración 0013** — `#variable_conflict use_column` (recrea las 5 idénticas; no edita 0010).

## Corrección de completitud de datos

3. **Reglas de programa no materializadas por el seed.** El seed inserta las asignaciones de programa directamente, sin pasar por la acción del panel que materializa las reglas del programa (`sincronizarReglasPrograma`). Resultado: solo existían las 5 reglas globales; las reglas oncológicas por paciente (fiebre→urgencia, distrés→contactar…) no. **Fix:** bloque de materialización idempotente añadido a `supabase/seed.sql` (replica la lógica del panel). Live: 55 reglas ahora (5 globales + 50 de programa).

## Estado y verificación

- `npm test` → **216/216** (215 + 1 aserción del fix 0012). `npm run build` → verde. `npm run lint` → verde.
- Migraciones nuevas 0012, 0013 aplicadas en vivo; `acceso_cruzado.sql` en verde end-to-end (incluidos los escenarios de patrocinador).
- Credenciales en `.env.local` (Supabase URL/anon/service_role/PAT/CRON_SECRET, OpenAI texto+Realtime). Falta solo Resend para el envío real de emails.

## Pendiente / cómo probar lo interactivo

- **Check-in interactivo (voz y texto) en el navegador:** listo para `npm run dev` con el `.env.local`. Login con un usuario del seed (contraseñas documentadas en el seed/entregas), check-in por texto o voz (voz requiere micrófono; no se puede conducir headless). La capa de IA ya está probada en vivo (arriba).
- **Dashboard del patrocinador contra BD real:** operativo tras el fix 0013 (antes solo el modo demo). 
- **Resend:** aportar `RESEND_API_KEY` para recordatorios y avisos de urgencia por email.
- Los umbrales `[PENDIENTE CLÍNICO]` siguen a la espera del psicooncólogo (regla de puertas).
