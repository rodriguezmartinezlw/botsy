# WP-20 — UX y usabilidad: enrolamiento, cuenta y pulido — ENTREGA

**Estado:** completo (bloques A–E). **Build / lint / test: verdes.** 243 tests
(216 previos + 27 nuevos). **No se hizo commit ni push.** No se tocó `docs/`
salvo este archivo.

---

## 1. Resumen

Se implementan los cinco bloques del WP-20:

- **A. Enrolamiento desde el panel (crítico):** botón "Nuevo paciente" en
  `(panel)/pacientes` → Server Action con `obtenerSesionPanel` + Zod + auditoría
  que crea la cuenta con la **Auth Admin API** (`inviteUserByEmail`, mailer
  integrado de Supabase, sin Resend), asigna `profesional_id` = el profesional
  actual y el programa elegido (reutilizando `sincronizarReglasPrograma`).
  Email ya existente → se ofrece **vincular** en vez de duplicar. Banner de
  **paciente huérfano** en `(paciente)/inicio`.
- **B. Recuperación de contraseña (crítico):** `/login` → `(auth)/recuperar`
  (`resetPasswordForEmail`) → `(auth)/restablecer` (`updateUser`). Mensaje neutro
  que no revela si el email existe. Mailer de Supabase.
- **C. Cuenta del paciente:** `(paciente)/perfil` con sección "Mis datos"
  editable (nombre, teléfono, hora de check-in, zona horaria) vía Server Action
  con sesión + Zod (solo campos NO clínicos), enlace a "Mis consentimientos" y
  botón de cerrar sesión.
- **D. Pulido:** iconos PWA reales de marca (SVG + PNG 192/512 + favicon),
  `loading.tsx` con skeletons en las páginas de datos del panel y patrocinador,
  acceso "Soy patrocinador" en la landing, microcopy.
- **E. Accesibilidad:** teclado en el chat ya soportado (Enter para enviar; foco
  visible global), `prefers-reduced-motion` respetado en la onda de la pantalla
  de voz.

## 2. Migración: NO fue necesaria

El esquema vivo ya tiene todo lo que WP-20 requiere:
`pacientes.profesional_id`, `pacientes.hora_checkin`, `perfiles.zona_horaria`,
`perfiles.telefono`. Y la RLS de WP-01 ya permite lo necesario:

- `perfiles_update_propio` y `pacientes_update_propio` → el paciente edita su
  propia fila (nombre/teléfono/zona en `perfiles`; hora_checkin en `pacientes`).
- `pacientes_select_propio` + `pacientes_select_profesional` → el paciente
  enrolado ve lo suyo y el profesional lo ve en su lista.

Por tanto **no se creó la migración 0014** (la siguiente sigue disponible para
quien la necesite). El único punto que la RLS NO cubre por diseño es fijar
`profesional_id` en un paciente que **aún no es "suyo"** (huérfano): esa escritura
de *bootstrap* del alta se hace con el cliente admin (ver §5, decisión 1).

## 3. Bloques, en detalle

### A. Enrolamiento (`§A` del WP)

Flujo: `FormularioNuevoPaciente` (cliente) → Server Action `enrolarPaciente`
(`src/app/(panel)/pacientes/acciones.ts`) → núcleo puro `enrolarPaciente`
(`src/lib/enrolamiento/nucleo.ts`) sobre un **puerto** inyectable.

1. Zod (`esquemaEnrolamiento`, `.strict()`) valida nombre, email, teléfono,
   fecha de nacimiento y programa.
2. Sesión de profesional/admin (`obtenerSesionPanel`).
3. Si el email **no existe**: `inviteUserByEmail(email, { data: {rol:'paciente',
   nombre}, redirectTo })` → el trigger `on_auth_user_created` crea perfil +
   paciente → se fija `profesional_id` (+ fecha/teléfono) → se asigna el programa
   con `asignarProgramaAPaciente` (que llama a `sincronizarReglasPrograma`) →
   auditoría `paciente_enrolado`.
4. Si el email **existe**: no se duplica; se devuelve `emailExiste: true` y la UI
   muestra un botón **"Vincular a este paciente"** que reenvía con
   `vincularExistente: true`. La vinculación solo procede si el paciente está
   **huérfano** o ya es de este profesional; nunca roba pacientes de otro
   profesional ni vincula cuentas que no son de paciente. Auditoría
   `paciente_vinculado`.
