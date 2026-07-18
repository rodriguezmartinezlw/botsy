/**
 * Diagnóstico de fallos de micrófono (feedback del fundador probando en móvil,
 * 2026-07-18) — módulo PURO y testeable, seguro para cliente.
 *
 * En el mundo real el micrófono falla de MUCHAS formas distintas y cada una
 * tiene un remedio diferente. El caso que motivó esto: Android bloquea el
 * diálogo de permiso cuando otra app "se dibuja encima" de la pantalla
 * (burbujas de chat, filtros de luz azul/nocturna, grabadores) — Chrome muestra
 * «este sitio web no puede solicitarte permiso…». Aquí se mapea cada error a un
 * título claro + pasos concretos en español sencillo (población 45–75 años).
 * SIEMPRE queda la salida "prefiero escribir" (la maneja la pantalla).
 */

export type DiagnosticoMicrofono = {
  titulo: string;
  pasos: string[];
  /** Si tiene sentido ofrecer el botón "Reintentar". */
  reintentable: boolean;
};

const PASOS_PERMISO: string[] = [
  "Si el teléfono dice que «no puede solicitarte permiso»: cierra las apps que se dibujan encima de la pantalla (burbujas de chat, filtros de luz nocturna, grabadores de pantalla) y vuelve a intentarlo.",
  "Si negaste el permiso antes: toca el candado 🔒 junto a la dirección de la página → Permisos → Micrófono → Permitir.",
  "Si no aparece la opción, entra en los Ajustes del navegador → Configuración de sitios → Micrófono, y permite este sitio.",
  "Después, pulsa «Reintentar».",
];

/** Traduce el error de `getUserMedia`/permisos a un diagnóstico accionable. */
export function explicarErrorMicrofono(err: unknown): DiagnosticoMicrofono {
  const nombre =
    (typeof err === "object" && err !== null && "name" in err
      ? String((err as { name?: unknown }).name)
      : "") || "";

  switch (nombre) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        titulo: "El navegador no me deja usar el micrófono",
        pasos: PASOS_PERMISO,
        reintentable: true,
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        titulo: "No encuentro ningún micrófono en este dispositivo",
        pasos: [
          "Comprueba que el dispositivo tiene micrófono y que no está desactivado.",
          "Si usas auriculares, prueba a conectarlos y desconectarlos.",
          "Mientras tanto, puedes escribirme con el chat de texto.",
        ],
        reintentable: true,
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        titulo: "Otra aplicación está usando el micrófono",
        pasos: [
          "Cierra las llamadas o videollamadas activas (teléfono, WhatsApp, Meet…).",
          "Cierra las apps de grabación de voz.",
          "Después, pulsa «Reintentar».",
        ],
        reintentable: true,
      };
    case "OverconstrainedError":
    case "AbortError":
      return {
        titulo: "El micrófono se interrumpió",
        pasos: ["Pulsa «Reintentar». Si sigue fallando, prueba el chat de texto."],
        reintentable: true,
      };
    default:
      return {
        titulo: "No pude acceder al micrófono",
        pasos: [
          "Pulsa «Reintentar».",
          "Si sigue fallando, revisa el permiso del micrófono en el candado 🔒 junto a la dirección.",
          "Recuerda que siempre puedes escribirme con el chat de texto.",
        ],
        reintentable: true,
      };
  }
}

/**
 * Comprobación PREVIA (sin disparar el prompt): detecta de antemano el
 * navegador incompatible, el contexto no seguro y el permiso ya denegado, para
 * dar instrucciones sin un fallo confuso. `null` = todo listo para intentar.
 */
export async function comprobarSoporteMicrofono(nav: {
  mediaDevices?: { getUserMedia?: unknown };
  permissions?: { query?: (d: { name: string }) => Promise<{ state: string }> };
  esContextoSeguro: boolean;
}): Promise<DiagnosticoMicrofono | null> {
  if (!nav.esContextoSeguro) {
    return {
      titulo: "Esta página necesita una conexión segura para usar el micrófono",
      pasos: ["Abre la aplicación desde su dirección https:// oficial."],
      reintentable: false,
    };
  }
  if (!nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== "function") {
    return {
      titulo: "Este navegador no permite usar el micrófono",
      pasos: [
        "Abre la aplicación en Chrome, Edge o Safari actualizados.",
        "Si estás dentro del navegador de otra app (p. ej. el de WhatsApp o Instagram), toca ⋮ y elige «Abrir en el navegador».",
        "Mientras tanto, puedes escribirme con el chat de texto.",
      ],
      reintentable: false,
    };
  }
  try {
    const q = nav.permissions?.query;
    if (q) {
      const estado = await q({ name: "microphone" });
      if (estado.state === "denied") {
        return {
          titulo: "El permiso del micrófono está bloqueado para este sitio",
          pasos: PASOS_PERMISO,
          reintentable: true,
        };
      }
    }
  } catch {
    // Permissions API no disponible o sin soporte para 'microphone': se intenta
    // igualmente (el error real, si llega, pasa por explicarErrorMicrofono).
  }
  return null;
}
