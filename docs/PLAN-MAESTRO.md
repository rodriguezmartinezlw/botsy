# Botsy — Plan Maestro de Reconstrucción (F1)

**Fecha:** 2026-07-15 · **Director:** Fable · **Implementador:** Opus (agentes) · **Especificación:** `docs/funcional-v0.2.md`

## 1. Alcance de F1 (MVP conversacional, según roadmap §10 de la funcional)

Check-in diario por **texto y voz** con extracción clínica estructurada, adherencia farmacológica, perfil evolutivo del paciente, protocolo de escalado básico, dashboard profesional con alertas e informes. Nivel regulatorio: bienestar/registro (las funciones se etiquetan como cribado, nunca diagnóstico).

**Queda fuera de F1:** biomarcadores vocales (F3 — pero se graba audio con consentimiento desde ya), video-consulta (F4), predicción multimodal (F5), monitorización del dispositivo (HealthKit/Health Connect), facturación, multi-organización B2B, app nativa.

## 2. Decisiones de arquitectura (tomadas)

| # | Decisión | Justificación |
|---|---|---|
| D1 | **Una sola app Next.js 16** (App Router, TS estricto, Tailwind) con tres áreas por route groups: `(paciente)` PWA móvil-first, `(panel)` profesional, `(auth)` acceso | Velocidad de rebuild, un deploy, patrón ya dominado por el equipo. La app nativa (Expo) se difiere a F2+, cuando hagan falta sensores/push nativas |
| D2 | **Supabase** (Postgres + Auth + Storage) con RLS estricta y migraciones SQL versionadas en el repo | Patrón estándar del equipo |
| D3 | **Voz: OpenAI Realtime `gpt-realtime-2.1-mini` vía WebRTC** con tokens efímeros y abstracción `VoiceSession` | Ver [ADR-001](adr/ADR-001-api-de-voz.md) |
| D4 | **Texto/extracción: modelo económico de OpenAI** (`OPENAI_TEXT_MODEL`, por defecto `gpt-5-mini`; ajustar al vigente) con salidas estructuradas validadas por Zod | Un solo proveedor de IA en F1; la extracción fina va post-sesión sobre el transcript |
| D5 | Una sola lógica de conversación (builder de instrucciones + tools + checklist de dominios) con **dos transportes**: texto (chat) y voz (Realtime) | Evita divergencia entre modos |
| D6 | Idioma F1: **es-ES** únicamente; textos centralizados para facilitar i18n (PT/EN) en F2 | Mercado inicial |
| D7 | Gráficos con **Recharts**; fechas con `date-fns` | Estándar del equipo |
| D8 | El motor de escalado F1 es de **reglas configurables** (sin ML): niveles normal/vigilancia/contactar/urgencia | Explicable, auditable, suficiente para MVP; ML llega en F5 |

### Estructura del repo prevista

```
botsy/
├── CLAUDE.md, README.md
├── docs/ (funcional, PLAN-MAESTRO, adr/, wp/, wp/entregas/, revisiones/)
├── supabase/migrations/NNNN_*.sql · supabase/seed.sql
├── public/ (manifest PWA, iconos)
└── src/
    ├── app/
    │   ├── (auth)/login, registro
    │   ├── (paciente)/inicio, checkin, checkin/voz, perfil, consentimientos
    │   ├── (panel)/pacientes, pacientes/[id], pacientes/[id]/informe, alertas, configuracion
    │   └── api/ (checkin/*, voz/sesion, ...)
    ├── lib/
    │   ├── supabase/ (client, server, admin)
    │   ├── ia/ (conversacion: builder de instrucciones+tools; extraccion; openai)
    │   ├── voz/ (VoiceSession: interfaz + implementación openai-realtime)
    │   └── escalado/ (motor de reglas, evaluación)
    ├── components/ (paciente/, panel/, graficos/, ui/)
    └── types/ (db.ts, clinico.ts)
```

## 3. Modelo de datos F1 (resumen; el detalle vive en WP-01)

`perfiles` (rol paciente|profesional|admin) · `pacientes` (vertical clínica, condiciones, médico asignado, teléfono del médico, hora de check-in, rachas) · `pautas_medicacion` · `checkins` (canal voz|texto, estado, dominios_cubiertos, resumen, riesgo, audio_path) · `mensajes` · `observaciones` (dominio, código, valor, confianza) · `tomas_medicacion` · `reglas_escalado` (condición JSONB, nivel, global o por paciente) · `alertas` (nivel, evidencia, estado de gestión) · `consentimientos` (tipo, versión de texto, otorgado/revocado) · `eventos_auditoria`. RLS: el paciente ve solo lo suyo; el profesional, sus pacientes asignados; admin, todo.

## 4. Paquetes de trabajo (WP) y dependencias

