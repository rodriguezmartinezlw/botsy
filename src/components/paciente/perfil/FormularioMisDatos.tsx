"use client";

import { useState, useTransition } from "react";
import { actualizarMisDatos } from "@/app/(paciente)/perfil/acciones";
import { ZONAS_HORARIAS } from "@/lib/perfil/zonas";

/**
 * "Mis datos" del paciente (WP-20 §C): editar nombre, teléfono, hora del
 * recordatorio de check-in y zona horaria. Solo campos NO clínicos (la validación
 * server la refuerza con un esquema `.strict()`). Botones y textos grandes
 * (perfil geriátrico).
 */
export default function FormularioMisDatos({
  nombreInicial,
  telefonoInicial,
  horaInicial,
  zonaInicial,
}: {
  nombreInicial: string;
  telefonoInicial: string;
  horaInicial: string;
  zonaInicial: string;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [hora, setHora] = useState(horaInicial);
  const [zona, setZona] = useState(zonaInicial);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(
    null,
  );
  const [enviando, iniciar] = useTransition();

  function guardar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await actualizarMisDatos({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        horaCheckin: hora,
        zonaHoraria: zona,
      });
      setMensaje(
        r.ok
          ? { ok: true, texto: "Tus datos se han guardado." }
          : { ok: false, texto: r.error },
      );
    });
  }

  return (
    <section
      aria-label="Mis datos"
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6"
    >
      <h2 className="text-lg font-bold text-texto">Mis datos</h2>

      <label className="flex flex-col gap-1.5 text-base font-medium text-texto-suave">
        Nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto focus:border-primario focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-base font-medium text-texto-suave">
        Teléfono
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          placeholder="Ej.: +51 900 000 000"
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-base font-medium text-texto-suave">
        Hora del recordatorio de tu check-in
        <input
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto focus:border-primario focus:outline-none"
        />
        <span className="text-sm font-normal text-texto-tenue">
          Te avisaremos a esta hora para tu conversación diaria.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-base font-medium text-texto-suave">
        Zona horaria
        <select
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          className="h-12 rounded-[var(--radius-md)] border border-borde bg-superficie px-4 text-base text-texto focus:border-primario focus:outline-none"
        >
          {ZONAS_HORARIAS.map((z) => (
            <option key={z.valor} value={z.valor}>
              {z.etiqueta}
            </option>
          ))}
        </select>
      </label>

      {mensaje ? (
        <p
          role={mensaje.ok ? "status" : "alert"}
          className={`text-base font-medium ${
            mensaje.ok ? "text-acento-fuerte" : "text-urgencia"
          }`}
        >
          {mensaje.texto}
        </p>
      ) : null}

      <button
        type="button"
        onClick={guardar}
        disabled={enviando || nombre.trim().length === 0}
        className="flex h-12 items-center justify-center rounded-[var(--radius-lg)] bg-primario px-6 text-lg font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
      >
        {enviando ? "Guardando…" : "Guardar mis datos"}
      </button>
    </section>
  );
}
