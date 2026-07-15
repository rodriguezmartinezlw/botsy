"use client";

import { PhoneCall } from "lucide-react";
import { TEXTOS_CONTACTAR } from "@/lib/escalado/textos";
import { registrarContacto } from "./escaladoContacto";

/**
 * Tarjeta de nivel CONTACTAR (RF-ES-02) para el cierre del check-in. Tono
 * empático y no alarmista, con botón `tel:` al médico. Distingue "señal" de
 * "diagnóstico". Registra en auditoría si el paciente pulsa llamar.
 */
export default function TarjetaContactar({
  checkinId,
  telefonoMedico,
}: {
  checkinId: string;
  telefonoMedico: string | null;
}) {
  return (
    <section
      role="status"
      aria-label="Señal para comentar con tu médico"
      className="flex w-full flex-col gap-3 rounded-[var(--radius-lg)] border-2 p-5 text-left"
      style={{
        borderColor: "var(--color-vigilancia)",
        background: "var(--color-superficie)",
      }}
    >
      <p className="text-lg font-semibold text-texto">{TEXTOS_CONTACTAR.titulo}</p>
      <p className="text-base leading-relaxed text-texto">
        {TEXTOS_CONTACTAR.cuerpo}
      </p>

      {telefonoMedico ? (
        <a
          href={`tel:${telefonoMedico}`}
          onClick={() => void registrarContacto(checkinId, "medico")}
          className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white transition-colors hover:bg-primario-fuerte"
        >
          <PhoneCall className="h-5 w-5" aria-hidden />
          {TEXTOS_CONTACTAR.botonLlamarMedico}
        </a>
      ) : (
        <p className="text-base text-texto-suave">
          {TEXTOS_CONTACTAR.sinTelefonoMedico}
        </p>
      )}

      <p className="text-sm text-texto-tenue">{TEXTOS_CONTACTAR.aclaracionSenal}</p>
    </section>
  );
}
