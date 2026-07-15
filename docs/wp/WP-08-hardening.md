# WP-08 — Hardening y preparación de salida

**Depende de:** todos los anteriores · **Funcional:** v0.2 §9 (parte F1)

## Objetivo

Auditoría transversal antes del primer despliegue: seguridad, accesibilidad, robustez, semilla de demo y documentación de despliegue. Este WP no añade features.

## Tareas

1. **Auditoría de seguridad**
   - Test de acceso cruzado (script o tests de integración): paciente A no lee datos de paciente B por ninguna API ni consulta; profesional no asignado no lee al paciente; anónimo no lee nada. Documenta cada caso probado.
   - `grep` del código y del bundle: ninguna clave, ningún uso de `admin.ts` fuera de servidor, ningún `service_role` en cliente.
   - Revisión de TODOS los Route Handlers: sesión comprobada dentro (regla Next 16), validación Zod del body, errores sin stack traces.
   - RLS: repasa política por política contra la matriz de acceso de WP-01; toda corrección = migración nueva.
2. **Robustez**
   - Estados de error y vacío en todas las pantallas (sin env de OpenAI, sin datos, sin red en el chat/voz — mensajes en español, amables).
   - Manejo de sesión expirada (redirección a login conservando destino).
3. **Accesibilidad (perfil geriátrico)**
   - Recorrido con teclado en app de paciente; `aria-label` en botones de icono; contraste AA con el tema; fuente base ≥16px verificada; targets táctiles ≥44px en la navegación del paciente.
4. **Contenido**
   - Disclaimers presentes: landing, cierre de check-in con riesgo, informe, pantalla de urgencia (`[PENDIENTE LEGAL]` donde falte texto jurídico real).
   - Revisión de todos los textos: español correcto, tono cálido, cero jerga técnica de cara al paciente.
5. **Demo y despliegue**
   - `supabase/seed.sql` ampliado a demo completa y coherente (60 días de Luis con tendencias creíbles, alertas variadas en distintos estados).
   - `docs/DESPLIEGUE.md`: pasos exactos — crear proyecto Supabase, aplicar migraciones en orden, seed, variables en Vercel (lista completa desde `.env.example`), cron, primer usuario admin.
   - `README.md`: sección "Desarrollo local" (env, comandos).
6. **Calidad final:** `npm run build`, `npm run lint`, `npm test` verdes; elimina código muerto y TODOs resueltos (los TODOs de fases futuras se quedan, etiquetados `TODO F2:`/`F3:`).

## Criterios de aceptación

- Los 3 comandos verdes y la entrega incluye la matriz de acceso probada (caso → esperado → resultado).
- Checklist completo del punto 1–5 en la entrega, con hallazgos corregidos listados (qué, dónde, cómo).
- `docs/DESPLIEGUE.md` ejecutable por una persona sin contexto.
