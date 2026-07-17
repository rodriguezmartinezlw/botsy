import type { ReactNode } from "react";

/**
 * Bloques de carga (skeleton) para los `loading.tsx` de segmento (WP-20 §D.2).
 *
 * En conexiones lentas, la navegación SSR pura parecía congelada; estos esqueletos
 * dan retroalimentación inmediata mientras el servidor prepara los datos. La
 * animación respeta `prefers-reduced-motion` (`motion-reduce:animate-none`).
 */

export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-[var(--radius-md)] bg-superficie-suave motion-reduce:animate-none ${className}`}
    />
  );
}

/** Tarjeta contenedora de esqueleto (borde + relleno como las tarjetas reales). */
export function TarjetaSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
      {children}
    </div>
  );
}

/**
 * Esqueleto genérico de página de datos: un encabezado y varias tarjetas. Sirve
 * para las páginas del panel y del patrocinador (listas, ficha, bandeja, ROI).
 */
export function SkeletonPagina({ tarjetas = 3 }: { tarjetas?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Cargando…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {Array.from({ length: tarjetas }).map((_, i) => (
        <TarjetaSkeleton key={i}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </TarjetaSkeleton>
      ))}
    </div>
  );
}
