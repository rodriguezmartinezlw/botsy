# Botsy — Resumen del proyecto (traspaso a otro agente/modelo)

*Escrito el 2026-07-16 por el director técnico saliente (Fable) para el modelo que continúa. Léelo entero antes de tocar nada.*

## Qué estamos construyendo

**Botsy es un asistente inteligente sanitario** que se está reconstruyendo desde cero tras la pérdida del código original (solo se conservaba el pitch deck; la spec reconstruida está en `docs/funcional-v0.2.md`). Tiene dos caras conectadas:

1. **App del paciente** (PWA móvil-first): un **check-in conversacional diario por voz o texto**. El paciente habla con la IA ("Hola Luis, ¿cómo te ha ido hoy?") y la conversación se convierte en datos clínicos estructurados: adherencia a la medicación, dolor (0–10), síntomas, ánimo/ansiedad/estrés, sueño, cognición, hábitos. Si detecta una señal de riesgo, activa un **protocolo de escalado** en 4 niveles (normal → vigilancia → contactar médico → urgencia) con lenguaje empático.
2. **Dashboard del profesional** (web): lista de pacientes con semáforo de riesgo, ficha 360º con línea temporal y tendencias, bandeja de alertas con evidencia, gestión de medicación, reglas de escalado configurables por plantillas amigables, e informes imprimibles con resumen ejecutivo por LLM.

**Regla de oro innegociable:** Botsy NUNCA diagnostica ante el paciente. Detecta señales, las comunica con calma ("he notado algo que conviene comentar con tu médico") y deriva al profesional. El diagnóstico es siempre humano. Toda la base de código respeta esto y las revisiones lo verifican.

**Modelo de negocio (pivote 2026-07-16 — [MEMORIA-PROYECTO.md](MEMORIA-PROYECTO.md) es la autoridad de producto):** se vende a **laboratorios farmacéuticos** vía Programas de Soporte al Paciente (pilotos $60–200K) y a **pagadores capitados** en el año 2. **NO es B2C; el paciente no paga.** A esos precios el coste de voz (OpenAI Realtime mini vía WebRTC, ~$3–7.5/usuario/mes, `docs/adr/ADR-001-api-de-voz.md`) es marginal; la abstracción `VoiceSession` permite migrar de proveedor.

## La dirección de producto actual (lo más importante que debes entender)

**Oncología primero** (`docs/adr/ADR-003-pivote-oncologia.md` + `docs/MEMORIA-PROYECTO.md`): vertical de entrada **cáncer de mama** con 2 programas — «Terapia oral» (adherencia diaria + fiebre/diarrea/fatiga) y «Tratamiento activo» (síntomas de ciclo + distrés) — y **oncología pediátrica vía cuidador-proxy**: la IA JAMÁS conversa con menores; el padre/madre (titular de la cuenta) reporta por voz sobre su hijo. La arquitectura de programas de ADR-002 sigue vigente; sus plantillas multi-perfil (TCC, psiquiatría, Alzheimer, post-cirugía) quedaron ⛔ APARCADAS (MEMORIA §8.2).

**Las 4 reglas de oro** (en CLAUDE.md, vinculantes): (1) nunca diagnostica; (2) la IA no conversa con menores; (3) **toda alerta se resuelve con disposición estructurada obligatoria** (decisión + motivo codificado + desenlace a X días — la semilla del activo de datos, no retrofiteable); (4) **v1 no predice ni sugiere** (escalado determinista; el LLM captura y estructura, nunca decide).

**Regla de puertas** (MEMORIA §8.3): cada WP clínico se desbloquea con una conversación real del fundador (psicooncólogo → umbrales; asociación → pediatría; farma → farmacovigilancia). Los umbrales clínicos van configurables y marcados `[PENDIENTE CLÍNICO]` hasta su validación.

## Estado: F1 COMPLETO, subido y verificado

Repo: **github.com/rodriguezmartinezlw/botsy** (cuenta personal del usuario). 11 commits. **113 tests en verde, RLS en 11 tablas auditada sin defectos, cero secretos en el bundle de cliente, TypeScript estricto sin `any`.** No existe aún proyecto Supabase remoto ni claves de OpenAI/Resend: todo está verificado con mocks inyectables y cada entrega documenta su prueba E2E real para cuando haya claves.

