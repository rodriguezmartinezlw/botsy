"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Cierra la sesión del paciente (WP-20 §C) y vuelve al login. Visible en el
 * perfil. Botón grande y claro (perfil geriátrico).
 */
export default function BotonCerrarSesion() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    try {
      const supabase = crearClienteNavegador();
      await supabase.auth.signOut();
    } catch {
      // Aun si falla el signOut remoto, llevamos al login (limpia el cliente).
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void salir()}
      disabled={saliendo}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-borde bg-superficie px-6 text-base font-semibold text-texto-suave transition-colors hover:bg-superficie-suave disabled:opacity-60"
    >
      <LogOut className="h-5 w-5" aria-hidden />
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
