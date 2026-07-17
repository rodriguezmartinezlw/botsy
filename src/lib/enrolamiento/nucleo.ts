/**
 * Enrolamiento de pacientes desde el panel (WP-20 §A) — NÚCLEO PURO y testeable.
 *
 * El modelo PSP (MEMORIA §7) dice que es el PROGRAMA quien enrola: un paciente
 * sin profesional y sin programa queda huérfano. Este módulo orquesta el alta
 * (o la vinculación de un huérfano existente) SOBRE UN "PUERTO" inyectable, de
 * modo que:
 *   - la Server Action construye el puerto real (Auth Admin API + Supabase), y
 *   - los tests inyectan un puerto FALSO (mock del Admin API) sin tocar red.
 *
 * Reglas respetadas aquí:
 *   - Validación Zod de toda la entrada (nombre, email, teléfono, fecha, programa).
 *   - Email ya existente → NO se duplica: se OFRECE vincular (asignar
 *     profesional + programa al paciente existente). La vinculación solo procede
 *     si el paciente está huérfano o ya es de este profesional.
 *   - Nunca revela contraseñas ni datos internos; mensajes amables en español.
 */

import { z } from "zod";

// --- Validación de la entrada -----------------------------------------------

/** Zona con formato HH:MM (00:00–23:59). Compartido con el perfil del paciente. */
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const esquemaEnrolamiento = z
  .object({
    nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
    email: z.string().trim().toLowerCase().email("Correo no válido.").max(200),
    telefono: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+()0-9\s-]*$/, "El teléfono contiene caracteres no válidos.")
      .optional()
      .or(z.literal("")),
    fechaNacimiento: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.")
      .optional()
      .or(z.literal("")),
    programaClave: z.string().trim().min(1, "Elige un programa.").max(80),
    // Cuando el email ya existe, el profesional confirma la vinculación.
    vincularExistente: z.boolean().optional().default(false),
  })
  .strict();

export type EntradaEnrolamiento = z.infer<typeof esquemaEnrolamiento>;

/** Entrada ya validada y normalizada (sin cadenas vacías en los opcionales). */
export type DatosEnrolamiento = {
  nombre: string;
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  programaClave: string;
  vincularExistente: boolean;
};

function normalizar(e: EntradaEnrolamiento): DatosEnrolamiento {
  return {
    nombre: e.nombre,
    email: e.email,
    telefono: e.telefono && e.telefono.length > 0 ? e.telefono : null,
    fechaNacimiento:
      e.fechaNacimiento && e.fechaNacimiento.length > 0 ? e.fechaNacimiento : null,
    programaClave: e.programaClave,
    vincularExistente: e.vincularExistente ?? false,
  };
}

// --- Puerto (dependencias inyectables) --------------------------------------

/** Estado clínico mínimo del paciente existente, para decidir la vinculación. */
export type PacienteExistente = {
  /** Profesional asignado actualmente (null = huérfano). */
  profesionalId: string | null;
  /** ¿La cuenta es realmente de un paciente? (podría ser profesional/patrocinador). */
  esPaciente: boolean;
};

export type PuertoEnrolamiento = {
  /** Busca la cuenta por email; `null` si no existe. */
  buscarUsuarioPorEmail(email: string): Promise<{ id: string } | null>;
  /** Invita por email (Auth Admin API). Crea el usuario; el trigger crea perfil+paciente. */
  invitar(
    email: string,
    meta: { rol: "paciente"; nombre: string },
  ): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
  /** Lee el estado del paciente existente (para decidir vinculación). */
  obtenerPaciente(userId: string): Promise<PacienteExistente | null>;
  /** Asigna profesional (bootstrap) y datos no clínicos opcionales. */
  vincularProfesional(
    userId: string,
    profesionalId: string,
    extra: { telefono: string | null; fechaNacimiento: string | null },
  ): Promise<boolean>;
  /** Asigna el programa elegido y materializa sus reglas clave. */
  asignarPrograma(
    userId: string,
    programaClave: string,
    asignadoPor: string,
  ): Promise<{ ok: boolean; error?: string }>;
  /** Registra un evento de auditoría (actor = profesional). No debe lanzar. */
  auditar(accion: string, entidadId: string, detalle: unknown): Promise<void>;
};

