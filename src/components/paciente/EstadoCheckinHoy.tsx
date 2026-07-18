import Link from "next/link";
import { CheckCircle2, CircleDashed, PauseCircle } from "lucide-react";
import type { EstadoCheckin } from "@/types/db";

/**
 * Estado del check-in de HOY, mostrado en Inicio bajo el aviso legal
 * (feedback del fundador, 2026-07-18: "si no he completado mi check-in o lo he
 * hecho parcialmente, eso debería aparecer también en la pantalla de inicio").
 *
 * Tres estados: sin empezar, a medias (en_curso) y completado. Los dos primeros
 * llevan a retomarlo; el completado solo confirma. Tono calmado, no alarmista;
 * texto ≥16px y área táctil amplia (perfil geriátrico). Presentacional.
 */
export default function EstadoCheckinHoy({
  estado,
}: {
  estado: EstadoCheckin | null;
}) {
  const completado = estado === "completado";
  const enCurso = estado === "en_curso";

  const config = completado
    ? {
        color: "var(--color-acento-fuerte)",
        Icono: CheckCircle2,
        titulo: "Check-in de hoy completado",
        detalle: "Gracias por registrarte hoy. Aquí estoy si me necesitas.",
      }
    : enCurso
      ? {
          color: "var(--color-vigilancia)",
          Icono: PauseCircle,
          titulo: "Tu check-in de hoy está a medias",
          detalle: "Lo dejaste sin terminar. Puedes retomarlo cuando quieras.",
        }
      : {
          color: "var(--color-vigilancia)",
          Icono: CircleDashed,
          titulo: "Aún no has hecho tu check-in de hoy",
          detalle: "Es tu conversación diaria conmigo. No lleva más que unos minutos.",
        };

  const { color, Icono, titulo, detalle } = config;

  return (
    <section
      aria-label="Estado de tu check-in de hoy"
      className="flex items-start gap-3 rounded-[var(--radius-lg)] border-2 bg-superficie p-5"
      style={{ borderColor: color }}
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center"
        style={{ color }}
      >
        <Icono className="h-7 w-7" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-texto">{titulo}</p>
        <p className="text-base text-texto-suave">{detalle}</p>
        {!completado && (
          <Link
            href="/checkin"
            className="mt-1 inline-flex min-h-11 items-center text-base font-semibold text-primario underline-offset-4 hover:underline"
          >
            {enCurso ? "Retomar mi check-in" : "Empezar ahora"}
          </Link>
        )}
      </div>
    </section>
  );
}
