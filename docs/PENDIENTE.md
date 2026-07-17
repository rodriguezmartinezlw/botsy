# Botsy — Qué falta (guía de continuación)

**EMPIEZA AQUÍ** si eres el modelo/agente que continúa el proyecto. Última actualización: 2026-07-17 (piloto construido y en vivo).

## Orden de lectura obligatorio

1. [MEMORIA-PROYECTO.md](MEMORIA-PROYECTO.md) — autoridad de producto (negocio, pagadores, reglas de oro, regla de corte).
2. [PLAN-TECNICO-PILOTO.md](PLAN-TECNICO-PILOTO.md) — plan técnico maestro del piloto.
3. `CLAUDE.md` — convenciones VINCULANTES (4 reglas de oro incluidas).
4. [RESUMEN-PROYECTO.md](RESUMEN-PROYECTO.md) — traspaso general.

## ✅ LO REALIZADO (a 2026-07-17)

**Todo el piloto está construido, revisado, commiteado y CORRIENDO SOBRE BASE DE DATOS REAL.**

| Fase | Contenido | Estado |
|---|---|---|
| F1 (WP-00..08) | Plataforma completa: check-in voz/texto, escalado, panel profesional, informes, consentimientos, hardening | ✅ |
| WP-10 | Deuda técnica (7 ítems: aviso urgencia por email, proxy ?next=, validador cifras en letras…) | ✅ |
| WP-11 v2 | Programas de mama («Terapia oral», «Tratamiento activo») + **disposición estructurada obligatoria** + CTCAE + `uso_secundario` | ✅ |
| WP-17 + WP-15 | **Dashboard del patrocinador** (solo agregados k≥5, RPC security definer) + modo demo + **informe ROI** + seed oncológico | ✅ |
| WP-16 | Termómetro de Distrés NCCN conversacional (umbral `[PENDIENTE CLÍNICO]`) | ✅ |
| WP-09 | Migraciones **0001–0013** + seed aplicados al Supabase real (`hjkvmhccgorphhykoarg`); `acceso_cruzado.sql` EN VERDE en vivo (destapó y se corrigieron 2 bugs reales: RLS de reglas_escalado → 0012; RPC `n` ambiguo → 0013); E2E de IA con clave real OK | ✅ |

**Métricas:** 216 tests en verde · 19 tablas con RLS verificada en vivo · las 3 caras funcionan (paciente / profesional / patrocinador) · demo vendible: `DEMO_MODE=true npm run dev` + `docs/DEMO-GUION.md`. Claves en `.env.local` (Supabase completo + OpenAI texto y Realtime). Revisiones del director en `docs/revisiones/WP-*.md`.

## ⏳ COLA DE TRABAJO (en orden)

| Orden | WP | Qué es | Puerta |
|---|---|---|---|
| ✅ | [WP-20](wp/WP-20-ux-usabilidad.md) | **UX y usabilidad** — enrolamiento de pacientes desde el panel (+ vinculación de huérfanos con protección anti-robo), recuperación de contraseña, perfil editable, iconos PWA reales, estados de carga, accesibilidad | **HECHO** (243 tests; `docs/revisiones/WP-20-revision.md`). Config pendiente: añadir `${APP_URL}/restablecer` a las Redirect URLs de Supabase Auth; QA visual en dispositivo |
| 1 | [WP-18](wp/WP-18-farmacovigilancia.md) | Farmacovigilancia mínima viable (EA → cola con SLA 24h → paquete exportable pseudonimizado) | ⛔ Primera LOI farma (el formato del paquete lo fija el contrato) |
| 3 | [WP-19](wp/WP-19-cuidador-proxy.md) | Cuidador-proxy pediátrico (titular = adulto; la IA jamás conversa con el menor) | ⛔ Asociación/fundación |
| ∥ | Deploy a Vercel | `docs/DESPLIEGUE.md` está listo; falta decidir cuenta Vercel y ejecutarlo (cron horario requiere plan Pro). La demo NO lo necesita (corre en local) | Decisión del fundador |

| 4 | [WP-21](wp/WP-21-rendimiento-rls.md) | Rendimiento de RLS a escala (`auth_rls_initplan`, `multiple_permissive_policies` — del linter de Supabase) | Sin puerta, **NO urgente** (negligible con decenas de pacientes; hacer al crecer) |

**Auditoría de verificación 2026-07-17** (`docs/revisiones/REVISION-2026-07-17-auditoria.md`): sin fugas de datos ni bugs de corrección nuevos. Corregido un cierre de seguridad latente (RPC del patrocinador ejecutables por anon por un `revoke` inefectivo de 0010 → migración **0014**) y añadidos 20 índices de FK (**0015**). Config pendiente: protección de contraseñas filtradas (HIBP) requiere plan Pro de Supabase.

**Deuda menor anotada** (no bloquea; ver revisiones): redundancia `desactivada_en`/`discontinuada_en` (limpieza opcional), mover la materialización de reglas del seed a función invocable, RPC transaccional del cierre, SSE del último turno.

## Insumos que solo puede aportar el fundador

1. **Las tres llamadas** (MEMORIA §14, antes del 1-ago-2026): psicooncólogo → fija los umbrales `[PENDIENTE CLÍNICO]` (reglas oncológicas, termómetro, frecuencias); asociación → desbloquea WP-19 y las 5 pacientes de la demo; Pfizer/Roche → ruta A y desbloquea WP-18.
2. **`RESEND_API_KEY`** — único hueco de `.env.local`; solo afecta al envío real de emails (recordatorios, aviso de urgencia al profesional). La recuperación de contraseña y la invitación de pacientes (WP-20) usan el mailer integrado de Supabase, NO necesitan Resend.
3. **Textos legales** (`[PENDIENTE LEGAL]`) y diligencia RGPD/DPA; *intended purpose* con consultor regulatorio antes de material comercial.
4. Cuenta Vercel para el deploy público (opcional hasta el piloto).

## Notas operativas

- **Push a GitHub:** `gh auth switch --user rodriguezmartinezlw && git push && gh auth switch --user coprodelidev`.
- **Aplicar SQL al Supabase vivo sin CLI:** Management API `POST https://api.supabase.com/v1/projects/<ref>/database/query` con el PAT de `.env.local` (así se aplicaron 0001–0013 y el seed).
- Protocolo director/implementador vigente (PLAN-MAESTRO §5): entregas en `docs/wp/entregas/`, revisiones en `docs/revisiones/`, migraciones commiteadas JAMÁS se editan.
