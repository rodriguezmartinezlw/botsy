import type { ReactNode } from "react";

type EncabezadoPaginaProps = {
  titulo: string;
  descripcion: string;
  icono?: ReactNode;
};

/**
 * Encabezado reutilizable para las páginas placeholder de F1 (WP-00).
 * Solo presentación: título + descripción. Sin lógica de negocio.
 */
export default function EncabezadoPagina({
  titulo,
  descripcion,
  icono,
}: EncabezadoPaginaProps) {
  return (
    <header className="flex flex-col gap-3">
      {icono ? (
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-primario-suave text-primario"
        >
          {icono}
        </span>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight text-texto">{titulo}</h1>
      <p className="text-base leading-relaxed text-texto-suave">{descripcion}</p>
    </header>
  );
}
