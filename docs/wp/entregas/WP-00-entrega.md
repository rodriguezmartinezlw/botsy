# Entrega WP-00 — Scaffolding Next.js + estructura + PWA base

**Fecha:** 2026-07-15 · **Implementador:** Opus (agente) · **Estado:** completo, build y lint en verde.

## 1. Qué se hizo

Se completó el esqueleto compilable de Botsy según el alcance de WP-00 y la estructura del PLAN-MAESTRO §2:

- **Base Next.js 16** ya inicializada en la raíz del repo con TypeScript estricto (`"strict": true` verificado en `tsconfig.json`), ESLint (flat config de `eslint-config-next`), Tailwind CSS v4, App Router, carpeta `src/` y alias `@/*`. Conviven con `docs/`, `CLAUDE.md` y el `README.md` existente (no se tocaron; no se dejó ningún README generado por `create-next-app`).
- **Dependencias del WP** presentes en `package.json`: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `recharts`, `date-fns`, `lucide-react`.
- **Route groups** `(auth)`, `(paciente)`, `(panel)`, cada uno con su propio `layout.tsx`.
- **Layout del paciente**: móvil-first, contenedor `max-w-md` centrado, barra de navegación inferior fija con 3 ítems (Inicio, Check-in, Perfil) con iconos lucide y resalte de ítem activo; tipografía base ≥16px heredada de `globals.css`.
- **Layout del panel**: sidebar de escritorio (Pacientes, Alertas, Configuración) que colapsa a barra superior en móvil mediante layout responsive (sin toggle JS), con resalte de ítem activo.
- **Landing `/`**: logo/nombre Botsy, claim "Tu asistente de salud que te escucha cada día", botones "Soy paciente" → `/login` y "Soy profesional" → `/login?rol=profesional`, y footer con el disclaimer "Botsy no diagnostica ni sustituye a tu médico."
- **Páginas placeholder** (Server Components, maquetadas, todo el texto en español): `(auth)/login`, `(auth)/registro`, `(paciente)/inicio`, `(paciente)/checkin`, `(paciente)/perfil`, `(paciente)/consentimientos`, `(panel)/pacientes`, `(panel)/alertas`, `(panel)/configuracion`. Los formularios de login/registro son estáticos y sin lógica (se conectan en WP-01).
- **Tema visual** en `globals.css` con variables CSS: primario azul sanitario `#2563EB`, acento verde salud `#10B981`, fondos claros cálidos, radios generosos, base 16px, foco visible accesible. Modo claro únicamente (F1). Tokens expuestos como utilidades Tailwind v4 vía `@theme inline`.
- **PWA base**: `public/manifest.webmanifest` (nombre Botsy, colores del tema, iconos 192/512), iconos placeholder `public/icon-192.png` y `public/icon-512.png`, y metadata en el layout raíz (título con plantilla, descripción, viewport, `themeColor`, `colorScheme: light`, `lang="es"`, `manifest`).
- **Soporte**: `.env.example` con las variables del WP; `.gitignore` correcto (ignora `node_modules`, `.next`, `.env*`).
- **Esqueleto de carpetas** con `.gitkeep` donde aún no hay contenido: `src/lib/{supabase,ia,voz,escalado}`, `src/components/graficos`, `src/types`. Las carpetas `src/components/{paciente,panel,ui}` ya contienen componentes reales (ver abajo).

## 2. Archivos

### Creados en esta sesión

- `.env.example`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/registro/page.tsx`
- `src/app/(paciente)/layout.tsx`
- `src/app/(paciente)/inicio/page.tsx`
- `src/app/(paciente)/checkin/page.tsx`
- `src/app/(paciente)/perfil/page.tsx`
- `src/app/(paciente)/consentimientos/page.tsx`
- `src/app/(panel)/layout.tsx`
- `src/app/(panel)/pacientes/page.tsx`
- `src/app/(panel)/alertas/page.tsx`
- `src/app/(panel)/configuracion/page.tsx`
- `src/components/ui/EncabezadoPagina.tsx` — encabezado reutilizable (título + descripción) para las placeholder.
- `src/components/paciente/NavInferior.tsx` — barra inferior del paciente (`"use client"`, resalta ruta activa).
- `src/components/panel/NavLateral.tsx` — navegación del panel (`"use client"`, sidebar/topbar responsive, resalta ruta activa).
- `src/lib/supabase/.gitkeep`, `src/lib/ia/.gitkeep`, `src/lib/voz/.gitkeep`, `src/lib/escalado/.gitkeep`
- `src/components/graficos/.gitkeep`
- `src/types/.gitkeep`
- `docs/wp/entregas/WP-00-entrega.md` (este archivo)

### Ya presentes del scaffold inicial de `create-next-app` (parte del entregable WP-00, no modificados o solo revisados)

Estos ficheros ya estaban en el árbol de trabajo (sin commitear) cuando empecé, generados por la inicialización previa del proyecto; se revisaron y cumplen el WP tal cual:

- `package.json`, `package-lock.json` (deps del WP ya incluidas), `tsconfig.json` (`strict: true`), `.gitignore`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts`
- `src/app/layout.tsx` (layout raíz con metadata/viewport/`lang="es"`), `src/app/page.tsx` (landing), `src/app/globals.css` (tema), `src/app/favicon.ico`
- `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`

### No tocados (se conservan tal cual)

