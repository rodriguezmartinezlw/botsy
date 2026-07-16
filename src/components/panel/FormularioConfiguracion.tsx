"use client";

import { useState, useTransition } from "react";
import { guardarConfiguracion } from "@/app/(panel)/configuracion/acciones";

export default function FormularioConfiguracion({
  nombreInicial,
  telefonoInicial,
}: {
  nombreInicial: string;
  telefonoInicial: string;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  function guardar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarConfiguracion({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
      });
      setMensaje(
        r.ok
          ? { ok: true, texto: "Cambios guardados." }
          : { ok: false, texto: r.error },
      );
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
      <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
        Nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto focus:border-primario focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
        Teléfono de contacto (lo ven tus pacientes)
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          placeholder="Ej.: +34 600 111 222"
          className="rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none"
        />
      </label>

      {mensaje ? (
        <p
          className={`text-sm font-medium ${
            mensaje.ok ? "text-acento-fuerte" : "text-[#b91c1c]"
          }`}
        >
          {mensaje.texto}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={guardar}
          disabled={enviando || nombre.trim().length === 0}
          className="rounded-[var(--radius-md)] bg-primario px-5 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </section>
  );
}
