# Botsy — Accesos y guion de prueba humana

**Actualizado:** 2026-07-17 · Usuarios verificados contra la BD real. ⚠️ Son credenciales DEMO (están en el seed público del repo): **rotar/eliminar antes de datos reales** (nota en WP-09).

## Arrancar la app

```bash
cd C:\Users\PROPIETARIO\Desktop\projects\botsy
npm run dev
```
→ abre **http://localhost:3000** (el `.env.local` ya apunta a la BD real y a OpenAI).

**EN PRODUCCIÓN (Vercel, 2026-07-17):** la app está desplegada en **https://botsy-bice.vercel.app** — mismas credenciales, misma BD. Puedes probar directamente desde el móvil (ideal para la voz y el QA visual).

- **Modo demo del patrocinador sin login** (para ensayar la venta): `DEMO_MODE=true npm run dev` → http://localhost:3000/patrocinador (marca de agua "DEMO"). Guion de 10 min: `docs/DEMO-GUION.md`.

## Credenciales (contraseña común: `Botsy1234!`)

| Rol | Email | Qué es |
|---|---|---|
| **Paciente** (terapia oral) | `maria@botsy.local` | María — programa «Terapia oral» (Clínica Oncológica Lima). También: carmen, elena, lucia, pilar, rosa |
| **Paciente** (tratamiento activo) | `beatriz@botsy.local` | Beatriz — programa «Tratamiento activo» (fiebre ≥38 → urgencia). También: isabel, nuria, sofia |
| **Paciente** (otra institución) | `marta@botsy.local` | Marta — Centro Oncológico Norte (del Dr. Ruiz) |
| **Profesional** | `dra.garcia@botsy.local` | Dra. García — Clínica Oncológica Lima (ve a las 10 pacientes de A) |
| **Profesional** | `dr.ruiz@botsy.local` | Dr. Ruiz — Centro Oncológico Norte (ve SOLO a Marta) |
| **Profesional multi-institución** | `dr.vega@botsy.local` | Dr. Vega — trabaja en A y B (ve ambas) |
| **Patrocinador** (farma) | `patrocinador@botsy.local` | Solo agregados anonimizados k≥5 |
| **Admin** | `admin@botsy.local` | Todo + consola de administración en **/admin** (instituciones, profesionales, membresías) |

## Guion de prueba sugerido (≈30 min)

### 1. Como PACIENTE (maria@botsy.local) — el corazón del producto
1. Login → Inicio: racha, estado del check-in de hoy.
2. **Check-in por TEXTO**: conversa de verdad (usa tu clave de OpenAI; coste céntimos). Prueba: "hoy me tomé la pastilla por la mañana y me duele un poco la cabeza, un 4" → verás que NO repregunta lo ya dicho y sigue con lo pendiente; los chips de dominios se van marcando.
3. **Escalado**: di "he tenido fiebre, 38 y medio" → tarjeta calmada de contactar al médico (en María/terapia oral es `contactar`; con `beatriz@` la misma fiebre es `urgencia` con pantalla dedicada — pruébalo también).
4. Termina el check-in → resumen + racha + recomendación.
5. **Check-in por VOZ** (primera prueba real con micrófono — Chrome/Edge, permite el micro): botón "hablar", subtítulos en vivo, cuelga → cierre. *Si algo del protocolo Realtime falla, anótalo: es el riesgo conocido de WP-03 y se ajusta rápido.*
6. Perfil: edita tu teléfono y la hora del recordatorio; mira los gráficos; entra a "Mis consentimientos" y revoca la grabación de voz (la siguiente sesión de voz no grabará).
7. En /login prueba "¿Olvidaste tu contraseña?" (el correo sale del mailer de Supabase; con dominios `.local` no llegará — pruébalo enrolando un paciente con TU email real, punto 2 del profesional).

### 2. Como PROFESIONAL (dra.garcia@botsy.local)
1. Pacientes: lista con semáforo (verás la alerta que dejó tu prueba de fiebre arriba).
2. **Bandeja de alertas**: abre la alerta → resolver → verás que EXIGE disposición estructurada (decisión + motivo + días de seguimiento). En "Desenlaces" aparecerá cuando venza.
3. Ficha 360º de María: línea temporal (tu conversación entera), tendencias, termómetro de distrés, medicación (discontinúa una pauta con motivo), pestaña Programa.
4. **Enrola un paciente nuevo con TU email real** → te llegará la invitación (revisa spam; el mailer de Supabase es limitado) → crea contraseña → consentimiento → check-in. Es el flujo completo del PSP.
5. Sal y entra como `dr.ruiz@` → verás SOLO a Marta (aislamiento por institución). Como `dr.vega@` → ves ambas instituciones con el filtro.

### 3. Como PATROCINADOR (patrocinador@botsy.local)
- Dashboard: persistencia, adherencia, motivos de discontinuación, tasa de check-in — todo agregado, sin nombres. Informe ROI imprimible. Verás "datos insuficientes" donde la cohorte es <5 (k-anonimato).

### 4. Como ADMIN (admin@botsy.local)
- Ve TODO el panel y además **Administración** (/admin): crea una institución nueva (p. ej. "Clínica Nueva", CO), invita a un profesional por email (usa un email real tuyo para recibirla), asígnale la membresía, y revisa "Pacientes sin institución". Con eso, ese profesional ya puede entrar y enrolar pacientes en su clínica: el ciclo operativo completo.

## Qué NO va a funcionar aún (esperado)

- **Emails de recordatorio diario y aviso de urgencia al profesional**: falta `RESEND_API_KEY`. (Invitación y recuperación SÍ funcionan, van por Supabase.)
- Los emails `@botsy.local` no reciben correo (usa tu email real para probar invitación/recuperación).
- Los umbrales clínicos usan los valores ESTÁNDAR de guías (NCCN/IDSA/CTCAE) y los textos legales la versión genérica v1 — ambos configurables; revisión experta recomendable antes de pacientes reales.
- El cron de recordatorios corre 1 vez/día (20:00 UTC) — el horario requiere plan Pro de Vercel.

## Si algo falla

Anota pantalla + qué hiciste + hora. Los logs del dev server salen en la terminal. La BD se puede inspeccionar en https://supabase.com/dashboard/project/hjkvmhccgorphhykoarg.