- `README.md` (el existente del repo, no el de `create-next-app`), `CLAUDE.md`, y todo `docs/` salvo esta entrega.

## 3. Decisiones tomadas no especificadas en el WP

1. **Barras de navegación como client components** (`NavInferior`, `NavLateral`): se marcaron `"use client"` para resaltar el ítem activo con `usePathname()`. Es la única interactividad real; el resto son Server Components, conforme a CLAUDE.md.
2. **Panel "colapsable a top-bar en móvil" vía CSS responsive**, sin botón/toggle con estado: sidebar en `md+`, barra superior con navegación horizontal en móvil. Evita estado de cliente innecesario para un placeholder.
3. **`/login` lee `?rol=profesional`** (searchParams async de Next 16) para adaptar el encabezado (paciente vs. profesional), honrando los dos accesos de la landing. Esto hace que `/login` se sirva como ruta dinámica (`ƒ`) en el build; es el comportamiento correcto y esperado.
4. **Componente `EncabezadoPagina`** en `src/components/ui/` para no repetir maquetación entre las placeholder. Consecuencia: `src/components/ui/` y `src/components/{paciente,panel}/` tienen contenido real, así que no llevan `.gitkeep`; solo lo llevan las carpetas aún vacías (`graficos`, `lib/*`, `types`).
5. **Formularios de login/registro con botón `type="button"` deshabilitado**: estáticos, sin submit ni lógica, para no disparar navegaciones accidentales antes de WP-01.
6. **Textos placeholder con marca `[PENDIENTE LEGAL]`** en consentimientos, alineado con PLAN-MAESTRO §6.
7. **Tono clínico**: los textos del paciente son calmados y no diagnósticos; se repite el disclaimer "Botsy no diagnostica ni sustituye a tu médico" en landing, layout de auth e inicio, conforme a las reglas clínicas de CLAUDE.md.

## 4. Dudas / riesgos detectados

1. **`lucide-react@1.24.0`**: la versión resuelta es la 1.x (no la línea 0.x histórica). Se verificó que exporta todos los iconos usados (`Home`, `User`, `HeartPulse`, `Stethoscope`, `Users`, `Bell`, `Settings`, `MessagesSquare`, `ShieldCheck`, `Mic`, etc.) y el build pasa. Conviene que el director confirme que la versión mayor es la deseada para el proyecto.
2. **Alcance de la estructura §2 vs. tareas del WP**: el PLAN-MAESTRO §2 lista subrutas (`checkin/voz`, `pacientes/[id]`, `pacientes/[id]/informe`) y `src/app/api/`, pero la tarea 4 de WP-00 solo enumera las placeholder anteriores. Se crearon exactamente las páginas de la tarea 4; las subrutas y `api/` se dejaron para sus WP correspondientes (WP-02/03/06) para no invadir su alcance. Si el director quiere las carpetas creadas ya (vacías con `.gitkeep`), es un añadido trivial.
3. **`name` del paquete es `botsy-scaffold`** (heredado de la inicialización). Funcional, pero quizá el director prefiera `botsy`. No se cambió por no estar en el alcance.
4. **Metadata `maximumScale: 5`** en el viewport: permite zoom (bien para accesibilidad); se deja constancia por si se prefiere sin límite.

## 5. Verificación

### Criterios de aceptación

- `npm run build` sin errores → **OK** (exit 0).
- `npm run lint` sin errores ni warnings → **OK** (exit 0).
- `npm run dev` levanta y las rutas responden 200 (comprobado con `curl` contra `http://localhost:3000`):

| Ruta | Status |
|---|---|
| `/` | 200 |
| `/login` | 200 |
| `/login?rol=profesional` | 200 |
| `/registro` | 200 |
| `/inicio` | 200 |
| `/checkin` | 200 |
| `/perfil` | 200 |
| `/consentimientos` | 200 |
| `/pacientes` | 200 |
| `/alertas` | 200 |
| `/configuracion` | 200 |
| `/manifest.webmanifest` | 200 |

Las 7 rutas exigidas por el WP (`/`, `/login`, `/inicio`, `/checkin`, `/perfil`, `/pacientes`, `/alertas`) responden 200. Se verificó además que el contenido renderiza en español (claim y disclaimer en `/`, "Acceso profesional" en `/login?rol=profesional`, `<html lang="es">`).

- `tsconfig.json` estricto → **OK** (`"strict": true`).
- `.env.example` completo (todas las variables del WP) → **OK**.
- Estructura de carpetas conforme al PLAN-MAESTRO §2 → **OK**.
- Todo el texto visible en español → **OK**.

### Salida literal de `npm run build`

```
> botsy-scaffold@0.1.0 build
> next build

▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 13.3s
  Running TypeScript ...
  Finished TypeScript in 8.5s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/13) ...
  Generating static pages using 3 workers (3/13) 
  Generating static pages using 3 workers (6/13) 
  Generating static pages using 3 workers (9/13) 
✓ Generating static pages using 3 workers (13/13) in 946ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /alertas
├ ○ /checkin
├ ○ /configuracion
├ ○ /consentimientos
├ ○ /inicio
├ ƒ /login
├ ○ /pacientes
├ ○ /perfil
└ ○ /registro


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

(Exit code 0.)

### Salida literal de `npm run lint`

```
> botsy-scaffold@0.1.0 lint
> eslint

```

(Sin salida, exit code 0 — ningún error ni warning.)
