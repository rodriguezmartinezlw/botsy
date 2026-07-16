# Botsy — Qué falta (guía de continuación post-F1)

**EMPIEZA AQUÍ** si eres el modelo/agente que continúa el proyecto. Última actualización: 2026-07-16.

## Estado actual

F1 (MVP conversacional) está **completo y subido** a `github.com/rodriguezmartinezlw/botsy`: 10 commits, 113 tests en verde, RLS sin defectos, sin fugas de secretos. Detalle en `docs/PLAN-MAESTRO.md` §7 y revisiones en `docs/revisiones/`. No existe todavía proyecto Supabase remoto ni claves de OpenAI/Resend: todo está verificado con mocks y las pruebas E2E reales están documentadas en cada entrega (`docs/wp/entregas/`).

## Cómo se trabaja aquí (protocolo vigente)

Flujo director/implementador de `docs/PLAN-MAESTRO.md` §5: el implementador lee `CLAUDE.md` (vinculante) → `PLAN-MAESTRO.md` → su `docs/wp/WP-XX-*.md` → implementa → verifica build/lint/test → entrega en `docs/wp/entregas/WP-XX-entrega.md` → **NO commitea** (el commit lo hace el director tras revisar en `docs/revisiones/`).

## Trabajo pendiente, en orden recomendado

| Orden | WP | Qué es | ¿Necesita claves/cuentas? |
|---|---|---|---|
| 1 | [WP-10](wp/WP-10-deuda-tecnica.md) | Deuda técnica consciente de F1 (7 ítems de las revisiones) | No — programable YA |
| 2 | [WP-11](wp/WP-11-programas-nucleo.md) | **Programas de monitorización** (núcleo multi-perfil, [ADR-002](adr/ADR-002-programas-de-monitorizacion.md)) | No — programable YA |
| 3 | [WP-12](wp/WP-12-tareas-terapeuticas.md) | Tareas terapéuticas TCC + diario por voz | No (mocks) |
| 4 | [WP-13](wp/WP-13-programas-especificos-1.md) | Programas post-cirugía y psicooncología + fotos clínicas | No (mocks) |
| 5 | [WP-14](wp/WP-14-alzheimer-cuidador.md) | Modo Alzheimer (voz-solo, UI simple) + rol cuidador v1 | No (mocks) |
| ∥ | [WP-09](wp/WP-09-puesta-en-produccion.md) | Puesta en producción + E2E reales | **Sí** — en cuanto el usuario aporte claves; puede ir en paralelo a 2–5 |

WP-09 no bloquea a los demás; se ejecuta cuando el usuario cree el proyecto Supabase y aporte claves (ver sus prerequisitos).

## Decisiones/insumos que solo puede aportar el usuario

1. Las **5 preguntas abiertas de ADR-002** (programa combinable, cuidador, tareas libres, diario 24/7, visibilidad de gráficos).
2. **Claves y cuentas** (prereq. de WP-09): proyecto Supabase (cuenta por confirmar — el repo GitHub ya es personal `rodriguezmartinezlw`), `OPENAI_API_KEY` (texto + Realtime), Resend (+dominio verificado para `RESEND_FROM`), Vercel (el cron horario requiere plan **Pro**).
3. **Textos legales reales** donde hay `[PENDIENTE LEGAL]` (consentimientos, aviso de urgencias, informe).
4. **Diligencia RGPD/DPA** de proveedores (OpenAI, Resend, Supabase) antes de pacientes reales; DPIA.
5. **Validación clínica** de las plantillas de programas y umbrales de escalado (ADR-002) antes de uso real.

## Backlog posterior (sin WP aún; abrir cuando toque)

- Push web/nativas para recordatorios y alertas (hoy: email) — RF-CV-07 completo.
- Multiidioma ES/PT/EN (RF-CV-10); textos ya centralizados.
- Informes por cohorte y programados (RF-DB-06 completo); vista poblacional B2B (RF-DB-07); administración de organizaciones (RF-DB-08).
- App nativa Expo + HealthKit/Health Connect (monitorización del dispositivo, §2.2 funcional).
- F3 biomarcadores vocales en modo sombra (el audio ya se graba con consentimiento desde WP-03).
- Streaming SSE del último turno del chat; resumen de cierre redactado por LLM (hoy determinista).
- Facturación (suscripción B2C / contratación B2B).

## Notas operativas

- **Push a GitHub:** el credencial activo del CLI es `coprodelidev`; este repo es personal. Para pushear: `gh auth switch --user rodriguezmartinezlw && git push && gh auth switch --user coprodelidev`.
- Despliegue completo: `docs/DESPLIEGUE.md`. Desarrollo local: `README.md`.