**Stack:** Next.js 16 (App Router, route groups `(paciente)`/`(panel)`/`(auth)`) · Supabase (Postgres+Auth+Storage, migraciones en `supabase/migrations/0001..0004`, RLS estricta) · OpenAI (texto para extracción con Zod, Realtime para voz con token efímero server-side) · Recharts · Vitest · Vercel (previsto).

**Construido en F1 (WP-00..08):** scaffolding · esquema+RLS+auth por roles · motor conversacional compartido (builder de instrucciones + tools neutras + loop con validación Zod, un solo código para texto y voz) · check-in por voz WebRTC con grabación solo bajo consentimiento · motor de escalado determinista por reglas JSONB con alertas idempotentes y materialización INMEDIATA al profesional · perfil evolutivo con gráficos · dashboard profesional completo · informes imprimibles (el resumen LLM pasa por un validador que descarta cualquier cifra no presente en los datos) · cron de recordatorios por email · consentimientos granulares con revocación efectiva · hardening (auditoría de acceso cruzado, seed demo de 45 días, `docs/DESPLIEGUE.md`).

## Cómo se trabaja aquí (protocolo obligatorio)

Flujo **director/implementador**: el implementador lee `CLAUDE.md` (convenciones VINCULANTES: reglas clínicas, RLS en toda tabla, autorización DENTRO de cada Route Handler porque el middleware de Next 16 no intercepta `/api`, Zod en toda salida de LLM, secretos solo por env, español) → `docs/PLAN-MAESTRO.md` → su `docs/wp/WP-XX-*.md` → implementa SOLO ese alcance → verifica `npm run build && npm run lint && npm test` → escribe su entrega en `docs/wp/entregas/WP-XX-entrega.md` → **NO commitea** (el commit lo hace el director tras revisar y dejar `docs/revisiones/WP-XX-revision.md`). Las migraciones commiteadas jamás se editan: siempre migración nueva.

## Qué toca hacer ahora (en orden — hoja de ruta técnica en `docs/PLAN-TECNICO-PILOTO.md`, guía en `docs/PENDIENTE.md`)

1. **WP-10** — deuda técnica de F1 (7 ítems, programable YA, sin claves ni puertas).
2. **WP-11 v2** — núcleo de programas ONCOLOGÍA: arquitectura + seed de los 2 programas de mama + **disposición estructurada obligatoria** + vocabulario CTCAE simplificado + consentimiento `uso_secundario`.
3. **WP-16** (Termómetro de Distrés NCCN conversacional; puerta: psicooncólogo) → **WP-17 + WP-15** (dashboard del PATROCINADOR con agregados pseudonimizados k≥5, seed demo oncológico y modo demo + informe ROI — **al terminar esto hay demo vendible en local, sin claves**) → **WP-18** (farmacovigilancia; puerta: primera LOI) → **WP-19** (cuidador-proxy pediátrico; puerta: asociación/fundación). Specs completas en PLAN-TECNICO-PILOTO §5; los WP individuales de 16/17/15/18/19 se emiten al abrirse cada puerta.
4. **WP-09** — producción y E2E reales: bloqueado por claves del fundador. **La venta NO lo espera.**

**⛔ APARCADO — no implementar:** WP-12 (TCC), WP-13 (post-cirugía/fotos; su §3 fue absorbido por WP-11 v2), WP-14 (Alzheimer), toda predicción/sugerencia, todo B2C, pt-BR.

**Pendiente que solo el fundador puede aportar:** las tres llamadas (MEMORIA §14: psicooncólogo, asociación de pacientes, contacto Pfizer/Roche — antes del 1 de agosto), claves/cuentas, textos legales (`[PENDIENTE LEGAL]`), diligencia RGPD/DPA, *intended purpose* con consultor regulatorio antes de material comercial.

**Nota operativa:** para push, el credencial activo del CLI es `coprodelidev`; este repo es personal → `gh auth switch --user rodriguezmartinezlw && git push && gh auth switch --user coprodelidev`.