5. Banner de huérfano: `(paciente)/inicio` muestra, si `profesional_id` es null,
   "Tu equipo de salud aún no te ha vinculado. Dales este correo: <su email>".

### B. Recuperación de contraseña (`§B`)

- `(auth)/recuperar` + `FormularioRecuperar`: `resetPasswordForEmail(email,
  { redirectTo: `${origin}/restablecer` })`. Muestra SIEMPRE el mensaje neutro
  `MENSAJE_NEUTRO_RECUPERACION` (no revela si el correo existe).
- `(auth)/restablecer` + `FormularioRestablecer`: crea la sesión del enlace y
  llama a `updateUser({ password })`, luego redirige por rol. Soporta los tres
  formatos de enlace de Supabase de forma defensiva: `token_hash`+`type`
  (`verifyOtp`), `code` PKCE (`exchangeCodeForSession`) y token en el hash
  (`#access_token`, procesado al crear el cliente). Si el enlace no es válido/ha
  caducado, ofrece pedir uno nuevo.
- Enlace "¿Olvidaste tu contraseña?" añadido en `/login`.

### C. Cuenta del paciente (`§C`)

- `(paciente)/perfil` carga los campos editables y renderiza
  `FormularioMisDatos` (nombre, teléfono, **hora del recordatorio**, **zona
  horaria** de LatAm/España).
- Server Action `actualizarMisDatos` (`(paciente)/perfil/acciones.ts`): Zod
  `.strict()` (rechaza cualquier campo clínico) → sesión propia → UPDATE de la
  propia fila en `perfiles` y `pacientes` con el cliente de SERVIDOR (RLS
  `..._update_propio`, nunca service-role) → auditoría → revalida.
- Enlace visible a "Mis consentimientos" y botón "Cerrar sesión"
  (`BotonCerrarSesion`) en el perfil.

### D. Pulido (`§D`)

- **Iconos:** `public/icon.svg` (burbuja de conversación + corazón, azul
  `#2563EB`) rasterizado con `sharp` a `icon-192.png`, `icon-512.png` y
  `apple-icon.png` (180). `public/favicon.svg` (corazón sobre cuadro azul) +
  `favicon-48.png`. `manifest.webmanifest` y `layout.tsx` actualizados; se
  eliminó el placeholder `src/app/favicon.ico`.
- **Estados de carga:** `SkeletonPagina` (`src/components/ui/Skeleton.tsx`, con
  `motion-reduce:animate-none`) y `loading.tsx` en `pacientes`, `pacientes/[id]`,
  `pacientes/[id]/informe`, `alertas`, `desenlaces`, `patrocinador` y
  `patrocinador/roi`.
- **Landing:** enlace discreto "Soy patrocinador" → `/login?rol=patrocinador`; el
  login ahora adapta título/subtítulo también para el rol patrocinador.