| WP | Nombre | Depende de | Entrega |
|---|---|---|---|
| [WP-00](wp/WP-00-scaffolding.md) | Scaffolding Next.js + estructura + PWA base | — | esqueleto compilable |
| [WP-01](wp/WP-01-supabase-schema.md) | Esquema Supabase: migraciones + RLS + seed + clientes | WP-00 | SQL completo + tipos |
| [WP-02](wp/WP-02-checkin-texto.md) | Motor conversacional + check-in por TEXTO | WP-01 | chat E2E con extracción |
| [WP-03](wp/WP-03-checkin-voz.md) | Check-in por VOZ (Realtime WebRTC) | WP-02 | voz E2E + grabación consentida |
| [WP-04](wp/WP-04-escalado-alertas.md) | Motor de escalado + alertas | WP-02 | 4 niveles E2E auditados |
| [WP-05](wp/WP-05-perfil-paciente.md) | Perfil evolutivo del paciente (gráficos) | WP-01 (datos), ideal tras WP-02 | perfil con seed |
| [WP-06](wp/WP-06-dashboard-profesional.md) | Dashboard profesional (pacientes, ficha 360, bandeja de alertas, medicación) | WP-04 | panel E2E |
| [WP-07](wp/WP-07-informes-consentimientos.md) | Informes imprimibles + recordatorios + pantalla de consentimientos | WP-05, WP-06 | informe + gestión consentimientos |
| [WP-08](wp/WP-08-hardening.md) | Hardening: auditoría RLS, accesibilidad, disclaimers, seed demo, despliegue | todos | checklist de salida |

Orden de ejecución: 00 → 01 → 02 → (03 ∥ 04 ∥ 05) → 06 → 07 → 08.

## 5. Protocolo director/implementador

1. **Lanzamiento:** el director lanza un agente Opus por WP con el prompt: leer `CLAUDE.md`, `PLAN-MAESTRO.md`, su `docs/wp/WP-XX-*.md` y las secciones de la funcional referenciadas; implementar; verificar; escribir `docs/wp/entregas/WP-XX-entrega.md`. El implementador NO hace commit.
2. **Revisión:** el director revisa el diff completo contra los criterios de aceptación + seguridad (RLS, secretos, validación de entrada) + reglas clínicas (tono, no-diagnóstico). Hallazgos en `docs/revisiones/WP-XX-revision.md`.
3. **Corrección:** si hay hallazgos bloqueantes, se lanza un agente de corrección con la revisión como input. Máximo 2 ciclos; si persiste, el director corrige a mano.
4. **Aprobación:** commit del director con mensaje `WP-XX: <resumen>`. Solo entonces se desbloquean los WP dependientes.

## 6. Decisiones pendientes del usuario (no bloquean el desarrollo local)

- **Cuentas:** ¿GitHub/Supabase/Vercel bajo `coprodelidev` o cuenta personal? (crear proyecto Supabase y repo remoto cuando se decida).
- Nombre de dominio / marca definitiva.
- Textos legales reales (consentimientos, aviso de responsabilidad en urgencias) — en F1 van placeholders marcados `[PENDIENTE LEGAL]`.
- Estrategia regulatoria (lanzar como bienestar vs. iniciar MDR) — F1 se construye como bienestar/registro por diseño.
- Contratación de asesoría clínica para validar guiones y banderas rojas antes de pacientes reales.

## 7. Estado

| WP | Estado |
|---|---|
| WP-00 | ✅ aprobado (commit) — ver `docs/revisiones/WP-00-revision.md` |
| WP-01 | ✅ aprobado (commit) — ver `docs/revisiones/WP-01-revision.md` |
| WP-02 | ✅ aprobado (commit) — ver `docs/revisiones/WP-02-revision.md` |
| WP-04 | ✅ aprobado (commit) — ver `docs/revisiones/WP-04-revision.md` |
| WP-03 | ▶️ siguiente (check-in por voz) |
| WP-05…WP-08 | ⏳ pendiente |

*(El director actualiza esta tabla en cada commit.)*

## 8. Riesgos principales

1. **Coste de voz** — mitigado por ADR-001 (mini + caching + límite de sesión + modo texto).
2. **Calidad del es-ES conversacional con personas mayores** — probar pronto con usuarios reales; parámetros de ritmo/repetición (RF-CV-09).
3. **RGPD/AI Act** — F1 solo bienestar; nada de análisis emocional automatizado; consentimientos granulares desde el día 1; DPA de proveedores antes de pacientes reales.
4. **Alucinaciones del LLM en contenido de salud** — el asistente solo registra y pregunta, no aconseja clínicamente; toda salida estructurada se valida con Zod; banderas rojas por reglas deterministas, no por el LLM solo.
