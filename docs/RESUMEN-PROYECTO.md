# Botsy — Resumen del proyecto (traspaso a otro agente/modelo)

*Escrito el 2026-07-16 por el director técnico saliente (Fable) para el modelo que continúa. Léelo entero antes de tocar nada.*

## Qué estamos construyendo

**Botsy es un asistente inteligente sanitario** que se está reconstruyendo desde cero tras la pérdida del código original (solo se conservaba el pitch deck; la spec reconstruida está en `docs/funcional-v0.2.md`). Tiene dos caras conectadas:

1. **App del paciente** (PWA móvil-first): un **check-in conversacional diario por voz o texto**. El paciente habla con la IA ("Hola Luis, ¿cómo te ha ido hoy?") y la conversación se convierte en datos clínicos estructurados: adherencia a la medicación, dolor (0–10), síntomas, ánimo/ansiedad/estrés, sueño, cognición, hábitos. Si detecta una señal de riesgo, activa un **protocolo de escalado** en 4 niveles (normal → vigilancia → contactar médico → urgencia) con lenguaje empático.
2. **Dashboard del profesional** (web): lista de pacientes con semáforo de riesgo, ficha 360º con línea temporal y tendencias, bandeja de alertas con evidencia, gestión de medicación, reglas de escalado configurables por plantillas amigables, e informes imprimibles con resumen ejecutivo por LLM.

**Regla de oro innegociable:** Botsy NUNCA diagnostica ante el paciente. Detecta señales, las comunica con calma ("he notado algo que conviene comentar con tu médico") y deriva al profesional. El diagnóstico es siempre humano. Toda la base de código respeta esto y las revisiones lo verifican.

**Modelo de negocio:** suscripción ~$29/mes (B2C/B2B: aseguradoras, clínicas). Por eso el coste por usuario importa: la voz usa OpenAI Realtime `gpt-realtime-2.1-mini` vía WebRTC (~$3–7.5/usuario/mes a 150 min; análisis completo en `docs/adr/ADR-001-api-de-voz.md`), detrás de una abstracción `VoiceSession` que permite migrar de proveedor.

## La dirección de producto actual (lo más importante que debes entender)

**Programas de monitorización** (`docs/adr/ADR-002-programas-de-monitorizacion.md`): el mismo producto sirve a perfiles clínicos muy distintos porque el profesional asigna a cada paciente un **programa** = prescripción empaquetada de módulos activos (voz/texto/tareas/diario/fotos), guion del check-in, reglas de escalado, frecuencia y ciclo de vida. Cinco plantillas iniciales:

- **Psicología TCC** — tareas terapéuticas prescritas + "cuaderno hablado": el paciente registra pensamientos por voz (situación→pensamiento→emoción→alternativa) y el terapeuta los ve estructurados.
- **Psiquiatría** — adherencia crítica, señales de recaída.
- **Psicooncología** — síntomas del tratamiento; fiebre ≥38 en tratamiento activo = urgencia.
- **Alzheimer** — SOLO voz, UI de un botón, ritmo lento, cuidador v1 (sin cuenta, recibe avisos por email).
- **Post-cirugía** — programa temporal por fases con alta automática + foto dirigida de la herida.

Las 5 decisiones de producto están **confirmadas por el usuario (2026-07-16)** y anotadas en el ADR-002: programa base único por paciente (módulos extra por override), cuidador v1 sin cuenta, tareas por catálogo + creación libre, diario 24/7 separado del check-in, y visibilidad de gráficos configurable por el profesional. Los WP ya las implementan: no re-preguntes.

## Estado: F1 COMPLETO, subido y verificado

Repo: **github.com/rodriguezmartinezlw/botsy** (cuenta personal del usuario). 11 commits. **113 tests en verde, RLS en 11 tablas auditada sin defectos, cero secretos en el bundle de cliente, TypeScript estricto sin `any`.** No existe aún proyecto Supabase remoto ni claves de OpenAI/Resend: todo está verificado con mocks inyectables y cada entrega documenta su prueba E2E real para cuando haya claves.

**Stack:** Next.js 16 (App Router, route groups `(paciente)`/`(panel)`/`(auth)`) · Supabase (Postgres+Auth+Storage, migraciones en `supabase/migrations/0001..0004`, RLS estricta) · OpenAI (texto para extracción con Zod, Realtime para voz con token efímero server-side) · Recharts · Vitest · Vercel (previsto).

**Construido en F1 (WP-00..08):** scaffolding · esquema+RLS+auth por roles · motor conversacional compartido (builder de instrucciones + tools neutras + loop con validación Zod, un solo código para texto y voz) · check-in por voz WebRTC con grabación solo bajo consentimiento · motor de escalado determinista por reglas JSONB con alertas idempotentes y materialización INMEDIATA al profesional · perfil evolutivo con gráficos · dashboard profesional completo · informes imprimibles (el resumen LLM pasa por un validador que descarta cualquier cifra no presente en los datos) · cron de recordatorios por email · consentimientos granulares con revocación efectiva · hardening (auditoría de acceso cruzado, seed demo de 45 días, `docs/DESPLIEGUE.md`).

## Cómo se trabaja aquí (protocolo obligatorio)

Flujo **director/implementador**: el implementador lee `CLAUDE.md` (convenciones VINCULANTES: reglas clínicas, RLS en toda tabla, autorización DENTRO de cada Route Handler porque el middleware de Next 16 no intercepta `/api`, Zod en toda salida de LLM, secretos solo por env, español) → `docs/PLAN-MAESTRO.md` → su `docs/wp/WP-XX-*.md` → implementa SOLO ese alcance → verifica `npm run build && npm run lint && npm test` → escribe su entrega en `docs/wp/entregas/WP-XX-entrega.md` → **NO commitea** (el commit lo hace el director tras revisar y dejar `docs/revisiones/WP-XX-revision.md`). Las migraciones commiteadas jamás se editan: siempre migración nueva.

## Qué toca hacer ahora (en orden — detalle en `docs/PENDIENTE.md`)

1. **WP-10** — deuda técnica de F1 (7 ítems, programable YA sin claves).
2. **WP-11** — núcleo de programas de monitorización (tablas `programas`/`programas_paciente`, config Zod con merge, gating server-side, check-in dirigido por programa, pestaña Programa en el panel, seed de las 5 plantillas).
3. **WP-12** — tareas terapéuticas TCC + diario por voz. **WP-13** — post-cirugía/oncología + fotos clínicas. **WP-14** — modo Alzheimer + cuidador.
4. **WP-09** — puesta en producción y E2E reales: BLOQUEADO hasta que el usuario aporte claves (Supabase, OpenAI incl. Realtime, Resend, Vercel Pro). Puede ir en paralelo cuando lleguen.

**Pendiente que solo el usuario puede aportar:** claves/cuentas, textos legales reales (buscar `[PENDIENTE LEGAL]`), diligencia RGPD/DPA, y validación clínica de los umbrales de las plantillas (son borrador).

**Nota operativa:** para push, el credencial activo del CLI es `coprodelidev`; este repo es personal → `gh auth switch --user rodriguezmartinezlw && git push && gh auth switch --user coprodelidev`.
