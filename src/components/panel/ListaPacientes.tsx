"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, Search } from "lucide-react";
import {
  filtrarPacientes,
  filtrarPorInstitucion,
  institucionesDeLista,
  type PacienteLista,
} from "@/lib/panel/lista";
import type { VerticalPaciente } from "@/types/db";
import Semaforo from "./Semaforo";

const ETIQUETA_VERTICAL: Record<VerticalPaciente, string> = {
  cardiovascular: "Cardiovascular",
  cronica: "Crónica",
  geriatrica: "Geriátrica",
  mental: "Salud mental",
  ocupacional: "Ocupacional",
  general: "General",
};

function textoUltimoCheckin(dias: number | null): { texto: string; aviso: boolean } {
  if (dias === null) return { texto: "Sin check-ins", aviso: true };
  if (dias === 0) return { texto: "Hoy", aviso: false };
  if (dias === 1) return { texto: "Ayer", aviso: false };
  return { texto: `Hace ${dias} días`, aviso: dias > 2 };
}

function Avatar({ inicial, url }: { inicial: string; url: string | null }) {
  if (url) {
    return (
      <span
        aria-hidden
        role="img"
        className="h-11 w-11 shrink-0 rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${url})` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primario-suave text-lg font-bold text-primario"
    >
      {inicial}
    </span>
  );
}

export default function ListaPacientes({ pacientes }: { pacientes: PacienteLista[] }) {
  const [consulta, setConsulta] = useState("");
  const [institucionFiltro, setInstitucionFiltro] = useState("");
  // WP-22: sólo se ofrece el filtro si el profesional trabaja en varias instituciones.
  const instituciones = useMemo(
    () => institucionesDeLista(pacientes),
    [pacientes],
  );
  const filtrados = useMemo(
    () =>
      filtrarPorInstitucion(
        filtrarPacientes(pacientes, consulta),
        institucionFiltro || null,
      ),
    [pacientes, consulta, institucionFiltro],
  );

  if (pacientes.length === 0) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-borde bg-superficie p-6">
        <p className="text-base text-texto-suave">
          Aún no tienes pacientes asignados. Cuando se te asigne uno, aparecerá
          aquí con su estado y último check-in.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar paciente por nombre</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-texto-tenue"
            aria-hidden
          />
          <input
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full rounded-[var(--radius-md)] border border-borde bg-superficie py-3 pl-11 pr-4 text-base text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none"
          />
        </label>

        {instituciones.length > 1 ? (
          <label className="relative block sm:w-64">
            <span className="sr-only">Filtrar por institución</span>
            <Building2
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-texto-tenue"
              aria-hidden
            />
            <select
              value={institucionFiltro}
              onChange={(e) => setInstitucionFiltro(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-borde bg-superficie py-3 pl-11 pr-4 text-base text-texto focus:border-primario focus:outline-none"
            >
              <option value="">Todas las instituciones</option>
              {instituciones.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-[var(--radius-md)] bg-superficie-suave px-4 py-6 text-center text-base text-texto-suave">
          Ningún paciente coincide con “{consulta}”.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {filtrados.map((p) => {
            const uc = textoUltimoCheckin(p.diasSinCheckin);
            return (
              <li key={p.id}>
                <Link
                  href={`/pacientes/${p.id}`}
                  className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-borde bg-superficie px-4 py-3 transition-colors hover:border-primario/40 hover:bg-superficie-suave"
                >
                  <Semaforo nivel={p.semaforo} />
                  <Avatar inicial={p.inicial} url={p.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-base font-semibold text-texto">
                        {p.nombre}
                      </span>
                      {p.edad !== null ? (
                        <span className="text-sm text-texto-tenue">
                          {p.edad} años
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm text-texto-suave">
                      {ETIQUETA_VERTICAL[p.vertical]}
                    </span>
                  </div>

                  <div className="hidden w-24 flex-col items-end sm:flex">
                    <span className="text-sm text-texto-tenue">Adherencia 7d</span>
                    <span className="text-base font-semibold text-texto">
                      {p.adherencia7 === null ? "—" : `${p.adherencia7}%`}
                    </span>
                  </div>

                  <div className="flex w-28 flex-col items-end">
                    <span className="text-sm text-texto-tenue">Último check-in</span>
                    <span
                      className={`inline-flex items-center gap-1 text-base font-semibold ${
                        uc.aviso ? "text-[#c2410c]" : "text-texto"
                      }`}
                    >
                      {uc.aviso ? (
                        <AlertTriangle className="h-4 w-4" aria-hidden />
                      ) : null}
                      {uc.texto}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
