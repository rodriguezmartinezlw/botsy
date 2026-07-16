import { Flame } from "lucide-react";
import type { CabeceraPerfil as CabeceraPerfilDatos } from "./tipos";

/**
 * Cabecera del perfil (WP-05): avatar o iniciales, nombre, racha actual con
 * icono de llama y "check-ins este mes: N". Presentacional (sin estado); la
 * pinta el Server Component del perfil. Texto legible (>=16px).
 */
export default function CabeceraPerfil({
  cabecera,
}: {
  cabecera: CabeceraPerfilDatos;
}) {
  const { nombre, inicial, avatarUrl, rachaActual, checkinsMes } = cabecera;
  const nombreMostrado = nombre.trim().length > 0 ? nombre : "Tu perfil";

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primario-suave text-2xl font-bold text-primario"
          >
            {inicial}
          </span>
        )}
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-texto">
            {nombreMostrado}
          </h1>
          <p className="text-base text-texto-suave">Tu evolución</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-borde bg-primario-suave px-4 py-3">
          <Flame className="h-6 w-6 text-primario" aria-hidden />
          <span className="text-base font-semibold text-texto">
            {rachaActual} {rachaActual === 1 ? "día" : "días"} de racha
          </span>
        </div>
        <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave px-4 py-3">
          <span className="text-base text-texto-suave">Check-ins este mes:</span>
          <span className="text-base font-semibold text-texto">{checkinsMes}</span>
        </div>
      </div>
    </header>
  );
}
