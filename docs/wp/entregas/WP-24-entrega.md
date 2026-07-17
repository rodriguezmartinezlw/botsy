# WP-24 — Entrega: conversaciones a demanda + historial + micrófono en inicio

Implementador: agente WP-24. Fecha: 2026-07-18.

## Qué se hizo

Las cinco secciones (A–E) de `docs/wp/WP-24-consultas-a-demanda.md`, completas:

**A. Esquema (migración 0020).** `checkins.tipo text not null default 'checkin' check (tipo in ('checkin','consulta'))`. La restricción `unique (paciente_id, fecha)` de 0001 (nombre autogenerado `checkins_paciente_id_fecha_key`; era inline, línea 80 de 0001) se elimina con un bloque DO que la localiza **por sus columnas** en `pg_constraint` (robusto ante renombrados en la BD viva) y se sustituye por el índice único PARCIAL `checkins_checkin_diario_unico on (paciente_id, fecha) where tipo = 'checkin'`: un solo check-in estructurado al día, consultas ilimitadas. Índice de apoyo `idx_checkins_paciente_tipo_fecha` para el historial. RLS intacta (misma tabla; las políticas de 0002 filtran por `paciente_id`, no por tipo — la migración no crea ni toca ninguna política, y hay test que lo verifica). Tipos espejo en `src/types/db.ts` (`TipoCheckin`, `Checkin.tipo`, `CheckinInsert.tipo`).

**B. Motor de consultas.** `POST /api/checkin/iniciar` y `POST /api/voz/sesion` aceptan cuerpo opcional `{ tipo?: 'checkin'|'consulta' }` validado con Zod (`esquemaCuerpoIniciar`, default `checkin`; cuerpo ausente = comportamiento pre-WP-24). La decisión de inicio vive en un módulo puro compartido (`src/lib/ia/iniciar-sesion.ts`, `decidirInicioSesion`): con `consulta` SIEMPRE fila nueva (`tipo='consulta'`, `estado='en_curso'`), aunque el check-in de hoy esté completado o haya otras consultas; con `checkin` y el día completado, 409 con el mensaje exacto de la spec: *"Ya completaste tu check-in de hoy. Puedes abrir una conversación cuando quieras."*. Guion propio de consulta en `construirInstrucciones` (rama `contexto.tipo === 'consulta'`): escucha lo que la persona quiere contar AHORA, registra lo clínico con las MISMAS tools, evalúa señales de alarma igual que un check-in, NO recorre la checklist de dominios, y cierra con naturalidad cuando ella termina; las reglas clínicas innegociables van ÍNTEGRAS en ambos guiones (constante compartida `REGLAS_CLINICAS`, texto idéntico al previo — los tests existentes del guion siguen pasando sin cambios). Apertura determinista propia ("Te escucho: cuéntame qué necesitas, sin prisa."). `finalizarCheckin` (cierre compartido texto+voz): una consulta NO calcula ni escribe racha ni `ultimo_checkin` (ni toca `pacientes`), pero SÍ genera resumen (variante sin racha), lanza reconciliación y evalúa las reglas deterministas — una fiebre contada en consulta escala igual. El escalado EN VIVO (WP-04/08/10) funciona sin cambios porque las consultas usan los mismos endpoints (`/api/checkin/mensaje`, `/api/voz/tool`) y la misma materialización inmediata idempotente; verificado por test.

**C. UI de la paciente.**
- **Inicio**: bajo la racha, SIEMPRE los dos botones grandes "Hablar con Botsy" (micrófono) y "Escribir". Check-in pendiente → `/checkin/voz` y `/checkin`; hecho → `/checkin/voz?tipo=consulta` y `/checkin?tipo=consulta`, con el subtítulo "Cuéntame lo que necesites, a cualquier hora." y el estado "Check-in de hoy completado ✓ — puedo escucharte cuando quieras." (+ enlace secundario "Ver mi check-in de hoy").
- **/checkin con el día completado**: ya no bloquea — muestra el resumen de hoy + botón "Iniciar una conversación" (y "Prefiero hablar" a la consulta por voz). Con `?tipo=consulta` monta `ChatCheckin tipo="consulta"` (sin checklist de dominios, botón "Terminar la conversación", cierre sin racha ni confeti, titular "Gracias por contármelo"; `TarjetaContactar` y `PantallaUrgencia` intactas).
- **Voz**: `PantallaVoz` recibe `tipo`; la página lo resuelve server-side (`?tipo=consulta` o día completado → consulta, botón "Iniciar una conversación" en vez de bloquear). El audio de una consulta se sube a `{paciente}/{fecha}-{checkinId}.webm` para no pisar el del check-in (puede haber varias al día).
- **Historial**: nueva página `(paciente)/historial` (Server Component): lista cronológica de check-ins y consultas con fecha legible (date-fns, locale `es`), badge de tipo (Check-in/Conversación), canal (voz/texto), badge de riesgo calmado ("Señal: contactar con tu médico" — señal, no diagnóstico), resumen, y transcript completo expandible con `<details>` nativo (sin JS de cliente); paginada (10 por página, `?pagina=N`, contador "X de Y"). RLS `propio` de 0002 hace trivial la lectura (mismo patrón que la línea temporal del panel, versión paciente). **4º ítem en `NavInferior`**: Inicio, Check-in, Historial, Perfil (targets ≥44px: cada ítem ~60px de alto, ancho `flex-1`).

