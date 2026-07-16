"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ChevronDown, History } from "lucide-react";
import type { TipoConsentimiento } from "@/types/db";
import {
  TEXTOS_ORDENADOS,
  VERSION_TEXTO,
} from "@/lib/consentimientos/textos";
import { registrarConsentimiento } from "./acciones";

type EstadoConsentimientos = Record<TipoConsentimiento, boolean>;

export type FilaHistorial = {
  tipo: TipoConsentimiento;
  otorgado: boolean;
  version: string;
  registradoEn: string;
};

function fechaLegible(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

/**
 * Panel de consentimientos (WP-07): por cada tipo muestra el texto completo
 * (expandible), el estado vigente, el historial de cambios, y permite otorgar o
 * revocar. La revocación exige confirmación explícita; cualquier cambio surte
 * efecto inmediato (Server Action append-only + `router.refresh()` para
 * refrescar historial y estado desde el servidor).
 */
export default function PanelConsentimientos({
  estadoInicial,
  historial,
}: {
  estadoInicial: EstadoConsentimientos;
  historial: FilaHistorial[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoConsentimientos>(estadoInicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<TipoConsentimiento | null>(null);
  const [confirmando, setConfirmando] = useState<TipoConsentimiento | null>(null);
  const [textoAbierto, setTextoAbierto] = useState<TipoConsentimiento | null>(null);
  const [, iniciarTransicion] = useTransition();

  function aplicarCambio(tipo: TipoConsentimiento, otorgado: boolean) {
    setError(null);
    setConfirmando(null);
    setPendiente(tipo);
    setEstado((prev) => ({ ...prev, [tipo]: otorgado })); // optimista

    iniciarTransicion(async () => {
      const resultado = await registrarConsentimiento({ tipo, otorgado });
      if (!resultado.ok) {
        setEstado((prev) => ({ ...prev, [tipo]: !otorgado }));
        setError(resultado.error);
        setPendiente(null);
        return;
      }
      setPendiente(null);
      // Refresca el Server Component para reflejar el nuevo historial/estado.
      router.refresh();
    });
  }

  function alPulsarInterruptor(tipo: TipoConsentimiento) {
    const otorgadoAhora = estado[tipo];
    if (otorgadoAhora) {
      // Revocar: requiere confirmación explícita.
      setConfirmando(tipo);
    } else {
      aplicarCambio(tipo, true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-base font-medium text-urgencia">
          {error}
        </p>
      ) : null}

      {TEXTOS_ORDENADOS.map((texto) => {
        const tipo = texto.tipo;
        const otorgado = estado[tipo];
        const guardando = pendiente === tipo;
        const confirmar = confirmando === tipo;
        const textoVisible = textoAbierto === tipo;
        const cambios = historial.filter((h) => h.tipo === tipo);

        return (
          <section
            key={tipo}
            className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-texto">
                  {texto.titulo}
                  {texto.obligatorio ? (
                    <span className="ml-2 rounded-full bg-primario-suave px-2 py-0.5 text-xs font-semibold text-primario">
                      Necesario para usar Botsy
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-superficie px-2 py-0.5 text-xs font-medium text-texto-tenue">
                      Opcional
                    </span>
                  )}
                </h2>
                <p className="text-base text-texto-suave">{texto.resumen}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={otorgado}
                aria-label={`${otorgado ? "Retirar" : "Otorgar"} permiso: ${texto.titulo}`}
                disabled={guardando}
                onClick={() => alPulsarInterruptor(tipo)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  otorgado ? "bg-acento" : "bg-borde"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    otorgado ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-medium text-texto">
                {otorgado ? "Otorgado" : "No otorgado"}
                {guardando ? " · guardando…" : ""}
              </span>
              <span className="text-sm text-texto-tenue">
                [PENDIENTE LEGAL] · {VERSION_TEXTO}
              </span>
            </div>

            {/* Confirmación de revocación */}
            {confirmar ? (
              <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border-2 border-vigilancia bg-superficie p-4">
                <p className="flex items-start gap-2 text-base font-medium text-texto">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-vigilancia"
                    aria-hidden
                  />
                  {texto.obligatorio
                    ? "Si retiras este permiso, no podrás seguir haciendo tus check-ins hasta que vuelvas a otorgarlo. ¿Seguro que quieres retirarlo?"
                    : "¿Seguro que quieres retirar este permiso? El cambio tiene efecto inmediato."}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => aplicarCambio(tipo, false)}
                    className="flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-urgencia px-5 text-base font-semibold text-white hover:opacity-90"
                  >
                    Sí, retirar el permiso
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    className="flex h-11 items-center justify-center rounded-[var(--radius-md)] border-2 border-primario bg-superficie px-5 text-base font-semibold text-primario hover:bg-primario-suave"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            {/* Texto completo */}
            <button
              type="button"
              onClick={() => setTextoAbierto(textoVisible ? null : tipo)}
              aria-expanded={textoVisible}
              className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primario hover:underline"
            >
              {textoVisible ? "Ocultar texto completo" : "Leer texto completo"}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${textoVisible ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {textoVisible ? (
              <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-borde bg-superficie p-4">
                {texto.apartados.map((ap) => (
                  <div key={ap.titulo} className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold text-texto">
                      {ap.titulo}
                    </h3>
                    <p className="text-sm leading-relaxed text-texto-suave">
                      {ap.cuerpo}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Historial de cambios */}
            {cambios.length > 0 ? (
              <details className="rounded-[var(--radius-md)] border border-borde bg-superficie p-4">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-texto-suave">
                  <History className="h-4 w-4" aria-hidden />
                  Historial de cambios ({cambios.length})
                </summary>
                <ul className="mt-3 flex flex-col gap-2" role="list">
                  {cambios.map((c, i) => (
                    <li
                      key={`${c.registradoEn}-${i}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span
                        className={`font-medium ${
                          c.otorgado ? "text-acento-fuerte" : "text-urgencia"
                        }`}
                      >
                        {c.otorgado ? "Otorgado" : "Revocado"}
                      </span>
                      <span className="text-texto-tenue">
                        {fechaLegible(c.registradoEn)} · {c.version}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
