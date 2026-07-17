# Revisión WP-20 — UX y usabilidad

**Fecha:** 2026-07-17 · **Revisor:** Fable/Opus (auto-revisión) · **Veredicto:** ✅ Aprobado sin cambios de código.

## Verificación independiente

- `npx vitest run` → **243/243** (216 previos intactos + 27 nuevos). `npm run lint` → exit 0. `npm run build` → exit 0 (26 páginas, incl. `/recuperar` y `/restablecer`).
- `grep any` en enrolamiento/recuperar/restablecer/perfil → limpio. `auditoria.test.ts` (secretos/service-role) sigue en verde dentro de los 243.

## Verificado a mano — seguridad del enrolamiento (§A, lo crítico)

`src/lib/enrolamiento/nucleo.ts` (núcleo puro, testeado) + `src/app/(panel)/pacientes/acciones.ts`:
- **Sesión → admin:** la Server Action valida Zod, comprueba `obtenerSesionPanel` (profesional/admin) y SOLO entonces usa el cliente admin, exclusivamente para el bootstrap (crear usuario + fijar `profesional_id` en un huérfano que la RLS del profesional aún no puede escribir). La auditoría se escribe como el profesional. Uso previsto de `crearClienteAdmin`, confinado.
- **Anti-robo de pacientes (líneas 153-161):** si el email existe y el paciente ya tiene un `profesional_id` distinto del actual → RECHAZA ("ya está vinculado a otro profesional"). Solo vincula huérfanos o los propios. Cuenta que no es de paciente → rechazada. **Correcto.**
- **No duplica:** email existente sin `vincularExistente` → devuelve `emailExiste` para que la UI ofrezca "Vincular", no crea otra cuenta.
- Invitación por `inviteUserByEmail` (mailer de Supabase, sin Resend); el trigger de WP-01 crea perfil+paciente; se materializan las reglas del programa vía `asignarProgramaAPaciente`.

## Verificado — recuperación (§B) y perfil (§C)

- **§B:** `/login`→`/recuperar` (`resetPasswordForEmail`)→`/restablecer` (`updateUser`), cubre los 3 formatos de enlace de Supabase; mensaje neutro que no revela si el email existe.
- **§C:** `(paciente)/perfil` edita SOLO nombre/teléfono/hora_checkin/zona_horaria (esquema `.strict()`), `.eq("id", user.id)` (solo su propio registro); vertical/condiciones/programa/pautas intactos. Enlace a consentimientos y cerrar sesión visibles.

## Decisiones del agente — aprobadas

- **Iconos PWA** SVG de marca → PNG con `sharp` (192/512/180/48). Correcto (WP-00 tenía placeholders).
- **`loading.tsx`** con skeletons en 7 páginas de datos; `motion-reduce` en la onda de voz; "Soy patrocinador" en la landing.
- **Sin migración:** correcto — el esquema ya tiene `profesional_id`/`hora_checkin`/`zona_horaria` y la RLS ya cubre la autoedición y la visibilidad enrolado↔profesional.
- **"Pautas iniciales" fuera del formulario de alta:** aceptable (el WP las marca opcionales; ya se gestionan desde la ficha).

## Pendiente de config (no de código) para que funcione en vivo

- **Supabase Auth → Redirect URLs:** añadir `${APP_URL}/restablecer` a la allow-list del proyecto para que el enlace de invitación y de recuperación funcione (local: `http://localhost:3000/restablecer`). El director puede fijarlo por Management API.
- **E2E real de invitación** no se ejecutó (crearía usuarios/enviaría correos reales); cubierto por tests con mock del Admin API + revisión de código. QA visual en dispositivo real, pendiente del director.

## Estado del piloto

Con WP-20, la app es usable de punta a punta: una paciente se enrola desde el panel (con su programa y reglas), recibe invitación, crea/recupera contraseña, edita sus datos y hace su check-in. Quedan WP-18 (farmacovigilancia, puerta LOI) y WP-19 (pediátrico, puerta asociación) + deploy.
