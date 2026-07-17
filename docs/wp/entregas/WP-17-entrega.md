# WP-17 (dashboard patrocinador + seed demo + modo demo) + WP-15 (informe ROI pagador) — Entrega

**Fecha:** 2026-07-17 · **Implementador:** Opus (agente) · **Estado:** completo. `npm run build`, `npm run lint` y `npm test` en verde (194 tests). Migraciones nuevas (0009, 0010) validadas con el parser real de Postgres (libpg_query). Demo verificada end-to-end en local con `DEMO_MODE=true` (sin claves). Construido sobre F1 + WP-10 + WP-11 v2; ninguna migración commiteada (0001–0008) editada. **No se ha hecho commit.**

---

## 1. Resumen

Se implementan JUNTOS WP-17 y WP-15 (comparten seed y capa de agregación):

- **WP-17 — Dashboard del patrocinador.** Rol `patrocinador` + tablas `patrocinadores` / `programas_patrocinados`. **Garantía de privacidad**: el patrocinador NO tiene NINGUNA política de lectura sobre tablas de pacientes; su único acceso a datos clínicos son 9 funciones RPC `security definer` que devuelven SOLO agregados con **k-anonimato ≥ 5** (persistencia, meses en tratamiento, adherencia mensual, motivos de discontinuación codificados, tasa de check-in, alertas por nivel, tiempo hasta disposición) — ningún corte con < 5 pacientes se devuelve. Área `(patrocinador)` con route guard, dashboard que reutiliza `src/components/graficos/`, y export a PDF/print.
- **MODO DEMO.** Flag `DEMO_MODE` que sirve el dashboard y el ROI sobre una cohorte **sintética en memoria** (10 pacientes de mama) con marca de agua "DEMO — datos sintéticos", **funcionando en LOCAL sin claves de producción**. El proxy deja pasar `/patrocinador` en demo y el layout se salta el guard.
- **SEED oncológico demo.** `supabase/seed.sql` reescrito: 10 pacientes de cáncer de mama (6 «Terapia oral» + 4 «Tratamiento activo»), 45 días, adherencia creíble, distrés variado, 2 discontinuaciones con motivo codificado, alertas en los CUATRO estados y las cerradas con disposición + desenlace. Patrocinador demo que financia ambos programas. **No rompe `seed_wp06_segundo_profesional.sql`** ni la estructura de usuarios.
- **WP-15 — Informe ROI pagador.** Vista imprimible por cohorte con urgencias evitadas/100 pacientes-mes (proxy honesto documentado), tiempo-hasta-escalado, tasa de respuesta al check-in y persistencia. Todas las cifras salen de datos ya capturados (sin ML, sin proyecciones); validador anti-cifras-inventadas reutilizado de WP-07. Vive en el área de patrocinador y respeta el k-anonimato.

---

## 2. Archivos

### Migraciones nuevas (RLS en la misma migración; ninguna commiteada editada)
- `supabase/migrations/0009_patrocinador.sql` — rol `patrocinador` en el check de `perfiles.rol`; tablas `patrocinadores` y `programas_patrocinados` (RLS); `perfiles.patrocinador_id`; helpers `es_patrocinador()` / `patrocinador_del_usuario()`; **redefine el trigger de alta** para admitir el rol; añade `pautas_medicacion.discontinuada_en` (PLAN §4.3, ver decisión 1). **Cero políticas de patrocinador sobre tablas de pacientes** (documentado en cabecera).
- `supabase/migrations/0010_patrocinador_rpc.sql` — 9 funciones RPC `security definer` con `set search_path = public`, guarda de rol y **k-anonimato ≥ 5** (`patro_resumen_cohorte`, `patro_persistencia`, `patro_meses_tratamiento`, `patro_adherencia_mensual`, `patro_motivos_discontinuacion`, `patro_tasa_checkin`, `patro_alertas_por_nivel`, `patro_tiempo_hasta_disposicion`, `patro_roi`) + `revoke execute ... from anon`.

