/**
 * Plantilla y envío del email de recordatorio de check-in (WP-07).
 *
 * `plantillaRecordatorio` es PURA (texto/HTML en español, tono cálido, con
 * enlace al check-in). `enviarEmailResend` hace la llamada a la API de Resend
 * (`RESEND_API_KEY`); nunca filtra el cuerpo del error del proveedor.
 */

export type PlantillaEmail = { asunto: string; html: string; texto: string };

function primerNombre(nombre: string): string {
  const limpio = (nombre ?? "").trim();
  return limpio.length > 0 ? limpio.split(/\s+/)[0] : "";
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plantillaRecordatorio(
  nombre: string,
  urlCheckin: string,
): PlantillaEmail {
  const saludo = primerNombre(nombre) ? `Hola, ${primerNombre(nombre)}` : "Hola";
  const url = escaparHtml(urlCheckin);
  const asunto = "Tu check-in de hoy con Botsy";

  const texto = [
    `${saludo}:`,
    "",
    "Todavía no has hecho tu check-in de hoy. Cuando tengas un momento, cuéntame cómo te encuentras: es rápido y me ayuda a acompañarte mejor.",
    "",
    `Hacer mi check-in: ${urlCheckin}`,
    "",
    "Si ya lo has hecho, puedes ignorar este mensaje. Cuídate mucho.",
    "— Botsy",
    "",
    "Botsy no diagnostica ni sustituye a tu médico.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#faf9f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:20px;font-weight:700;color:#2563eb;">Botsy</div>
    <div style="background:#ffffff;border:1px solid #e7e2d9;border-radius:16px;padding:24px;margin-top:16px;">
      <p style="font-size:18px;font-weight:600;margin:0 0 12px;">${escaparHtml(saludo)}</p>
      <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#4b5563;">
        Todavía no has hecho tu check-in de hoy. Cuando tengas un momento, cuéntame
        cómo te encuentras: es rápido y me ayuda a acompañarte mejor.
      </p>
      <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 24px;border-radius:12px;">
        Hacer mi check-in
      </a>
      <p style="font-size:14px;line-height:1.6;margin:20px 0 0;color:#6b7280;">
        Si ya lo has hecho, puedes ignorar este mensaje. Cuídate mucho. — Botsy
      </p>
    </div>
    <p style="font-size:13px;color:#6b7280;margin-top:16px;">
      Botsy no diagnostica ni sustituye a tu médico.
    </p>
  </div>
</body></html>`;

  return { asunto, html, texto };
}

/**
 * Envía un email vía Resend. Lanza si falta la clave o si la API responde error
 * (sin filtrar el cuerpo del proveedor). El llamante decide cómo tratar el fallo.
 */
export async function enviarEmailResend(args: {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Falta la variable de entorno RESEND_API_KEY.");
  }
  const remitente =
    process.env.RESEND_FROM && process.env.RESEND_FROM.trim().length > 0
      ? process.env.RESEND_FROM
      : "Botsy <recordatorios@botsy.local>";

  const fetchImpl = args.fetchImpl ?? fetch;
  const respuesta = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: remitente,
      to: [args.para],
      subject: args.asunto,
      html: args.html,
      text: args.texto,
    }),
  });
  if (!respuesta.ok) {
    throw new Error(`Resend respondió con estado ${respuesta.status}.`);
  }
}
