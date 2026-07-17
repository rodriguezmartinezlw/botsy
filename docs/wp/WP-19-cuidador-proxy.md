# WP-19 — Cuidador-proxy pediátrico (oncología pediátrica)

**⛔ PUERTA: compromiso de la asociación/fundación** (MEMORIA §5.2, §8.1 módulo 6, §8.3). Spec base: PLAN-TECNICO-PILOTO §5 WP-19. **Regla de oro 2 (innegociable): la IA JAMÁS conversa con el menor** — el titular de la cuenta y único interlocutor es el cuidador adulto.

## Objetivo

Que un padre/madre haga el check-in por voz SOBRE su hijo en tratamiento oncológico: consentimiento parental + asentimiento del menor según edad, guion 100% en 3ª persona, escalado al equipo hospitalario y al propio cuidador, y cribado del distrés DEL CUIDADOR (valor diferencial para la fundación).

## Diseño clave (distinto del WP-14 aparcado)

En WP-14 (Alzheimer) el paciente adulto era el titular y el cuidador no tenía cuenta. **Aquí es al revés:** el cuidador adulto ES el titular de la cuenta; el menor es el sujeto clínico pero NO usuario. Gate técnico verificado server-side y por test: imposible instanciar una sesión conversacional "como el menor".

## Tareas

1. **Migración (siguiente número):** en `pacientes`: `tipo_sujeto check in ('adulto','menor_proxy') default 'adulto'`, `cuidador_titular_id uuid FK perfiles null` (obligatorio si menor_proxy — constraint). Ampliar `consentimientos.tipo` con `'parental'` y `'asentimiento_menor'`. RLS: el cuidador titular accede a los datos del menor COMO SI fuera el paciente (nueva rama en las políticas: `paciente_id = auth.uid() OR es_cuidador_titular_de(paciente_id)`; helper security definer) — revisar TODAS las políticas de tablas clínicas y añadir la rama en una migración nueva, tabla por tabla, con la matriz actualizada en la entrega.
2. **Gate regla de oro 2** (`src/lib/programas/` o `src/lib/proxy-pediatrico/`): si `tipo_sujeto='menor_proxy'`, toda ruta conversacional (checkin iniciar/mensaje/voz) exige `auth.uid() === cuidador_titular_id` → si no, 403. Test que lo congela.
3. **Consentimientos:** `parental` (obligatorio, lo otorga el titular; sin él no hay check-in del menor) + `asentimiento_menor` registrado según edad (umbral por país `[PENDIENTE LEGAL]`, constante configurable; el texto explica que se pidió el asentimiento al menor). Interstitial propio.
4. **Guion 3ª persona:** `construirContexto` inyecta modo proxy (nombre del menor, edad) → `construirInstrucciones` genera TODO en 3ª persona ("¿Cómo ha pasado la noche ▸nombre◂? ¿Le diste la medicación?"). PROHIBIDO cualquier texto dirigido al menor; test que verifica que las instrucciones generadas no contienen 2ª persona dirigida al niño.
5. **Programa seed `onco_pediatrica_proxy`:** dominios: síntomas del niño (CTCAE pediátrico simplificado `[PENDIENTE CLÍNICO]`), adherencia, fiebre (urgencia en tratamiento activo — reutiliza la regla), y **estado del cuidador** (ánimo/carga del cuidador como dominio propio, con su propia regla de distrés → contactar al equipo).
6. **Escalado:** las alertas del menor van al profesional asignado (equipo hospitalario) Y el aviso de urgencia también al email del cuidador titular (ya es el usuario; trivial).
7. **Panel:** la ficha 360º muestra claramente "Reportado por: ▸cuidador◂ (madre/padre/tutor)" y el estado de consentimientos parental/asentimiento.

## Criterios de aceptación

- Build/lint/test verdes (tests de: gate 403 si no es el titular; instrucciones 100% 3ª persona; consentimiento parental bloqueante; RLS del cuidador titular — matriz actualizada; distrés del cuidador dispara su regla).
- Migraciones validadas; `acceso_cruzado.sql` ampliado con escenario cuidador (lee lo de SU menor, no lo de otro).
- Cero textos de UI dirigidos al menor; umbrales y edades `[PENDIENTE LEGAL]`/`[PENDIENTE CLÍNICO]` configurables.
