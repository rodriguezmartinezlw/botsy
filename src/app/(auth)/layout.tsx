import type { ReactNode } from "react";
import Link from "next/link";
import { HeartPulse } from "lucide-react";

/**
 * Layout del área de acceso (login / registro).
 * Centrado, móvil-first. Sin lógica de sesión (se conecta en WP-01).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-8">
        <Link
          href="/"
          className="flex items-center justify-center gap-2"
          aria-label="Volver al inicio de Botsy"
        >
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primario text-white"
          >
            <HeartPulse className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <span className="text-2xl font-bold text-texto">Botsy</span>
        </Link>

        <main>{children}</main>

        <p className="text-center text-sm text-texto-tenue">
          Botsy no diagnostica ni sustituye a tu médico.
        </p>
      </div>
    </div>
  );
}
