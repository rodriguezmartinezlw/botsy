import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/**
 * Interstitial obligatorio de consentimiento (WP-07).
 *
 * Se muestra cuando el paciente aún no ha otorgado el consentimiento
 * `conversacion`. Explica CON CALMA (regla clínica de tono) por qué es necesario
 * y NO permite conversar: el único camino es ir a otorgar el permiso. Componente
 * presentacional (sin estado); apto para Server Component.
 */
export default function InterstitialConsentimiento() {
  return (
    <section className="flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primario-suave text-primario">
        <ShieldCheck className="h-8 w-8" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-texto">
          Antes de empezar, necesito tu permiso
        </h2>
        <p className="text-base leading-relaxed text-texto-suave">
          Para poder hacer tus check-ins, Botsy necesita guardar el texto de
          vuestras conversaciones y compartirlo con tu profesional. Es lo que nos
          permite hacer tu seguimiento.
        </p>
        <p className="text-base leading-relaxed text-texto-suave">
          Sin ese permiso no puedo conversar contigo. Puedes leer el texto
          completo y decidir con tranquilidad; podrás retirarlo cuando quieras.
        </p>
      </div>
      <Link
        href="/consentimientos"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
      >
        Revisar y dar mi permiso
      </Link>
      <p className="text-sm text-texto-tenue">
        Botsy no diagnostica ni sustituye a tu médico.
      </p>
    </section>
  );
}
