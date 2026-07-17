# WP-23 — Consola de administración (instituciones, profesionales, membresías) · Entrega

**Estado:** implementado y verificado en verde (build + lint + 279 tests).
**Sin migración nueva:** el esquema 0016 (WP-22) ya lo soporta; no hizo falta crear 0019+.
**NO aplicado al Supabase vivo** (lo aplica/valida el director). **NO commit / NO push.**

---

## 1. Qué se hizo (por tarea del WP)

### Tarea 1 — Guard solo-admin (layout + cada Server Action)
- `src/lib/admin/sesion-admin.ts` (nuevo): `obtenerSesionAdmin()` — SERVER ONLY. A
  diferencia de `obtenerSesionPanel` (profesional **o** admin), exige **SOLO** `admin`;
  cualquier otro rol (paciente, profesional, patrocinador, sin sesión) → `null`. Nunca lanza.
- `src/app/(panel)/admin/layout.tsx` (nuevo): route guard que estrecha el guard del
  panel a admin. Un profesional que navegue a `/admin` recibe `redirect("/pacientes")`.
- El guard se repite en **cada** Server Action (Next 16: el proxy no protege por rol);
  test estático lo verifica (una comprobación admin por acción exportada).

### Tarea 2 — Instituciones (CRUD ligero + país del catálogo)
- `src/app/(panel)/admin/instituciones/page.tsx` + `acciones.ts` (nuevos):
  `crearInstitucion`, `editarInstitucion` (nombre/tipo/país), `cambiarEstadoInstitucion`
  (activar/desactivar), `crearPais` (alta simple del catálogo `paises`).
- UI: `src/components/admin/FormularioInstitucion.tsx` (alta + mini-alta de país) y
  `ListaInstituciones.tsx` (lista con país, nº de profesionales activos y nº de
  pacientes, badge activa/inactiva, edición en línea y toggle de estado).
- Escritura con el **cliente de servidor** (cookies): la RLS de 0016
  (`*_admin_todo` con `es_admin()`) hace el trabajo. **No se relajó ninguna política.**

### Tarea 3 — Profesionales (invitación por email, patrón WP-20)
- `src/lib/admin/invitacion.ts` (nuevo): **núcleo PURO y testeable** con puerto
  inyectable, calcado del enrolamiento de pacientes (`enrolamiento/nucleo`). Invita con
  `inviteUserByEmail` + `raw_user_meta_data {rol:'profesional', nombre}`. **Verificado el
  camino del trigger** `gestionar_nuevo_usuario` (0001): con rol `profesional` inserta
  SOLO el perfil, **sin** fila de `pacientes` (la rama `if v_rol = 'paciente'` no aplica).
- `src/app/(panel)/admin/profesionales/acciones.ts` → `invitarProfesional`: construye el
  puerto real (Auth Admin API con `crearClienteAdmin`, service-role) EXCLUSIVAMENTE para
  crear la cuenta; la auditoría se escribe como el admin (RLS append-only), no con service-role.
- Email ya existente → **no duplica** (mensaje distinto si ya es profesional).
- UI: `FormularioInvitarProfesional.tsx` + `ListaProfesionales.tsx`.

### Tarea 4 — Membresías profesional↔institución
- `asignarMembresia` (upsert `profesionales_instituciones`, reactiva si estaba retirada;
  exige que el destinatario sea profesional y la institución esté activa) y
  `retirarMembresia` (`activa=false`).
- **Aviso al retirar la última membresía activa** de un profesional con pacientes:
  lógica PURA en `avisoRetiroMembresia` (`src/lib/admin/esquemas.ts`) — si no quedan otras
  membresías activas y la institución tiene N pacientes, la acción devuelve
  `{ ok:false, error:<aviso>, confirmable:true }` y la UI pide **confirmación** antes de
  retirar ("dejará de ver a los N pacientes de X").

### Tarea 5 — Pacientes sin institución (cierra el riesgo de WP-22)
- `src/lib/admin/datos.ts` → `listarPacientesSinInstitucion()`: lee pacientes con
  `institucion_id is null` (RLS `pacientes_admin_todo`; el admin ve a los invisibles).