**D. Seed.** El generador de 45 días termina en **AYER** (`v_fecha := current_date - 1 - v_dias_atras`); `ultimo_checkin = current_date - 1`; la alerta "nueva" de María (fiebre) pasa de HOY a AYER (el día actual queda libre para la demo). Además, los 8 `ON CONFLICT (paciente_id, fecha)` del seed se reescriben como `ON CONFLICT (paciente_id, fecha) WHERE tipo = 'checkin'`: tras 0020 la constraint antigua no existe y la inferencia de índice parcial exige el predicado (sin este cambio el seed rompería tras la migración).

**E. Tests.** 24 tests nuevos en `src/lib/ia/consulta.test.ts` (todos los pedidos por la spec): índice parcial a nivel de SQL parseado + simulación semántica (2 consultas el mismo día OK; 2º check-in falla), RLS de 0020 no tocada, seed hasta ayer y ON CONFLICT parciales, guion consulta ≠ guion check-in (con reglas clínicas íntegras en ambos y sin termómetro en consulta), aperturas distintas, `decidirInicioSesion` (consulta con check-in completado → fila nueva; 2º check-in → 409 con mensaje claro), Zod del cuerpo, **consulta no altera racha** (con doble de Supabase: cierra la fila con resumen pero no hay UPDATE de `pacientes`; control: el check-in sí suma), resumen de consulta sin racha y con "señal ≠ diagnóstico", y **señal de alarma en consulta → riesgo `contactar` + escalado materializado in situ** (misma maquinaria `manejarToolVoz`). Los 280 base siguen en verde: **304 en total**.

## Archivos

**Creados**
- `supabase/migrations/0020_consultas_a_demanda.sql`
- `src/lib/ia/iniciar-sesion.ts` (decisión pura de inicio, compartida texto/voz)
- `src/app/(paciente)/historial/page.tsx`
- `src/lib/ia/consulta.test.ts`

**Modificados**
- `src/types/db.ts` — `TipoCheckin`, `Checkin.tipo`, `CheckinInsert.tipo`
- `src/lib/ia/schemas.ts` — `TIPOS_CHECKIN`, `esquemaCuerpoIniciar`
- `src/lib/ia/conversacion.ts` — `tipo` en `ContextoCheckin` y `construirContexto` (con filtro `tipo='checkin'` en la lectura del check-in de hoy), apertura de consulta, guion de consulta, `REGLAS_CLINICAS` compartidas, `construirResumen` sin racha para consultas
- `src/lib/ia/finalizar.ts` — `tipo` en `DatosCierre`; la consulta no calcula ni escribe racha
- `src/lib/ia/voz-tool.ts` — `CheckinVoz.tipo` (opcional, compatible), mensaje 409 por tipo
- `src/app/api/checkin/iniciar/route.ts` — cuerpo Zod, decisión compartida, fila nueva por consulta, errores claros
- `src/app/api/checkin/mensaje/route.ts` — guion por tipo, termómetro solo en check-in, 409 por tipo
- `src/app/api/voz/sesion/route.ts` — cuerpo Zod, decisión compartida, guion por tipo, tools sin termómetro en consulta, 409 claro
- `src/app/api/voz/tool/route.ts` — `tipo` en la carga, termómetro solo en check-in
- `src/components/paciente/NavInferior.tsx` — 4º ítem Historial
- `src/app/(paciente)/inicio/page.tsx` — 2 botones grandes siempre visibles + estado + enlaces a consulta + filtro tipo
- `src/app/(paciente)/checkin/page.tsx` — `?tipo=consulta`; día completado → resumen + "Iniciar una conversación"
- `src/app/(paciente)/checkin/ChatCheckin.tsx` — prop `tipo`; sin checklist en consulta; cierre adaptado
- `src/app/(paciente)/checkin/voz/page.tsx` — `?tipo=consulta` o día completado → consulta
- `src/app/(paciente)/checkin/voz/PantallaVoz.tsx` — prop `tipo`; cuerpo de sesión; ruta de audio por consulta; textos y cierre adaptados
- `supabase/seed.sql` — datos hasta AYER; `ON CONFLICT ... WHERE tipo='checkin'`; María a ayer
- `src/app/(auth)/restablecer/FormularioRestablecer.tsx` — **fuera del alcance WP-24** (ver desviaciones)

