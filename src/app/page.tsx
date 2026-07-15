import Link from "next/link";
import { HeartPulse, Stethoscope } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <span
              aria-hidden
              className="flex h-20 w-20 items-center justify-center rounded-[var(--radius-xl)] bg-primario text-white shadow-sm"
            >
              <HeartPulse className="h-11 w-11" strokeWidth={2.2} />
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-texto">
              Botsy
            </h1>
            <p className="text-xl leading-relaxed text-texto-suave">
              Tu asistente de salud que te escucha cada día.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <Link
              href="/login"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
            >
              <HeartPulse className="h-5 w-5" aria-hidden />
              Soy paciente
            </Link>
            <Link
              href="/login?rol=profesional"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-lg font-semibold text-primario transition-colors hover:bg-primario-suave"
            >
              <Stethoscope className="h-5 w-5" aria-hidden />
              Soy profesional
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center">
        <p className="mx-auto max-w-md text-base text-texto-tenue">
          Botsy no diagnostica ni sustituye a tu médico.
        </p>
      </footer>
    </div>
  );
}
