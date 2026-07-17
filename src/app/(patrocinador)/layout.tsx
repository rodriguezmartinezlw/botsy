import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, FileText, HeartPulse } from "lucide-react";
import { modoDemo } from "@/lib/demo";
import { obtenerSesionPatrocinador } from "@/lib/patrocinador/sesion-patrocinador";
import MarcaDemo from "@/components/patrocinador/MarcaDemo";

/**
 * Layout del área del PATROCINADOR (WP-17). Contiene únicamente agregados
 * pseudonimizados; cero datos identificables (garantía real: RLS 0009 + RPC
 * 0010, no este layout).
 *
 * Route guard: solo rol `patrocinador` o `admin`. En MODO DEMO (`DEMO_MODE`) no
 * se exige sesión — el dashboard corre en LOCAL sin claves sobre el seed
 * sintético, con marca de agua.
 */
export default async function PatrocinadorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const demo = modoDemo();
  if (!demo) {
    const sesion = await obtenerSesionPatrocinador();
    if (!sesion) redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      {demo ? <MarcaDemo /> : null}
      <header
        data-no-print
        className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-borde bg-superficie px-6 py-4"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-primario text-white"
          >
            <HeartPulse className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold text-texto">Botsy</span>
          <span className="text-sm text-texto-tenue">· Patrocinador</span>
        </div>
        <nav aria-label="Secciones del patrocinador" className="flex gap-2">
          <Link
            href="/patrocinador"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-base font-medium text-texto-suave hover:bg-superficie-suave hover:text-texto"
          >
            <BarChart3 className="h-5 w-5" aria-hidden />
            Dashboard
          </Link>
          <Link
            href="/patrocinador/roi"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-base font-medium text-texto-suave hover:bg-superficie-suave hover:text-texto"
          >
            <FileText className="h-5 w-5" aria-hidden />
            Informe ROI
          </Link>
        </nav>
      </header>
      <main className="relative z-10 flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
