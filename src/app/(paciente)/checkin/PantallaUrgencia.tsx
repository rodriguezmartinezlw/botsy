"use client";

import Link from "next/link";
import { Phone, PhoneCall, ShieldAlert } from "lucide-react";
import { TEXTOS_URGENCIA } from "@/lib/escalado/textos";
import { registrarContacto } from "./escaladoContacto";

/**
 * Pantalla dedicada de URGENCIA (RF-ES-03). Calmada pero inequívoca: indica
 * acudir/llamar a un médico AHORA con botones grandes a Emergencias (112) y al
 * médico. NO diagnostica ni nombra causas (regla clínica de CLAUDE.md); habla de
 * "una señal", no de un diagnóstico. Registra en auditoría si el paciente pulsa.
 */
export default function PantallaUrgencia({
  checkinId,
  telefonoMedico,
  resumen,
}: {
  checkinId: string;
  telefonoMedico: string | null;
  resumen: string;
}) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border-2 p-5"
        style={{
          borderColor: "var(--color-urgencia)",
          background: "var(--color-superficie)",
        }}
      >
        <p className="flex items-center gap-2 text-xl font-bold text-texto">
          <ShieldAlert
            className="h-7 w-7 shrink-0"
            style={{ color: "var(--color-urgencia)" }}
            aria-hidden
          />
          {TEXTOS_URGENCIA.titulo}
        </p>
        <p className="text-lg leading-relaxed text-texto">
          {TEXTOS_URGENCIA.cuerpo}
        </p>
        <p className="text-base text-texto-suave">{TEXTOS_URGENCIA.instruccion}</p>
      </div>

      <div className="flex flex-col gap-3">
        <a
          href="tel:112"
          onClick={() => void registrarContacto(checkinId, "emergencias")}
          className="flex h-16 items-center justify-center gap-3 rounded-[var(--radius-lg)] px-6 text-xl font-bold text-white"
          style={{ background: "var(--color-urgencia)" }}
        >
          <Phone className="h-6 w-6" aria-hidden />
          {TEXTOS_URGENCIA.botonEmergencias}
        </a>

        {telefonoMedico ? (
          <a
            href={`tel:${telefonoMedico}`}
            onClick={() => void registrarContacto(checkinId, "medico")}
            className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-primario bg-superficie px-6 text-lg font-semibold text-primario transition-colors hover:bg-primario-suave"
          >
            <PhoneCall className="h-5 w-5" aria-hidden />
            {TEXTOS_URGENCIA.botonMedico}
          </a>
        ) : (
          <p className="text-base text-texto-suave">
            {/* Sin teléfono del médico guardado: el 112 sigue disponible arriba. */}
            No tengo guardado el teléfono de tu médico. Usa el botón de
            Emergencias si lo necesitas.
          </p>
        )}
      </div>

      <p className="text-base font-medium text-texto">
        {TEXTOS_URGENCIA.aclaracionSenal}
      </p>

      <section
        aria-label="Resumen de hoy"
        className="w-full rounded-[var(--radius-lg)] border border-borde bg-superficie-suave p-5 text-left"
      >
        <p className="text-base leading-relaxed text-texto">{resumen}</p>
      </section>

      <p className="text-sm text-texto-tenue">{TEXTOS_URGENCIA.avisoLegal}</p>

      <Link
        href="/inicio"
        className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] border border-borde bg-superficie px-6 text-base font-semibold text-texto-suave transition-colors hover:bg-superficie-suave"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
