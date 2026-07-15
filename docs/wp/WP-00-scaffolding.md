# WP-00 — Scaffolding Next.js + estructura + PWA base

**Depende de:** nada · **Desbloquea:** todos los demás

## Objetivo

Esqueleto compilable del proyecto: Next.js 16 con TypeScript estricto y Tailwind, estructura de carpetas del PLAN-MAESTRO §2, tema visual base y manifest PWA. Sin lógica de negocio.

## Tareas

1. **Inicializar Next.js 16 EN LA RAÍZ del repo** (`C:\Users\PROPIETARIO\Desktop\projects\botsy`), conviviendo con `docs/` y `CLAUDE.md` ya existentes (no los muevas ni los borres):
   - TypeScript, ESLint, Tailwind CSS, App Router, carpeta `src/`, alias `@/*`.
   - Si `create-next-app` se niega por directorio no vacío, scaffoldea en una carpeta temporal y mueve el contenido a la raíz (sin pisar `docs/`, `README.md` ni `CLAUDE.md` — conserva el README existente, no el generado).
   - `tsconfig.json` con `"strict": true` (verifica que quede activo).
2. **Dependencias:** `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `recharts`, `date-fns`, `lucide-react`.
3. **Estructura de carpetas** exacta del PLAN-MAESTRO §2: route groups `(auth)`, `(paciente)`, `(panel)` con `layout.tsx` propio cada uno, y las carpetas `src/lib/{supabase,ia,voz,escalado}`, `src/components/{paciente,panel,graficos,ui}`, `src/types` (con `.gitkeep` o archivo índice donde aún no haya contenido).
4. **Páginas placeholder** (Server Components, contenido mínimo pero maquetado):
   - `/` — landing sencilla: logo/nombre Botsy, claim ("Tu asistente de salud que te escucha cada día"), botones "Soy paciente" → `/login` y "Soy profesional" → `/login?rol=profesional`. Footer con disclaimer: "Botsy no diagnostica ni sustituye a tu médico."
   - `(auth)/login` y `(auth)/registro` — formularios estáticos (sin lógica; se conectan en WP-01).
   - `(paciente)/inicio`, `(paciente)/checkin`, `(paciente)/perfil`, `(paciente)/consentimientos` — placeholders con título y descripción.
   - `(panel)/pacientes`, `(panel)/alertas`, `(panel)/configuracion` — placeholders.
5. **Layouts:**
   - `(paciente)`: móvil-first, contenedor max-w-md centrado, barra de navegación inferior fija con 3 ítems (Inicio, Check-in, Perfil) usando iconos lucide, tipografía base ≥16px.
   - `(panel)`: sidebar de escritorio (Pacientes, Alertas, Configuración) colapsable a top-bar en móvil.
6. **Tema visual** en `globals.css` con variables CSS: primario azul sanitario (#2563EB aprox.), acento verde salud (#10B981), fondos claros cálidos, radios generosos (estética calmada, apta para mayores). Modo claro solamente en F1.
7. **PWA base:** `public/manifest.webmanifest` (nombre Botsy, colores del tema, iconos 192/512 — genera placeholders simples), metadata en el layout raíz (título, descripción, viewport, lang="es").
8. **Soporte:** `.env.example` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL=gpt-5-mini`, `OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini`. `.gitignore` correcto (node_modules, .next, .env*).

## Fuera de alcance

Autenticación real, Supabase, cualquier llamada a OpenAI, gráficos con datos.

## Criterios de aceptación

- `npm run build` y `npm run lint` sin errores.
- `npm run dev` levanta; `/`, `/login`, `/inicio`, `/checkin`, `/perfil`, `/pacientes`, `/alertas` renderizan sin error (verifica con curl o fetch los status 200).
- `tsconfig.json` estricto; `.env.example` completo; estructura de carpetas igual a la del plan.
- Todo el texto visible en español.
