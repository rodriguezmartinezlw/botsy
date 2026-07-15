/**
 * Registro best-effort de que el paciente pulsó llamar tras un escalado
 * (RF-ES-06). No bloquea la navegación ni la llamada `tel:`; si falla, se
 * ignora en silencio (el objetivo prioritario es que el paciente llame).
 */
export async function registrarContacto(
  checkinId: string,
  tipo: "medico" | "emergencias",
): Promise<void> {
  try {
    await fetch("/api/escalado/contacto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkinId, tipo }),
      keepalive: true,
    });
  } catch {
    // Silencioso a propósito: no interrumpir al paciente.
  }
}
