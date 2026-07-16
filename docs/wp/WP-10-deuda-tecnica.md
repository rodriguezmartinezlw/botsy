# WP-10 — Deuda técnica consciente de F1

**Depende de:** F1 completo · **Programable YA** (sin claves ni cuentas) · Origen: notas del director en `docs/revisiones/WP-01..08-revision.md`.

## Ítems (todos con test que lo demuestre)

1. **`desactivada_en` en pautas** *(de WP-06-revisión)*. Migración nueva: `pautas_medicacion.desactivada_en timestamptz null`; escribirla al desactivar (Server Action del panel) y mostrar el evento fechado ("Pauta X desactivada") en la línea temporal de la ficha 360º.
2. **Endurecer INSERT de auditoría** *(de WP-08-entrega)*. Migración nueva: la política de INSERT de `eventos_auditoria` para autenticados exige `actor_id = auth.uid()` (el motor service-role no se ve afectado: salta RLS con `actor_id null` = sistema). Actualizar el test estático de la matriz (`src/lib/seguridad/auditoria.test.ts`).
3. **Dedup de informes** *(de WP-07-revisión)*. Separar render de persistencia: el informe se renderiza siempre; solo se persiste en `informes` con una acción explícita "Guardar informe" (auditada). Evita una fila por cada recarga.
4. **Validador de cifras: números en letras** *(de WP-07-revisión)*. Extender `validarResumenSinCifrasInventadas` con un mapa básico es-ES ("uno"…"noventa y nueve", "cien", "mil") → si aparece un número en letras que no esté entre las cifras permitidas, descartar. Test con "cuarenta y dos".
5. **Notificación inmediata al profesional en URGENCIA (RF-ES-03)** *(cierre del requisito; hoy solo se crea la fila `alertas`)*. Al materializar una alerta de nivel `urgencia` (en `/mensaje`, `/voz/tool` o cierre), enviar email al profesional asignado vía Resend (plantilla sobria con enlace a la bandeja; sin datos clínicos sensibles en el asunto). Best-effort + auditado + sin duplicar (una vez por alerta). Reutilizar el módulo de email de WP-07.
6. **Sesión: preservar destino en navegaciones server directas** *(de WP-08-entrega)*. Proxy/middleware ligero SOLO para rutas de página (en Next 16 no intercepta `/api`, y la autorización de API sigue dentro de cada handler — no tocarla): redirigir a `/login?next=<ruta>` saneado.
7. **`npm audit` documentado** *(de WP-02/08)*. Verificar estado actual de las 2 moderadas (cadena `next`/`postcss`, build-only). NO aplicar `audit fix --force` (haría downgrade de Next). Si existe versión de Next 16.x que las resuelva, proponer el bump en la entrega (sin aplicarlo si cambia major).

## Opcionales (solo si el resto queda verde y con tiempo)

- RPC transaccional para el cierre del check-in (atomicidad estricta; hoy best-effort documentado).
- SSE en el último turno del chat (mejora percibida de latencia).

## Criterios de aceptación

- `npm run build`, `npm run lint`, `npm test` verdes (no romper los 113 existentes; añadir tests de los ítems 1–6).
- Migraciones nuevas validadas (libpg_query como en WP-01/06/07); ninguna migración commiteada editada.
- Entrega en `docs/wp/entregas/WP-10-entrega.md` con el checklist ítem a ítem (qué, dónde, test que lo cubre).