// --- Resultado ---------------------------------------------------------------

export type ResultadoEnrolamiento =
  | { ok: true; estado: "invitado" | "vinculado"; mensaje: string }
  | { ok: false; error: string; emailExiste?: boolean };

const MSG_ERROR_GENERICO =
  "No se pudo dar de alta al paciente. Inténtalo de nuevo.";

// --- Orquestación ------------------------------------------------------------

/**
 * Da de alta (o vincula) a un paciente. `sesionUserId` es el profesional que
 * enrola (ya autorizado por el llamante). Devuelve un resultado discriminado:
 * cuando el email ya existe y no se pidió vincular, marca `emailExiste` para que
 * la UI ofrezca el botón "Vincular".
 */
export async function enrolarPaciente(
  puerto: PuertoEnrolamiento,
  sesionUserId: string,
  entradaValida: EntradaEnrolamiento,
): Promise<ResultadoEnrolamiento> {
  const d = normalizar(entradaValida);

  const existente = await puerto.buscarUsuarioPorEmail(d.email);

  // --- Camino: la cuenta ya existe -----------------------------------------
  if (existente) {
    if (!d.vincularExistente) {
      return {
        ok: false,
        emailExiste: true,
        error:
          "Ya hay una cuenta con ese correo. Puedes vincularla a tu programa en lugar de crear una nueva.",
      };
    }

    const paciente = await puerto.obtenerPaciente(existente.id);
    if (!paciente || !paciente.esPaciente) {
      return {
        ok: false,
        error: "Ese correo pertenece a una cuenta que no es de paciente.",
      };
    }
    if (
      paciente.profesionalId !== null &&
      paciente.profesionalId !== sesionUserId
    ) {
      return {
        ok: false,
        error: "Ese paciente ya está vinculado a otro profesional.",
      };
    }

    const vinculado = await puerto.vincularProfesional(existente.id, sesionUserId, {
      telefono: d.telefono,
      fechaNacimiento: d.fechaNacimiento,
    });
    if (!vinculado) return { ok: false, error: MSG_ERROR_GENERICO };

    const prog = await puerto.asignarPrograma(
      existente.id,
      d.programaClave,
      sesionUserId,
    );
    // Si ya tenía un programa activo, la vinculación del profesional es válida
    // igualmente: no es un fallo de alta, solo no se reasigna el programa.
    await puerto.auditar("paciente_vinculado", existente.id, {
      email: d.email,
      programa: d.programaClave,
      programa_asignado: prog.ok,
    });
    return {
      ok: true,
      estado: "vinculado",
      mensaje: prog.ok
        ? "Paciente vinculado a tu programa."
        : "Paciente vinculado (ya tenía un programa activo).",
    };
  }

  // --- Camino: alta nueva por invitación -----------------------------------
  const invitacion = await puerto.invitar(d.email, {
    rol: "paciente",
    nombre: d.nombre,
  });
  if (!invitacion.ok) {
    return { ok: false, error: invitacion.error || MSG_ERROR_GENERICO };
  }

  const vinculado = await puerto.vincularProfesional(invitacion.userId, sesionUserId, {
    telefono: d.telefono,
    fechaNacimiento: d.fechaNacimiento,
  });
  if (!vinculado) return { ok: false, error: MSG_ERROR_GENERICO };

  const prog = await puerto.asignarPrograma(
    invitacion.userId,
    d.programaClave,
    sesionUserId,
  );
  if (!prog.ok) {
    return {
      ok: false,
      error: prog.error ?? "El paciente se creó, pero no se pudo asignar el programa.",
    };
  }

  await puerto.auditar("paciente_enrolado", invitacion.userId, {
    email: d.email,
    programa: d.programaClave,
  });

  return {
    ok: true,
    estado: "invitado",
    mensaje:
      "Invitación enviada. El paciente recibirá un correo para crear su contraseña.",
  };
}

export const HORA_CHECKIN_RE = HORA_RE;