### Módulos nuevos (`src/lib/patrocinador/`)
- `agregacion.ts` — **PURO**. Fuente única de la lógica de supresión k-anonimato en TS (`K_ANONIMATO = 5`): `resumenCohorte`, `curvaPersistencia`, `mesesTratamiento`, `adherenciaMensual`, `motivosDiscontinuacion`, `tasaCheckin`, `alertasPorNivel`, `tiempoHastaDisposicion`, `percentil`. Reutiliza `porcentajeAdherencia`/`redondear` de `@/lib/agregados`.
- `agregacion.test.ts` — **19 tests**: cohorte < 5 suprime TODOS los cortes; cohorte ≥ 5 devuelve; la cohorte demo por-programa omite «Tratamiento activo» (4 < 5).
- `roi.ts` — **PURO** (WP-15). `calcularRoi`, `cifrasPermitidasRoi`, `validarTextoRoi` (reutiliza `validarResumenSinCifrasInventadas` de WP-07). Proxy honesto de urgencias evitadas.
- `roi.test.ts` — **5 tests**: < 5 suprime; 4 urgencias evitadas en la demo; validador acepta cifras reales y **rechaza cifras inventadas**.
- `demo.ts` — **PURO**. Cohorte sintética (10 pacientes) determinista, alineada con `seed.sql`.
- `proveedor.ts` — tipos de vista compartidos + `agregadosDemo` (puro) y `agregadosSupabase` (RPC + Zod). No importa `next/headers`.
- `sesion-patrocinador.ts` — SERVER ONLY. Guard: solo rol patrocinador/admin.
- `cargar.ts` — SERVER ONLY. Elige demo vs Supabase.
- `src/lib/demo.ts` — `modoDemo()` + `MARCA_DEMO`.

### Área `(patrocinador)` y componentes
- `src/app/(patrocinador)/layout.tsx` — route guard (salvo demo) + marca de agua.
- `src/app/(patrocinador)/patrocinador/page.tsx` — dashboard.
- `src/app/(patrocinador)/patrocinador/roi/page.tsx` — informe ROI.
- `src/components/patrocinador/` — `MarcaDemo.tsx`, `TarjetaKpi.tsx`, `BarraExport.tsx`, `CohorteBloque.tsx` (reutiliza `GraficoBarras`), `RoiVista.tsx`.

### Modificados
- `src/types/db.ts` — rol `patrocinador`, `patrocinador_id`, tipos `Patrocinador`/`ProgramaPatrocinado` (+ inserts), `pautas_medicacion.discontinuada_en`, tablas en `BaseDatos`.
- `src/lib/auth/roles.ts` + `roles.test.ts` — `rutaPorRol('patrocinador') → /patrocinador`.
- `src/proxy.ts` — `/patrocinador` protegida; **bypass en modo demo**.
- `src/lib/seguridad/auditoria.test.ts` — **+8 tests** de privacidad del patrocinador (ver §5).
- `.env.example` — `DEMO_MODE`.

### Seed y tests SQL
- `supabase/seed.sql` — **reescrito** (cohorte oncológica; ver §1). Credenciales en la cabecera del archivo.
- `supabase/tests/acceso_cruzado.sql` — **+2 escenarios** (7: el patrocinador no lee ninguna tabla de pacientes; 8: las RPC omiten cortes < 5).

### Docs (única modificación de `docs/` permitida)
- `docs/wp/entregas/WP-17-entrega.md` (este archivo).
- `docs/DEMO-GUION.md` (guion de 10 minutos).

---

## 3. Decisiones propias (no explícitas en el WP) y discrepancias detectadas