- `src/app/(panel)/admin/pacientes/page.tsx` + `acciones.ts` → `asignarInstitucionPaciente`
  (UPDATE `pacientes.institucion_id`, exige institución activa). UI:
  `PacientesSinInstitucion.tsx`.

### Tarea 6 — Server Actions (sesión admin + Zod + auditoría), sin service-role salvo invitación
- Todas las acciones: Zod estricto → `obtenerSesionAdmin` → escritura con el cliente de
  servidor (RLS admin) → `registrarAuditoria` → `revalidatePath`. El **único** uso de
  service-role es la invitación (Auth Admin API), como WP-20.
- Auditoría: `institucion_creada|editada|activada|desactivada`, `pais_creado`,
  `profesional_invitado`, `membresia_asignada|retirada`, `paciente_institucion_asignada`.
  (`paises` usa PK textual y `eventos_auditoria.entidad_id` es uuid → el código va en el
  `detalle` y `entidad_id` queda nulo.)

### Navegación
- `src/components/panel/NavLateral.tsx`: enlace **"Administración"** (icono escudo) añadido
  SOLO si `esAdmin`. `src/app/(panel)/layout.tsx` pasa `esAdmin={rol === "admin"}`.

---

## 2. Archivos

**Nuevos — lib:**
- `src/lib/admin/sesion-admin.ts` — guard solo-admin.
- `src/lib/admin/invitacion.ts` — núcleo puro de invitación de profesional (puerto inyectable).
- `src/lib/admin/esquemas.ts` — Zod estricto + `avisoRetiroMembresia` (puro).
- `src/lib/admin/tipos.ts` — tipos presentacionales + `AccionAdmin`.
- `src/lib/admin/datos.ts` — loaders SERVER ONLY (nunca lanzan).

**Nuevos — rutas / Server Actions:**
- `src/app/(panel)/admin/layout.tsx`, `page.tsx` (redirige a instituciones).
- `src/app/(panel)/admin/instituciones/page.tsx` · `acciones.ts` · `loading.tsx`.
- `src/app/(panel)/admin/profesionales/page.tsx` · `acciones.ts` · `loading.tsx`.
- `src/app/(panel)/admin/pacientes/page.tsx` · `acciones.ts` · `loading.tsx`.

**Nuevos — componentes (cliente):**
- `src/components/admin/TabsAdmin.tsx`, `FormularioInstitucion.tsx`, `ListaInstituciones.tsx`,
  `FormularioInvitarProfesional.tsx`, `ListaProfesionales.tsx`, `PacientesSinInstitucion.tsx`.

**Nuevos — tests:**
- `src/lib/admin/invitacion.test.ts` (7), `esquemas.test.ts` (14), `guard.test.ts` (11).

**Modificados:**
- `src/components/panel/NavLateral.tsx` — prop `esAdmin` + ítem "Administración".
- `src/app/(panel)/layout.tsx` — pasa `esAdmin`.

**NO se creó migración** (0016 ya soporta todo). **No se tocó `docs/`** salvo esta entrega.

---

## 3. Decisiones (que no estaban explícitas en el WP)

1. **Sin migración.** La RLS de 0016 ya da al admin CRUD de catálogo y membresías
   (`es_admin()`) y lectura de perfiles/pacientes (`*_admin_todo` de 0002). No se relajó nada.
2. **Invitación separada de la membresía** (dos pasos), como los pasos del propio WP: invitar
   → aparece en la lista → asignar membresía. Cada paso es idempotente y robusto por sí solo.
3. **Listado de profesionales sin email.** El email vive en `auth.users`, no en `perfiles`;
   mostrarlo exigiría service-role para LEER. Para respetar "sin service-role salvo la
   invitación", la lista muestra nombre + teléfono + membresías (no email).
4. **Asignación exige institución ACTIVA** (membresía y paciente-sin-institución): no se
   adscribe a una institución desactivada.
5. **`/admin` redirige a `/admin/instituciones`** (primera pestaña) para no dejar una ruta
   índice huérfana sin pestaña activa.
6. **Reutilización literal del patrón WP-20** (puerto + Auth Admin API + paginación de
   `listUsers` + `redirectTo` a `/restablecer`).

---

## 4. Dudas / riesgos