- **Microcopy:** primera mención del check-in en el inicio explicada ("tu
  conversación diaria conmigo").

### E. Accesibilidad (`§E`)

- Chat: el envío con Enter (sin Shift) y el foco visible global ya existían
  (`ChatCheckin`, `globals.css :focus-visible`). Verificado, sin regresión.
- Voz: la onda pulsante (`animate-pulse`) ahora lleva `motion-reduce:animate-none`
  en `PantallaVoz`; el confeti ya respetaba `prefers-reduced-motion` en
  `globals.css`.

## 4. Archivos

**Creados:**
- `src/lib/programas/asignacion.ts` — `sincronizarReglasPrograma` (extraída) +
  `asignarProgramaAPaciente` (reutilizable en el alta).
- `src/lib/enrolamiento/nucleo.ts` — núcleo puro + Zod + puerto del enrolamiento.
- `src/lib/enrolamiento/nucleo.test.ts` — tests A (mock del Admin API + RLS).
- `src/lib/auth/recuperacion.ts` + `.test.ts` — helpers puros B.
- `src/lib/perfil/zonas.ts` — catálogo de zonas horarias.
- `src/lib/perfil/datos-perfil.ts` + `.test.ts` — esquema C.
- `src/app/(panel)/pacientes/acciones.ts` — Server Action de enrolamiento.
- `src/app/(paciente)/perfil/acciones.ts` — Server Action "Mis datos".
- `src/app/(auth)/recuperar/{page.tsx,FormularioRecuperar.tsx}`.
- `src/app/(auth)/restablecer/{page.tsx,FormularioRestablecer.tsx}`.
- `src/components/panel/FormularioNuevoPaciente.tsx`.
- `src/components/paciente/perfil/{FormularioMisDatos.tsx,BotonCerrarSesion.tsx}`.
- `src/components/ui/Skeleton.tsx`.
- `src/app/**/loading.tsx` (7 archivos: pacientes, ficha, informe, alertas,
  desenlaces, patrocinador, roi).
- `public/{icon.svg,favicon.svg,apple-icon.png,favicon-48.png}` (+ `icon-192.png`
  e `icon-512.png` regenerados).

**Modificados:**
- `src/app/(panel)/pacientes/[id]/programa-acciones.ts` — reutiliza
  `sincronizarReglasPrograma` del módulo compartido (sin duplicar lógica).
- `src/lib/panel/datos.ts` — `listarProgramasActivos()`.
- `src/app/(panel)/pacientes/page.tsx` — botón/formulario de alta.
- `src/app/(paciente)/inicio/page.tsx` — banner de huérfano + microcopy.
- `src/app/(paciente)/perfil/page.tsx` — sección "Mis datos" + enlaces + logout.
- `src/app/(auth)/login/page.tsx` — enlace de recuperación + rol patrocinador.
- `src/app/page.tsx` — "Soy patrocinador".
- `src/app/layout.tsx` + `public/manifest.webmanifest` — iconos.
- `src/app/(paciente)/checkin/voz/PantallaVoz.tsx` — `motion-reduce`.
- `.env.example` — nota sobre `APP_URL`/redirect de invitación.

**Eliminado:** `src/app/favicon.ico` (placeholder de WP-00).

## 5. Decisiones fuera del WP (o que lo matizan)

1. **Cliente admin solo para el *bootstrap* del alta.** Crear el usuario
   (Auth Admin API) y fijar `profesional_id` en un paciente que aún no es "suyo"
   NO lo puede hacer el profesional por RLS (su política exige que ya sea su
   paciente). Es el uso previsto de `crearClienteAdmin` ("tareas de servidor de
   confianza"). Las lecturas de datos de pacientes siguen sin usar service-role;
   la auditoría se escribe como el profesional (RLS append-only). No aparece
   ninguna literal `service_role`/`SERVICE_ROLE` fuera de `admin.ts` (verificado
   por `auditoria.test.ts`).
2. **`sincronizarReglasPrograma` extraída a `src/lib/programas/asignacion.ts`**
   para que la compartan la ficha y el alta (el WP pedía "reutilizarla"). Se
   mantiene la deduplicación por `nombre` de la versión original; comportamiento
   idéntico.
3. **Pautas iniciales NO en el formulario de alta.** El WP las lista como
   "opcionales". Se dejan fuera del alta porque la gestión de medicación ya existe
   completa en la ficha (`PanelMedicacion`), y meterla en el alta duplicaría esa
   superficie. El profesional añade pautas desde la ficha tras el alta. Anotado
   como matiz, no como recorte de un requisito duro.
4. **`/restablecer` cubre 3 formatos de enlace** (token_hash / PKCE / hash) para
   ser robusto ante la configuración del proyecto Supabase, que es del director.
5. **Iconos:** SVG de marca + rasterizado PNG con `sharp` (192/512/180/48). Es
   "versión digna", no branding final (dentro de lo que el WP pide en D.1 y de lo
   que declara fuera de alcance).

## 6. Dudas / riesgos (para el director)

- **Config de Supabase Auth (invitación):** el correo de invitación usa la
  plantilla y las "Redirect URLs" del proyecto. Para el flujo A completo hay que:
  (a) tener el mailer de Supabase operativo, y (b) **añadir `${APP_URL}/restablecer`
  a las Redirect URLs permitidas** (Auth → URL Configuration). Con `APP_URL`
  vacío, `redirectTo` se omite y Supabase usa su Site URL.
- **PKCE entre navegadores:** un enlace de recuperación abierto en un navegador
  distinto al que lo pidió no tiene el *code verifier* → `/restablecer` lo trata
  como enlace inválido y ofrece pedir uno nuevo. El formato `token_hash` (default
  de muchas plantillas) no tiene esa limitación.
- **`buscarUsuarioPorEmail` pagina el listado de usuarios** (la Auth Admin API no
  filtra por email). Con cota de 20 páginas × 200 = 4.000 usuarios; sobra para el
  piloto. Si el proyecto creciera, convendría un índice/consulta directa.
- **QA visual en dispositivo (D.3):** no se pudo ejecutar headless; el layout se
  revisó en código (formularios en `flex-col`, email con `break-all`, targets
  grandes, ≥16px). **Pendiente de QA en móvil 360–414px por el director**, según
  la nota de la tarea.

## 7. Reglas de oro / clínicas

- Ningún texto nuevo diagnostica, predice ni sugiere terapia. El banner de
  huérfano, los mensajes de recuperación y el microcopy son neutros y calmados.
- El paciente **solo** edita campos NO clínicos; el esquema `.strict()` de "Mis
  datos" rechaza `vertical`/`condiciones`/`programa`/`pautas` (test dedicado), y
  la RLS `..._update_propio` lo refuerza a nivel de fila.
- El enrolamiento respeta el modelo PSP: es el programa quien enrola (se asigna
  profesional + programa + reglas materializadas).

## 8. Salida literal de verificación

### `npm test`
```
 Test Files  23 passed (23)
      Tests  243 passed (243)
```
(216 previos intactos + 27 nuevos: `enrolamiento/nucleo.test.ts` 13,
`auth/recuperacion.test.ts` 6, `perfil/datos-perfil.test.ts` 8.)

### `npm run lint`
```
> botsy@0.1.0 lint
> eslint
(sin errores ni warnings)
```

### `npm run build`
```
▲ Next.js 16.2.10 (Turbopack)
✓ Compiled successfully in 51s
  Running TypeScript ...
  Finished TypeScript in 45s ...
✓ Generating static pages using 3 workers (26/26)
Route (app)
 ...
 ○ /recuperar
 ○ /registro
 └ ○ /restablecer
```

## 9. Demostraciones

### A. Enrolamiento E2E (con mock del Auth Admin API)

`src/lib/enrolamiento/nucleo.test.ts` ejercita el flujo completo contra un puerto
falso que simula el Admin API:

- **Alta nueva:** `buscarUsuarioPorEmail`→null → `invitar` (registra el email) →
  `vincularProfesional(nuevo-user, prof-1)` → `asignarPrograma(nuevo-user,
  mama_terapia_oral)` → auditoría `paciente_enrolado`. (`estado: "invitado"`.)
- **Email existente sin confirmar:** devuelve `emailExiste: true` y NO invita.
- **Vincular huérfano:** `profesional_id`=null → asigna profesional + programa;
  auditoría `paciente_vinculado`. (`estado: "vinculado"`.)
- **No roba pacientes de otro profesional** / **no vincula no-pacientes** →
  error, sin escrituras.
- **RLS:** se comprueba que 0002 tiene `pacientes_select_propio`,
  `pacientes_select_profesional` y `es_profesional_de` (el enrolado ve lo suyo; el
  profesional lo ve en su lista).

Contra la BD viva, el mismo camino corre con: cliente admin →
`inviteUserByEmail` (email real del mailer de Supabase) → el enlace lleva a
`/restablecer` → el paciente crea su contraseña → interstitial de consentimiento
(WP-07) → primer check-in → aparece en la lista del profesional con su programa y
reglas. Requiere las claves y la config de Redirect URLs del §6.

### B. Recuperación de contraseña

`src/lib/auth/recuperacion.test.ts`: el mensaje neutro no revela existencia del
correo; la contraseña se valida (longitud ≥ 8 y coincidencia); la URL de
redirección se construye a `${origin}/restablecer`. En vivo: `/login` →
"¿Olvidaste tu contraseña?" → `/recuperar` (email) → correo de Supabase →
`/restablecer` (nueva contraseña) → login por rol.

### C. Edición de perfil

`src/lib/perfil/datos-perfil.test.ts`: el esquema acepta nombre/teléfono/hora/zona
válidos; rechaza hora mal formada, zona fuera del catálogo y **cualquier campo
clínico** (`vertical`, `condiciones`, `programaClave`, `hora_checkin`), demostrando
que el paciente solo puede editar lo suyo y solo lo no clínico. En vivo:
`(paciente)/perfil` → "Mis datos" → guardar → `actualizarMisDatos` actualiza
`perfiles`+`pacientes` de la propia fila (RLS) y audita.

## 10. Errores detectados en el WP / PLAN

- **WP-20 §A.1** lista "pautas iniciales opcionales" en el formulario de alta; se
  dejó fuera a propósito (ver §5.3). No es un error del WP, es un matiz de
  implementación que conviene confirmar con el director.
- No se detectaron errores en el PLAN.
