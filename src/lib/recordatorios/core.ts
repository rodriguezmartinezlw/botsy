/**
 * Núcleo del recordatorio diario de check-in (WP-07, RF-CV-07 versión ligera F1)
 * — módulo PURO (sin Supabase, sin Resend, sin `next`).
 *
 * Contiene:
 *  - `autorizarCron`: valida la cabecera `Authorization: Bearer <CRON_SECRET>`.
 *  - `debeRecordar`: decide por paciente si procede recordar (hora pasada en su
 *    zona horaria y sin check-in hoy).
 *  - `procesarRecordatorios`: recorre los candidatos, evita reenvíos y delega el
 *    envío/registro en dependencias INYECTADAS (para test sin red).
 *
 * La ruta `GET /api/cron/recordatorios` cablea las implementaciones reales
 * (Supabase service-role + Resend); estos tests demuestran la aceptación sin
 * infraestructura remota.
 */

// --- Autorización ------------------------------------------------------------

/**
 * ¿La petición del cron está autorizada? Requiere `Authorization: Bearer S`
 * donde `S` coincide EXACTAMENTE con el `CRON_SECRET` configurado. Si el secreto
 * no está configurado, o la cabecera falta o no coincide, NO autoriza.
 */
export function autorizarCron(
  authHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || secret.trim().length === 0) return false;
  if (!authHeader) return false;
  const esperado = `Bearer ${secret}`;
  // Comparación de longitud fija primero (no es secreto de alto valor, pero
  // evita cortocircuitos triviales).
  if (authHeader.length !== esperado.length) return false;
  return authHeader === esperado;
}

// --- Decisión por paciente ---------------------------------------------------

/** Fecha local "yyyy-MM-dd" en una zona horaria dada. */
export function fechaLocal(zona: string, ahora: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ahora);
  } catch {
    return ahora.toISOString().slice(0, 10);
  }
}

/** Minutos desde medianoche en la hora local de una zona. */
function minutosLocales(zona: string, ahora: Date): number {
  try {
    const partes = new Intl.DateTimeFormat("en-GB", {
      timeZone: zona,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(ahora);
    const h = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(partes.find((p) => p.type === "minute")?.value ?? "0");
    // Intl puede devolver "24" a medianoche en en-GB; normalizamos.
    return ((h % 24) * 60 + m) % (24 * 60);
  } catch {
    return ahora.getUTCHours() * 60 + ahora.getUTCMinutes();
  }
}

/** Convierte "HH:MM[:SS]" a minutos desde medianoche. */
function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

export type EntradaRecordatorio = {
  pacienteId: string;
  nombre: string;
  zona: string;
  /** Hora de check-in "HH:MM:SS" (columna `time` de Postgres). */
  horaCheckin: string;
  /** Fechas (yyyy-MM-dd) en las que el paciente YA tiene un check-in. */
  fechasConCheckin: readonly string[];
};

/**
 * Decide si procede recordar a este paciente AHORA: su hora de check-in ya ha
 * pasado en su zona y aún no tiene check-in en su fecha local de hoy.
 */
export function debeRecordar(
  entrada: EntradaRecordatorio,
  ahora: Date,
): { procede: boolean; fecha: string } {
  const fecha = fechaLocal(entrada.zona, ahora);
  const horaPasada =
    minutosLocales(entrada.zona, ahora) >= horaAMinutos(entrada.horaCheckin);
  const tieneCheckinHoy = entrada.fechasConCheckin.includes(fecha);
  return { procede: horaPasada && !tieneCheckinHoy, fecha };
}

// --- Procesamiento (con dependencias inyectadas) -----------------------------

export type DepsRecordatorios = {
  ahora: Date;
  /** ¿Ya se envió recordatorio a este paciente en esta fecha? */
  yaEnviadoHoy: (pacienteId: string, fecha: string) => Promise<boolean>;
  /** Envía el email (Resend en producción; captura en test). */
  enviarEmail: (arg: {
    pacienteId: string;
    nombre: string;
    fecha: string;
  }) => Promise<void>;
  /** Registra el envío en `eventos_auditoria`. */
  registrarEnvio: (pacienteId: string, fecha: string) => Promise<void>;
};

export type ResumenRecordatorios = {
  candidatos: number;
  enviados: number;
  omitidos: number;
  errores: number;
};

export async function procesarRecordatorios(
  entradas: readonly EntradaRecordatorio[],
  deps: DepsRecordatorios,
): Promise<ResumenRecordatorios> {
  let enviados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const entrada of entradas) {
    const { procede, fecha } = debeRecordar(entrada, deps.ahora);
    if (!procede) {
      omitidos += 1;
      continue;
    }
    try {
      if (await deps.yaEnviadoHoy(entrada.pacienteId, fecha)) {
        omitidos += 1;
        continue;
      }
      await deps.enviarEmail({
        pacienteId: entrada.pacienteId,
        nombre: entrada.nombre,
        fecha,
      });
      await deps.registrarEnvio(entrada.pacienteId, fecha);
      enviados += 1;
    } catch {
      errores += 1;
    }
  }

  return { candidatos: entradas.length, enviados, omitidos, errores };
}
