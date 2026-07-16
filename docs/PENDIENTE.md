# Botsy — Qué falta (guía de continuación)

**EMPIEZA AQUÍ** si eres el modelo/agente que continúa el proyecto. Última actualización: 2026-07-16 (pivote oncología).

## Orden de lectura obligatorio

1. [MEMORIA-PROYECTO.md](MEMORIA-PROYECTO.md) — el documento fundacional del fundador: qué es el negocio, quién paga, reglas de oro, roadmap, regla de corte. **Es la autoridad de producto.**
2. [PLAN-TECNICO-PILOTO.md](PLAN-TECNICO-PILOTO.md) — el documento maestro técnico de la fase piloto: matriz reusar/adaptar/construir, modelo de datos, specs por módulo, sprints y puertas.
3. `CLAUDE.md` — convenciones VINCULANTES (incluye las 4 reglas de oro v2: no diagnostica, la IA no conversa con menores, disposición estructurada obligatoria, v1 no predice).
4. [adr/ADR-003](adr/ADR-003-pivote-oncologia.md) (pivote) · [adr/ADR-001](adr/ADR-001-api-de-voz.md) (voz) · [adr/ADR-002](adr/ADR-002-programas-de-monitorizacion.md) (arquitectura de programas; sus plantillas multi-perfil quedaron aparcadas).

## Estado actual

F1 (plataforma conversacional) **completa y subida**: 113 tests en verde, RLS auditada, sin fugas de secretos (detalle en `PLAN-MAESTRO.md` §7 y `revisiones/`). **El producto pivotó a oncología** (mama + pediatría cuidador-proxy; pagador farma/PSP y capitados — NO B2C). No hay proyecto Supabase remoto ni claves: todo se verifica con mocks, y **la demo de venta corre en local sobre seed** (no espera a las claves).

## Trabajo pendiente, en orden (protocolo director/implementador de PLAN-MAESTRO §5)

| Orden | WP | Qué es | Puerta |
|---|---|---|---|
| 1 | [WP-10](wp/WP-10-deuda-tecnica.md) | Deuda técnica de F1 (7 ítems) | Ninguna — programable YA |
| 2 | [WP-11 v2](wp/WP-11-programas-nucleo.md) | Núcleo de programas ONCOLOGÍA (2 programas de mama) + disposición estructurada + vocabulario CTCAE + uso_secundario | Arquitectura: ninguna · Umbrales: llamada 1 (psicooncólogo) → hasta entonces `[PENDIENTE CLÍNICO]` |
| 3 | WP-16 | Termómetro de Distrés NCCN conversacional (spec en PLAN-TECNICO §5; el WP se emite al abrirse la puerta) | Llamada 1 |
| 4 | WP-17 + WP-15 | Dashboard del patrocinador + seed demo oncológico + modo demo · Informe ROI pagador (specs en PLAN-TECNICO §5) | Ninguna — **fin de sprint 2 = demo vendible** |
| 5 | WP-18 | Farmacovigilancia mínima viable (spec en PLAN-TECNICO §5) | Primera LOI farma |
| 6 | WP-19 | Cuidador-proxy pediátrico (spec en PLAN-TECNICO §5) | Asociación/fundación |
| ∥ | [WP-09](wp/WP-09-puesta-en-produccion.md) | Puesta en producción + E2E reales | Claves del fundador (no bloquea la venta) |

**Aparcado (no implementar):** WP-12 (TCC), WP-13 (post-cirugía/fotos — su §3 absorbido por WP-11 v2), WP-14 (Alzheimer), predicción/sugerencias, B2C, pt-BR, push nativas, Expo/HealthKit. Ver cabeceras ⛔ de cada archivo y MEMORIA §8.2.

## Insumos que solo puede aportar el fundador

1. **Las tres llamadas** (MEMORIA §14): psicooncólogo (desbloquea umbrales de WP-11/16), asociación de pacientes (desbloquea WP-19 y las 5 pacientes de la demo), contacto Pfizer/Roche (ruta A). Ventana: antes del 1 de agosto de 2026.
2. **Claves y cuentas** (WP-09): Supabase, OpenAI (texto+Realtime), Resend, Vercel Pro.
3. **Textos legales** (`[PENDIENTE LEGAL]`) y **diligencia RGPD/DPA**; *intended purpose* con consultor regulatorio antes de material comercial.

## Notas operativas

- **Push a GitHub:** `gh auth switch --user rodriguezmartinezlw && git push && gh auth switch --user coprodelidev`.
- Despliegue: `docs/DESPLIEGUE.md` · Desarrollo local: `README.md` · Traspaso general: `docs/RESUMEN-PROYECTO.md`.