## Decisiones tomadas que no estaban en el WP

1. **DROP robusto de la UNIQUE por columnas, no por nombre.** El nombre esperado es `checkins_paciente_id_fecha_key` (constraint inline de 0001), pero el bloque DO la localiza en `pg_constraint` por `(fecha, paciente_id)`; si en la BD viva estuviera renombrada, la migración la elimina igual, y si no existe, no falla.
2. **Termómetro de Distrés (WP-16) NO se administra en consultas**: es parte del check-in estructurado. Ni el guion de consulta lo introduce, ni la tool se ofrece (texto y voz), ni el gating del route la acepta. La spec no lo decía explícitamente; me pareció la lectura coherente ("SIN checklist") y está testado.
3. **Filtro `tipo='checkin'` en TODAS las lecturas "check-in de hoy" con `maybeSingle()`** (inicio, /checkin, voz, iniciar, sesion, `construirContexto`): al convivir varias filas por fecha, sin el filtro `maybeSingle()` devolvería error y esas pantallas caerían a su estado por defecto. Era un bug latente implícito en el WP.
4. **Audio de consultas por voz** con `checkinId` en la ruta (`{paciente}/{fecha}-{id}.webm`) para no sobrescribir el audio del check-in ni el de otra consulta del mismo día (la subida usa `upsert`).
5. **Seed compatible con el índice parcial**: los `ON CONFLICT (paciente_id, fecha)` pasan a `... WHERE tipo = 'checkin'` (la inferencia de índices parciales lo exige; sin esto el seed rompería tras aplicar 0020).
6. **`/api/checkin/iniciar` con día completado y `tipo=checkin` ahora responde 409** (antes devolvía la fila completada y la UI mostraba "ya completado"). La UI ya no depende de ese caso: la página `/checkin` resuelve "completado" server-side y muestra el resumen; el 409 con mensaje claro queda para llamadas directas a la API, como pide la spec.
7. **Cierre de consulta en UI**: sin racha, sin confeti, titular "Gracias por contármelo" (la racha es el logro del check-in diario); resumen determinista de consulta cierra con "Aquí me tienes cuando me necesites.".
8. Las respuestas de `iniciar`, `voz/sesion` y `finalizar` incluyen `tipo` (la UI adapta pantallas; compatible con clientes que lo ignoren).
9. Índice `idx_checkins_paciente_tipo_fecha` de apoyo al historial paginado.

## Desviaciones

- **Fix de lint fuera del alcance**: `npm run lint` fallaba con 1 error PREEXISTENTE en `src/app/(auth)/restablecer/FormularioRestablecer.tsx` (`react-hooks/set-state-in-effect`: `setState` síncrono en el cuerpo del efecto) que no proviene de WP-24 (archivo no tocado por este WP). Como CLAUDE.md exige lint sin errores para entregar, apliqué el arreglo mínimo sin cambio de comportamiento: la creación del cliente se mueve dentro del IIFE async ya existente (los `setState` pasan a contexto asíncrono) y se retira la directiva `eslint-disable` que quedaba sin uso. Si el director prefiere tratarlo en otro WP, es un cambio autocontenido y fácil de revertir.

## Dudas y riesgos

