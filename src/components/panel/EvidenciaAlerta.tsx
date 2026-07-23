import type { Json } from "@/types/db";

/**
 * Render legible y DEFENSIVO de la evidencia (JSONB) de una alerta (WP-06).
 * La evidencia la escribe el motor de escalado (WP-04): `detalle[]`,
 * `observaciones[]`, `senales[]`, `mensajes[]`, y en el seed también `fragmento`.
 * Se valida cada campo antes de usarlo (nunca se confía en la forma del JSON).
 */
function normalizarTextoBusqueda(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mensajeCoincideConSenal(
  mensaje: string,
  senalesSinRegla: Array<Record<string, unknown>>,
): boolean {
  const texto = normalizarTextoBusqueda(mensaje);
  if (!texto) return false;
  return senalesSinRegla.some((senal) => {
    const codigo = typeof senal.codigo === "string" ? senal.codigo : "";
    const descripcion =
      typeof senal.descripcion === "string" ? senal.descripcion : "";
    const evidenciaTextual =
      typeof senal.evidenciaTextual === "string" ? senal.evidenciaTextual : "";
    const candidatos = [codigo, descripcion, evidenciaTextual].filter(Boolean);
    return candidatos.some((c) => {
      const normalizado = normalizarTextoBusqueda(c);
      return normalizado.length > 0 && texto.includes(normalizado);
    });
  });
}

export default function EvidenciaAlerta({ evidencia }: { evidencia: Json }) {
  if (!evidencia || typeof evidencia !== "object" || Array.isArray(evidencia)) {
    return <p className="text-sm text-texto-suave">Sin evidencia adjunta.</p>;
  }
  const e = evidencia as Record<string, Json | undefined>;
  const detalle = Array.isArray(e.detalle) ? e.detalle : [];
  const observaciones = Array.isArray(e.observaciones) ? e.observaciones : [];
  const mensajes = Array.isArray(e.mensajes) ? e.mensajes : [];
  const senales = Array.isArray(e.senales) ? e.senales : [];
  const senalesSinRegla = Array.isArray(e.senales_sin_regla)
    ? (e.senales_sin_regla as Array<Record<string, Json | undefined>>)
    : [];
  const fragmento = typeof e.fragmento === "string" ? e.fragmento : null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {detalle.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-texto-suave">
          {detalle.map((d, i) => (
            <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
          ))}
        </ul>
      ) : null}

      {observaciones.length > 0 || senales.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {observaciones.map((o, i) => {
            const rec =
              o && typeof o === "object" && !Array.isArray(o)
                ? (o as Record<string, Json | undefined>)
                : {};
            const dominio = typeof rec.dominio === "string" ? rec.dominio : "";
            const codigo = typeof rec.codigo === "string" ? rec.codigo : "";
            const valor = rec.valor_num;
            return (
              <span
                key={`o-${i}`}
                className="rounded-full bg-superficie-suave px-2.5 py-0.5 text-sm text-texto-suave"
              >
                {dominio}
                {codigo ? ` · ${codigo}` : ""}
                {typeof valor === "number" ? `: ${valor}` : ""}
              </span>
            );
          })}
          {senales.map((s, i) =>
            typeof s === "string" ? (
              <span
                key={`s-${i}`}
                className="rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-sm text-[#b91c1c]"
              >
                señal: {s}
              </span>
            ) : null,
          )}
        </div>
      ) : null}

      {fragmento ? (
        <blockquote className="border-l-2 border-primario/40 pl-3 italic text-texto-suave">
          “{fragmento}”
        </blockquote>
      ) : null}

      {mensajes.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-texto-tenue">
            Conversación
          </span>
          {mensajes.map((m, i) => {
            const rec =
              m && typeof m === "object" && !Array.isArray(m)
                ? (m as Record<string, Json | undefined>)
                : {};
            const rol = typeof rec.rol === "string" ? rec.rol : "";
            const contenido =
              typeof rec.contenido === "string" ? rec.contenido : "";
            const resaltado = mensajeCoincideConSenal(
              contenido,
              senalesSinRegla,
            );
            return (
              <p
                key={`m-${i}`}
                className={`rounded-md px-2 py-1 text-texto-suave ${
                  resaltado ? "bg-[#fee2e2] text-[#b91c1c]" : ""
                }`}
              >
                <span className="font-semibold">
                  {rol === "paciente" ? "Paciente" : "Botsy"}:
                </span>{" "}
                {contenido}
              </p>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