1. **`pautas_medicacion.discontinuada_en` — DISCREPANCIA WP-11 vs PLAN §4.3.** El PLAN §4.3 pedía añadir `discontinuada_en date` junto a `motivo_discontinuacion`, pero la migración 0007 (WP-11 v2) **solo añadió `motivo_discontinuacion`**. La tarea de WP-17 dice literalmente "curva de persistencia (curva simple sobre `pautas_medicacion.discontinuada_en`)" — una columna que no existía. Se subsana de forma **aditiva** en 0009 (no edita migraciones commiteadas), honrando el PLAN. La persistencia trata `discontinuada_en NULL` como pauta aún vigente (conservador).
2. **k-anonimato: qué es un "corte".** Se aplica la interpretación estándar: se suprime todo GRUPO de pacientes definido por un cuasi-identificador con < 5 miembros (cohorte/programa). Los **conteos de atributos dentro de una cohorte ya k-segura** (motivos de discontinuación, alertas por nivel) sí se muestran, porque son atributos de eventos, no sub-cohortes reidentificables. Cada RPC gatea sobre el tamaño de su cohorte; `patro_adherencia_mensual` suprime además cada MES con < 5 pacientes. Documentado en el SQL y en `agregacion.ts`.
3. **Doble capa de supresión.** La lógica k≥5 se implementa DOS veces e independientemente: en SQL (RPC 0010, frontera real de producción) y en TS puro (`agregacion.ts`, consumido por el MODO DEMO). Ninguna confía en la otra. Los tests congelan ambas.
4. **Dos proveedores (demo/producción) con la MISMA forma.** El dashboard/ROI consumen `DatosDashboard`; `agregadosDemo` (puro, sin BD) y `agregadosSupabase` (RPC + validación Zod de la respuesta, que es entrada externa) producen esa forma. Permite la demo sin claves y producción con RLS.
5. **RPC acotadas al patrocinador que llama** (`patrocinador_del_usuario()`), no por parámetro de patrocinador: un patrocinador no puede pedir datos de una cohorte que no financia. Admin sin patrocinador asociado no obtiene filas por esta vía (usa el MODO DEMO o un login de patrocinador). `p_programa_id` opcional acota a un programa financiado; `null` = combinado.
6. **Proxy: bypass de `/patrocinador` en modo demo.** Detectado en la verificación: con un `.env.local` con claves, el proxy redirigía `/patrocinador` a `/login` pese a `DEMO_MODE`. Como la demo debe correr en local "sin claves de producción" (y aunque las haya), el proxy deja pasar `/patrocinador` cuando `modoDemo()`; el layout se salta el guard igual. La privacidad NO depende de esto (RLS 0009 + RPC 0010).
7. **`percentil` propio** (interpolación lineal, estilo `percentile_cont`) en TS para medianas/cuartiles del camino demo; el camino producción usa `percentile_cont` de Postgres.

---

## 4. Verificación (salida)

- **Migraciones** (libpg_query vía `pg-query-emscripten@5.1.0`, instancia fresca por archivo):
  ```
  OK 0001..0008 (como en WP-11)
  OK 0009_patrocinador.sql: 18 statements
  OK 0010_patrocinador_rpc.sql: 18 statements
  TODAS OK
  ```
  (También parsean `seed.sql`, `seed_wp06_segundo_profesional.sql` y `acceso_cruzado.sql`.)
- **`npm run lint`** → sin errores (exit 0).
- **`npm test`** → `Test Files 17 passed (17)` · `Tests 194 passed (194)` (161 previos intactos + 33 nuevos).
- **`npm run build`** → `✓ Compiled successfully`; 25 rutas, incluidas `/patrocinador` y `/patrocinador/roi`; el Proxy (middleware) compila.
- **Demo end-to-end** (`DEMO_MODE=true npx next dev`, sin sesión):
  - `GET /patrocinador` → **200**; renderiza dashboard, "Laboratorio Demo", marca "datos sintéticos", ambos programas, **"Datos insuficientes"** para «Tratamiento activo» (4 < 5), y las 4 gráficas.
  - `GET /patrocinador/roi` → **200**; "Urgencias evitadas", "Definiciones metodológicas", "proxy".
  - `GET /pacientes` → **307** (el guard del resto de áreas sigue intacto).

---

## 5. Demostraciones exigidas