- **Orden de despliegue**: aplicar 0020 ANTES de desplegar este código. El código selecciona/inserta la columna `tipo`; contra una BD sin 0020, los selects de `tipo` fallan (y las pantallas caen a estados por defecto). La migración NO se ha aplicado al Supabase vivo (la aplica el director), y el seed NO se ha ejecutado.
- **Panel profesional**: la línea temporal de la ficha (WP-06) lista todas las filas de `checkins`, así que las consultas aparecen — pero sin distinguir visualmente el tipo (no estaba en el alcance). Mejora natural para un WP de panel: badge "Conversación" también ahí.
- **Memoria del guion**: "Resumen del último check-in" en el contexto ahora puede ser el resumen de una consulta (se lee el último `completado` sin filtrar tipo). Lo considero deseable (memoria más fresca: si anoche contó fiebre en consulta, el check-in de hoy lo sabe); si el director prefiere solo check-ins, es un `.eq("tipo","checkin")` en `construirContexto`.
- `decidirInicioSesion` retoma un check-in `abandonado` (status quo previo); hoy nada produce ese estado.
- El seed corrige el generador para futuros resets; en la BD viva el director ya lo había corregido a mano (WP-24 origen), no hay que re-ejecutarlo.

## Verificación (salida literal)

`npm test`:

```
 Test Files  27 passed (27)
      Tests  304 passed (304)
   Start at  01:14:28
   Duration  31.95s (transform 1.81s, setup 0ms, collect 67.43s, tests 2.31s, environment 12ms, prepare 7.66s)
```

(280 base + 24 nuevos de WP-24 en `src/lib/ia/consulta.test.ts`.)

`npm run lint`:

```
> botsy@0.1.0 lint
> eslint

```

(Sin errores ni warnings.)

`npm run build`:

```
▲ Next.js 16.2.10 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 23.6s
  Running TypeScript ...
  Finished TypeScript in 18.9s ...
✓ Generating static pages using 3 workers (31/31) in 951ms

Route (app)
├ ƒ /api/checkin/iniciar
├ ƒ /api/voz/sesion
├ ƒ /checkin
├ ƒ /checkin/voz
├ ƒ /historial          ← nueva
├ ƒ /inicio
└ ... (resto sin cambios)
```

**Validación de la migración con libpg_query** (parser real de Postgres, paquete `pgsql-parser` en entorno aparte, sin tocar el proyecto):

```
OK  supabase/migrations/0020_consultas_a_demanda.sql — 4 sentencias parseadas
OK  supabase/seed.sql — 16 sentencias parseadas
```

## Demo documentada (guion + respaldo)

Flujo pedido: *check-in de hoy completado → botón "Hablar" abre consulta → paciente cuenta fiebre → escalado y alerta*. No se ha ejecutado contra el Supabase vivo (0020 sin aplicar — la aplica el director); cada eslabón queda demostrado por test y el guion es reproducible en producción tras aplicar la migración:

1. **María** (`maria@botsy.local` / `Botsy1234!`) completa su check-in de hoy (los datos del seed terminan AYER: el día queda libre).
2. **/inicio** muestra "Check-in de hoy completado ✓ — puedo escucharte cuando quieras.", el subtítulo "Cuéntame lo que necesites, a cualquier hora." y los dos botones grandes. "Hablar con Botsy" → `/checkin/voz?tipo=consulta` (micrófono desde inicio).
3. La pantalla de voz ofrece "Iniciar una conversación"; `POST /api/voz/sesion {tipo:'consulta'}` **crea una fila nueva** `tipo='consulta'` aunque el check-in esté completado. *Respaldo:* tests "consulta con el check-in de hoy COMPLETADO → crea fila nueva" y "2º checkin → 409 con mensaje claro"; semántica del índice parcial (2 consultas mismo día OK).
4. La paciente dice "tengo 38.2 de fiebre". El modelo (guion de consulta: registra y evalúa señales, testado) llama `registrar_observacion` + `senal_alarma` → `POST /api/voz/tool` → riesgo sube a `contactar` y la **alerta al profesional se materializa in situ**, sin esperar al cierre. *Respaldo:* test "una fiebre contada en consulta eleva el riesgo y materializa la alerta YA" (misma maquinaria idempotente que el check-in, mismos endpoints).
5. En vivo aparece el aviso calmado de señal y, al colgar, el cierre muestra la **TarjetaContactar** con el teléfono del médico (urgencia → `PantallaUrgencia`), componentes idénticos a los del check-in. El cierre genera resumen + reconciliación + evaluación de reglas, **sin tocar la racha**. *Respaldo:* tests de `finalizarCheckin` (consulta no altera racha; control con check-in que sí suma) y del resumen ("señal detectada ≠ diagnóstico").
6. **/historial** lista el check-in y la consulta del día: badges de tipo y canal, "Señal: contactar con tu médico", resumen y transcript completo al expandir; paginado. El profesional ve la alerta nueva en su bandeja (flujo WP-07/WP-11 sin cambios).
