"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { invitarProfesional } from "@/app/(panel)/admin/profesionales/acciones";

const claseCampo =
  "rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none";

/**
 * Invitación de profesional por email (WP-23 §3), como el enrolamiento de
 * pacientes de WP-20. El profesional recibe un correo para crear su contraseña;
 * después se le asigna una institución desde la lista.
 */
export default function FormularioInvitarProfesional() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar() {
    setAviso(null);
    iniciar(async () => {
      const r = await invitarProfesional({
        nombre: nombre.trim(),
        email: email.trim(),
      });
      if (r.ok) {
        setAviso({ ok: true, texto: r.mensaje ?? "Invitación enviada." });
        setNombre("");
        setEmail("");
        router.refresh();
      } else {
        setAviso({ ok: false, texto: r.error });
      }
    });
  }

  const puedeEnviar = nombre.trim().length > 0 && email.trim().length > 0;

  return (
    <section
      aria-label="Invitar profesional"
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6"
    >
      <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
        <UserPlus className="h-5 w-5 text-primario" aria-hidden />
        Invitar profesional
      </h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (puedeEnviar) enviar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
            Nombre y apellidos
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoComplete="off"
              className={claseCampo}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              placeholder="profesional@ejemplo.com"
              className={claseCampo}
            />
          </label>
        </div>

        {aviso ? (
          <p
            role={aviso.ok ? "status" : "alert"}
            className={`rounded-[var(--radius-md)] px-4 py-3 text-base font-medium ${
              aviso.ok
                ? "bg-acento-suave text-acento-fuerte"
                : "bg-superficie-suave text-[#b91c1c]"
            }`}
          >
            {aviso.texto}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={enviando || !puedeEnviar}
          className="w-fit rounded-[var(--radius-md)] bg-primario px-5 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviar invitación"}
        </button>
      </form>
    </section>
  );
}
