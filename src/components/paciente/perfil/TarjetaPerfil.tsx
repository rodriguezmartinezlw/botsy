import type { ReactNode } from "react";

type TarjetaPerfilProps = {
  titulo: string;
  icono?: ReactNode;
  /** Contenido a la derecha del título (p. ej. badge de media o delta). */
  extra?: ReactNode;
  /** Texto de apoyo bajo el título (p. ej. "media del período"). */
  subtitulo?: string;
  children: ReactNode;
};

/**
 * Contenedor de una tarjeta del perfil (WP-05). Título >=18px (aquí text-xl =
 * 20px), estética del tema, radios generosos. Presentacional y reutilizable.
 */
export default function TarjetaPerfil({
  titulo,
  icono,
  extra,
  subtitulo,
  children,
}: TarjetaPerfilProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {icono ? (
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primario-suave text-primario"
            >
              {icono}
            </span>
          ) : null}
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold text-texto">{titulo}</h2>
            {subtitulo ? (
              <p className="text-sm text-texto-tenue">{subtitulo}</p>
            ) : null}
          </div>
        </div>
        {extra ? <div className="shrink-0 text-right">{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}
