"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { enrolarPaciente } from "@/app/(panel)/pacientes/acciones";
import type { PlantillaProgramaLista } from "@/lib/panel/datos";

/**
 * Alta de paciente desde el panel (WP-20 §A). Abre un formulario, llama a la
 * Server Action `enrolarPaciente` y muestra el resultado. Si el correo ya existe,
 * ofrece VINCULAR (reenvía la misma alta con `vincularExistente: true`) en vez de
 * duplicar. Al terminar con éxito, refresca la lista.
 */
export default function FormularioNuevoPaciente({
  programas,
}: {
  programas: PlantillaProgramaLista[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [programaClave, setProgramaClave] = useState(programas[0]?.clave ?? "");
  const [mensaje, setMensaje] = useState<
    { ok: boolean; texto: string; emailExiste?: boolean } | null
  >(null);
  const [enviando, iniciar] = useTransition();

  function reiniciar() {
    setNombre("");
    setEmail("");
    setTelefono("");
    setFechaNacimiento("");
    setProgramaClave(programas[0]?.clave ?? "");
    setMensaje(null);
  }

  function enviar(vincularExistente: boolean) {
    setMensaje(null);
    iniciar(async () => {
      const r = await enrolarPaciente({
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        fechaNacimiento: fechaNacimiento.trim(),
        programaClave,
        vincularExistente,
      });
      if (r.ok) {
        setMensaje({ ok: true, texto: r.mensaje });
        router.refresh();
      } else {
        setMensaje({ ok: false, texto: r.error, emailExiste: r.emailExiste });
      }
    });
  }

  if (programas.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-3 text-sm text-texto-suave">
        No hay programas disponibles para el alta. Configura un programa antes de
        enrolar pacientes.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          reiniciar();
          setAbierto(true);
        }}
        className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-md)] bg-primario px-4 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte"
      >
        <UserPlus className="h-5 w-5" aria-hidden />
        Nuevo paciente
      </button>
    );
  }

  const puedeEnviar =
    nombre.trim().length > 0 && email.trim().length > 0 && programaClave.length > 0;

  return (
    <section
      aria-label="Alta de nuevo paciente"
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold text-texto">
          <UserPlus className="h-5 w-5 text-primario" aria-hidden />
          Nuevo paciente
        </h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar el formulario de alta"
          className="rounded-[var(--radius-sm)] p-1 text-texto-tenue hover:bg-superficie-suave hover:text-texto"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (puedeEnviar) enviar(false);
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
          Nombre y apellidos
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoComplete="off"
            className="rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto focus:border-primario focus:outline-none"
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
            placeholder="paciente@ejemplo.com"
            className="rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none"
          />
          <span className="text-xs font-normal text-texto-tenue">
            Recibirá una invitación para crear su contraseña.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
            Teléfono (opcional)
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              placeholder="+51 900 000 000"
              className="rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
            Fecha de nacimiento (opcional)
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto focus:border-primario focus:outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-texto-suave">
          Programa a asignar
          <select
            value={programaClave}
            onChange={(e) => setProgramaClave(e.target.value)}
            className="rounded-[var(--radius-md)] border border-borde bg-superficie px-3 py-2.5 text-base text-texto focus:border-primario focus:outline-none"
          >
            {programas.map((p) => (
              <option key={p.clave} value={p.clave}>
                {p.nombre}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-texto-tenue">
            Sus reglas de aviso se activan al dar de alta. Las pautas de medicación
            se añaden después desde la ficha.
          </span>
        </label>

        {mensaje ? (
          <div
            role={mensaje.ok ? "status" : "alert"}
            className={`flex flex-col gap-2 rounded-[var(--radius-md)] px-4 py-3 text-base font-medium ${
              mensaje.ok
                ? "bg-acento-suave text-acento-fuerte"
                : "bg-superficie-suave text-[#b91c1c]"
            }`}
          >
            <span>{mensaje.texto}</span>
            {mensaje.emailExiste ? (
              <button
                type="button"
                disabled={enviando}
                onClick={() => enviar(true)}
                className="w-fit rounded-[var(--radius-sm)] bg-primario px-3 py-1.5 text-sm font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
              >
                Vincular a este paciente
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={enviando || !puedeEnviar}
            className="rounded-[var(--radius-md)] bg-primario px-5 py-2.5 text-base font-semibold text-white hover:bg-primario-fuerte disabled:opacity-60"
          >
            {enviando ? "Dando de alta…" : "Dar de alta e invitar"}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-[var(--radius-md)] border border-borde px-5 py-2.5 text-base font-semibold text-texto-suave hover:bg-superficie-suave"
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
