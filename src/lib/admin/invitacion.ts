/**
 * Invitación de PROFESIONALES desde la consola de administración (WP-23 §3) —
 * NÚCLEO PURO y testeable.
 *
 * Reutiliza el patrón del enrolamiento de pacientes (WP-20, `enrolamiento/nucleo`):
 * orquesta el alta de un profesional SOBRE UN "PUERTO" inyectable, de modo que:
 *   - la Server Action construye el puerto real (Auth Admin API + Supabase), y
 *   - los tests inyectan un puerto FALSO (mock del Admin API) sin tocar red.
 *
 * A diferencia del paciente, aquí NO hay fila de paciente ni programa: se invita
 * con `raw_user_meta_data {rol:'profesional', nombre}` y el trigger
 * `gestionar_nuevo_usuario` (0001) crea SÓLO el perfil (verificado: con rol
 * 'profesional' no inserta en `pacientes`). La membresía institución↔profesional
 * se asigna en un paso posterior (acción `asignarMembresia`).
 *
 * Reglas respetadas: validación Zod estricta; el email ya existente NO se duplica
 * (se informa, sin crear una segunda cuenta); mensajes sobrios en español; nunca
 * revela datos internos.
 */

import { z } from "zod";

// --- Validación de la entrada -----------------------------------------------

export const esquemaInvitarProfesional = z
  .object({
    nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
    email: z.string().trim().toLowerCase().email("Correo no válido.").max(200),
  })
  .strict();

export type EntradaInvitarProfesional = z.infer<typeof esquemaInvitarProfesional>;

// --- Puerto (dependencias inyectables) --------------------------------------

export type PuertoInvitacionProfesional = {
  /** Busca la cuenta por email; `null` si no existe. */
  buscarUsuarioPorEmail(email: string): Promise<{ id: string } | null>;
  /** Invita por email (Auth Admin API). Crea el usuario; el trigger crea el perfil. */
  invitar(
    email: string,
    meta: { rol: "profesional"; nombre: string },
  ): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
  /** Lee el rol de una cuenta existente (para informar sin duplicar). */
  obtenerRol(userId: string): Promise<string | null>;
  /** Registra un evento de auditoría (actor = admin). No debe lanzar. */
  auditar(accion: string, entidadId: string, detalle: unknown): Promise<void>;
};

// --- Resultado ---------------------------------------------------------------

export type ResultadoInvitacionProfesional =
  | { ok: true; userId: string; mensaje: string }
  | { ok: false; error: string };

const MSG_ERROR_GENERICO =
  "No se pudo invitar al profesional. Inténtalo de nuevo.";

// --- Orquestación ------------------------------------------------------------

/**
 * Invita a un profesional por email. `adminUserId` es el administrador que
 * ejecuta (ya autorizado por el llamante). Si el email ya pertenece a una
 * cuenta, NO crea otra: informa (y distingue si esa cuenta ya es profesional).
 */
export async function invitarProfesional(
  puerto: PuertoInvitacionProfesional,
  adminUserId: string,
  entradaValida: EntradaInvitarProfesional,
): Promise<ResultadoInvitacionProfesional> {
  const email = entradaValida.email;
  const nombre = entradaValida.nombre;

  const existente = await puerto.buscarUsuarioPorEmail(email);
  if (existente) {
    const rol = await puerto.obtenerRol(existente.id);
    if (rol === "profesional") {
      return {
        ok: false,
        error:
          "Ya hay un profesional con ese correo. Asígnale una institución desde la lista.",
      };
    }
    return {
      ok: false,
      error: "Ya existe una cuenta con ese correo; no se puede reutilizar.",
    };
  }

  const invitacion = await puerto.invitar(email, { rol: "profesional", nombre });
  if (!invitacion.ok) {
    return { ok: false, error: invitacion.error || MSG_ERROR_GENERICO };
  }

  await puerto.auditar("profesional_invitado", invitacion.userId, {
    email,
    nombre,
    invitado_por: adminUserId,
  });

  return {
    ok: true,
    userId: invitacion.userId,
    mensaje:
      "Invitación enviada. El profesional recibirá un correo para crear su contraseña.",
  };
}