- **Verificación EN VIVO pendiente (director).** Los tests de guard son un guardarraíl
  ESTÁTICO (leen el código y congelan invariantes), no un test de RLS con BD. La garantía
  real de que un profesional no escriba catálogo/membresías la da la RLS de 0016; conviene
  reconfirmarla con `supabase/tests/acceso_cruzado.sql` tras aplicar (escenario admin).
- **Trigger para rol `profesional`.** Verificado por lectura de 0001; en vivo, confirmar que
  `inviteUserByEmail` con `{rol:'profesional'}` crea el perfil sin fila de paciente.
- **País "CO" del catálogo.** El seed de WP-22 incluye PE/CO/BR/ES. Si el entorno del director
  no lo tuviera, la mini-alta de país lo resuelve antes de crear la institución.
- **`revalidatePath('/pacientes')` no se dispara al retirar/asignar membresías** desde admin:
  la lista del profesional afectado se refresca en su próxima navegación (aceptable en piloto).

---

## 5. Salida literal de build / lint / test

### `npm run build`
```
✓ Compiled successfully in 31.3s
  Running TypeScript ...
  Finished TypeScript in 37.4s ...
✓ Generating static pages using 3 workers (30/30) in 2.4s
Route (app)
├ ƒ /admin
├ ƒ /admin/instituciones
├ ƒ /admin/pacientes
├ ƒ /admin/profesionales
...
```

### `npm run lint`
```
> botsy@0.1.0 lint
> eslint
```
(sin errores ni advertencias)

### `npm test`
```
 Test Files  26 passed (26)
      Tests  279 passed (279)
```
Baseline 247 (23 archivos) → **279 (26 archivos)**: +32 tests nuevos del admin
(invitación con mock del Admin API 7, esquemas + aviso de membresías 14, guard admin 11).

---

## 6. Demo documentada (criterio de aceptación)

Flujo "admin crea Clínica Nueva (CO) → invita profesional → membresía → el profesional puede
enrolar pacientes ahí", trazado sobre el código:

1. **Admin entra a `/admin`** → guard `obtenerSesionAdmin` (layout) → redirige a
   `/admin/instituciones`. Un profesional que intente `/admin` sale a `/pacientes`.
2. **Crea la institución.** En Instituciones, si "CO" no está en el catálogo, "Añadir país"
   (`crearPais {codigo:'CO', nombre:'Colombia'}`). Luego "Crear institución"
   (`crearInstitucion {nombre:'Clínica Nueva', tipo:'clinica', paisCodigo:'CO'}`) → INSERT en
   `instituciones` (RLS `instituciones_admin_todo`) + auditoría `institucion_creada`.
3. **Invita al profesional.** Pestaña Profesionales → "Enviar invitación"
   (`invitarProfesional {nombre, email}`) → `inviteUserByEmail` con
   `{rol:'profesional', nombre}` → el trigger crea SOLO el perfil (sin paciente) +
   auditoría `profesional_invitado`. El profesional aparece en la lista.
4. **Asigna la membresía.** En su tarjeta, "Asignar a institución" → Clínica Nueva
   (`asignarMembresia {profesionalId, institucionId}`) → upsert en
   `profesionales_instituciones` (`activa=true`) + auditoría `membresia_asignada`.
5. **El profesional ya puede enrolar ahí.** Al entrar a `/pacientes`,
   `listarInstitucionesDelProfesional` (rama profesional) devuelve sus membresías activas →
   Clínica Nueva aparece en el select del alta (WP-20). El paciente enrolado se adscribe a
   Clínica Nueva y pasa a ser visible para el equipo de esa institución (ADR-004).
6. **Cierre del riesgo WP-22.** Cualquier paciente con `institucion_id` NULL aparece en
   "Pacientes sin institución"; "Asignar" (`asignarInstitucionPaciente`) lo hace visible.

**Aviso de última membresía (Tarea 4):** al "Retirar" la única membresía activa de un
profesional cuya institución tiene pacientes, la acción responde con `confirmable:true` y la
UI muestra "…dejará de ver a los N pacientes de X. Confirma…"; sólo con "Confirmar retiro"
(`confirmar:true`) se ejecuta.
