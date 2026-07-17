# WP-20 — UX y usabilidad: enrolamiento, cuenta y pulido

**Origen:** auditoría UX del director (2026-07-17) sobre la app corriendo en demo + revisión de código. **Sin puerta clínica: programable YA.** Es el WP de mayor impacto en la experiencia del piloto — sin el ítem A, el piloto no puede enrolar pacientes de forma realista.

**Contexto de usuario:** pacientes oncológicas de 45–75 años, en tratamiento, a menudo con fatiga; profesionales con poco tiempo; la primera impresión de farma es la demo. La app ya cumple: fuentes ≥16px, targets ≥44px, contraste AA, estados vacíos, tono cálido (WP-08). Lo que falta es lo de abajo.

## A. Enrolamiento de pacientes desde el panel (CRÍTICO — el onboarding del PSP)

**Problema encontrado:** no existe forma de dar de alta a un paciente desde el panel. Un paciente que se auto-registra queda huérfano (`profesional_id` null, sin programa): no aparece en la lista del profesional y su check-in no escala a nadie. En el modelo PSP (MEMORIA §7) es el PROGRAMA quien enrola.

1. Panel → Pacientes → botón "Nuevo paciente": formulario (nombre, email, teléfono, fecha de nacimiento, programa a asignar, pautas iniciales opcionales). Server Action con `obtenerSesionPanel` + Zod + auditoría.
2. Alta técnica: crear el usuario vía **Auth Admin API** (`inviteUserByEmail` de Supabase — envía email de invitación con enlace para establecer contraseña; usa el mailer integrado de Supabase, NO requiere Resend) con `raw_user_meta_data` rol=paciente y nombre → el trigger de WP-01 crea perfil+paciente → asignar `profesional_id` = el profesional actual y el programa elegido (reutilizando `sincronizarReglasPrograma`).
3. Primer acceso del paciente: establecer contraseña → interstitial de consentimiento (ya existe, WP-07) → su primer check-in.
4. **Paciente huérfano** (se auto-registró): en `(paciente)/inicio`, si no tiene `profesional_id`, banner claro: "Tu equipo de salud aún no te ha vinculado. Dales este correo: <su email>". En el panel, "Nuevo paciente" detecta email ya existente y ofrece **vincular** (asignar profesional+programa al paciente existente) en vez de duplicar.
5. Tests: alta E2E con mock del Admin API; vinculación de huérfano; RLS (el paciente recién enrolado ve lo suyo; el profesional lo ve en su lista).

## B. Recuperación de contraseña (CRÍTICO)

**Problema:** no existe. Una paciente que olvide su contraseña queda fuera para siempre (población 45–75 años: pasará).

1. `/login` → enlace "¿Olvidaste tu contraseña?" → página `(auth)/recuperar` (email → `supabase.auth.resetPasswordForEmail` con `redirectTo` a `(auth)/restablecer`). Mailer integrado de Supabase (sin Resend).
2. `(auth)/restablecer`: establece la contraseña nueva (`auth.updateUser`) con sesión del enlace; mensajes amables; redirección por rol.
3. Textos en español, tono calmado; sin revelar si el email existe ("Si tu correo está registrado, te llegará un enlace").

## C. Cuenta del paciente: perfil editable y ajustes

**Problema:** el paciente no puede editar NADA (ni nombre, ni teléfono, ni hora del recordatorio) y `consentimientos` no está enlazado desde su navegación habitual.

1. `(paciente)/perfil` → sección "Mis datos": editar nombre, teléfono, **hora del recordatorio de check-in** (`pacientes.hora_checkin`) y zona horaria (select con las comunes de LatAm/España). Server Action con sesión + Zod (el paciente solo edita SUS campos no clínicos; vertical/condiciones/programa siguen siendo del profesional).
2. Enlace visible a "Mis consentimientos" desde el perfil (hoy solo se llega por URL o interstitial).
3. Cerrar sesión visible en el perfil (verificar que existe; si no, añadir).

## D. Pulido visual y de confianza (antes de la primera demo presencial)

1. **Iconos PWA reales** (los actuales son placeholders de WP-00): icono Botsy 192/512 + favicon coherentes (puede generarse SVG simple de marca: burbuja de conversación + cruz/corazón, azul #2563EB).
2. **Estados de carga**: skeletons o spinners en las páginas de datos del panel y del patrocinador (hoy SSR puro: en conexiones lentas parece congelado al navegar). Suave: `loading.tsx` por segmento con skeleton simple.
3. **Revisión visual en dispositivo real** (WP-09 no pudo hacer QA visual headless): checklist manual en móvil 360–414px (login, inicio, chat, voz, perfil, cierre de check-in) y escritorio (panel, patrocinador, informes, impresión). Corregir cualquier desbordamiento/solape encontrado y documentar con capturas en la entrega.
4. Landing: añadir acceso discreto "Soy patrocinador" → `/login` (hoy solo paciente/profesional).
5. Microcopy: revisar que ningún texto visible diga "check-in" sin explicación la primera vez ("tu conversación diaria"); consistencia de "Botsy te escucha".

## E. Accesibilidad (verificación final)

1. Auditoría axe/lighthouse local (dev): resolver violaciones AA que aparezcan.
2. Navegación completa por teclado del flujo de chat (enviar con Enter, foco visible).
3. `prefers-reduced-motion` respetado también en la pantalla de voz (onda animada).

## Fuera de alcance

Modo oscuro, i18n PT/EN, push nativas, rediseño de marca completo (los iconos del ítem D.1 son versión digna, no branding final).

## Criterios de aceptación

- Build/lint/test verdes (no romper los 216; añadir tests de A, B y C — mocks del Auth Admin API donde haga falta).
- Flujo A demostrado E2E contra la BD viva: el profesional invita → email llega (o se documenta el enlace generado) → paciente establece contraseña → consentimiento → check-in → aparece en la lista del profesional con su programa y reglas materializadas.
- Flujo B demostrado: recuperar → email → restablecer → login.
- Checklist visual de D.3 en la entrega con hallazgos corregidos.
- Cero textos que rompan las reglas de oro (no diagnostica, no predice).