**(a) Una RPC de agregado omite un corte con < 5 pacientes.**
- SQL: `patro_persistencia(<id de tratamiento_activo>)` devuelve **0 filas** (cohorte 4 < 5); `patro_resumen_cohorte(<id>)` devuelve `datos_insuficientes = true` y `n_pacientes = NULL` (no revela el conteo). Escenario 8 de `acceso_cruzado.sql`.
- TS/demo: `agregacion.test.ts` → "«Tratamiento activo» (4) => SE OMITE"; en vivo, el dashboard demo muestra la tarjeta "Datos insuficientes" para ese programa.

**(b) El rol patrocinador no puede leer ninguna tabla de pacientes.**
- Estructural: 0009 NO añade ninguna política de lectura de patrocinador; `es_admin()`/`es_profesional_de()`/`es_profesional_o_admin()` son false para él → `select * from pacientes` = 0 filas.
- Tests: `auditoria.test.ts` → "NINGUNA política de una tabla de pacientes menciona 'patrocinador'", "0009 SOLO crea políticas sobre las tablas del patrocinador", "las 9 RPC son security definer, con search_path y guarda de rol". En vivo: escenario 7 de `acceso_cruzado.sql` (0 filas en pacientes/observaciones/checkins/alertas/disposiciones/tomas/pautas/mensajes).

**(c) El informe ROI solo usa cifras reales.**
- `calcularRoi` produce cada cifra por una operación sobre los datos. `validarTextoRoi` (reutiliza el validador anti-alucinación de WP-07) acepta una narrativa con solo cifras reales y **rechaza** cualquier cifra inventada. `roi.test.ts` → "una cifra inventada es DETECTADA y rechazada" (el "73%" ficticio se detecta). El informe no usa LLM: las cifras vienen de `calcularRoi`; el validador es defensa en profundidad.

---

## 6. Dudas / riesgos

- **A. Camino de producción de las RPC no ejecutado en vivo** (no hay proyecto Supabase en el entorno, como en F1/WP-11). Las 9 funciones se validaron con el parser real y por revisión; `acceso_cruzado.sql` (escenarios 7-8) las ejercita cuando haya BD. El camino DEMO (idéntico en forma) SÍ está probado end-to-end y por 24 tests puros.
- **B. `discontinuada_en` vs `desactivada_en`.** Ahora conviven tres marcas de baja: `activa` (bool), `desactivada_en` (timestamptz, WP-10, baja genérica) y `discontinuada_en` (date, PLAN §4.3, discontinuación clínica). El código de la app que discontinúa una pauta (WP-11 `programa-acciones`/medicación) debería rellenar `discontinuada_en` además de `motivo_discontinuacion`; **no lo he tocado** (fuera del alcance de WP-17 y no debía editar su lógica). El seed sí rellena las tres coherentemente. Riesgo: hasta que el panel escriba `discontinuada_en`, la persistencia en producción se alimentará solo del seed / de datos que la rellenen. Anotado para el director.
- **C. Umbrales `[PENDIENTE CLÍNICO]` / `[PENDIENTE LEGAL]`** presentes en el proxy honesto del ROI y en los pies de los documentos del patrocinador. Sin lenguaje predictivo/diagnóstico en ninguna pantalla (revisado).
- **D. `patrocinadores` como organización con `perfiles.patrocinador_id`** (un usuario ↔ una organización). Suficiente para el piloto/demo; si se necesitan varios usuarios por patrocinador ya está soportado (varios perfiles con el mismo `patrocinador_id`).
- **E. `hashtext` en el seed** para generar historial determinista: es una función interna de Postgres estable; el historial es reproducible entre `db reset`.

### Fuera de alcance respetado
Termómetro NCCN (WP-16 — el ROI/dashboard no lo requieren; el distrés del seed va en `observaciones` ánimo/ansiedad/estrés, ya que `instrumentos_respuestas` es de WP-16 y no está migrada), farmacovigilancia (WP-18), pediatría/menores (WP-19 — no se introdujo nada que dirija texto a un menor), módulos aparcados. No se editó la lógica de check-in, escalado, disposiciones ni el panel profesional.
