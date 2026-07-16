import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format, parseISO, subDays } from "date-fns";
import { z } from "zod";
import BarraInforme from "@/components/informe/BarraInforme";
import InformeVista from "@/components/informe/InformeVista";
import { obtenerSesionPanel } from "@/lib/panel/sesion-panel";
import { cargarDatosInforme } from "@/lib/informes/datos";
import { generarResumenEjecutivo } from "@/lib/informes/resumen";
import { crearClienteOpenAI, modeloTexto } from "@/lib/ia/openai";
import { fechaHoyEnZona } from "@/lib/ia/conversacion";

export const metadata: Metadata = {
  title: "Informe del paciente",
};

const esquemaFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Resuelve el período: usa `?desde&hasta` si son válidos; si no, últimos 30 días. */
function resolverPeriodo(sp: {
  desde?: string;
  hasta?: string;
}): { desde: string; hasta: string } {
  const hoy = fechaHoyEnZona("Europe/Madrid");
  const desdeDef = format(subDays(parseISO(hoy), 29), "yyyy-MM-dd");

  const d = esquemaFecha.safeParse(sp.desde);
  const h = esquemaFecha.safeParse(sp.hasta);
  let desde = d.success ? d.data : desdeDef;
  let hasta = h.success ? h.data : hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  return { desde, hasta };
}

/**
 * Informe de seguimiento por paciente (WP-07, RF-DB-06 versión F1).
 *
 * Protegido con `obtenerSesionPanel` (sólo profesional/admin); la RLS de WP-01
 * (vía el cliente de sesión) garantiza además que sea SU paciente: si no lo es,
 * `cargarDatosInforme` devuelve `null` y respondemos 404.
 *
 * Genera el resumen ejecutivo con el LLM (cliente inyectable de WP-02) y lo
 * persiste en `informes` para trazabilidad. Si OpenAI falla, el informe sale sin
 * resumen (con aviso) y no se persiste resumen.
 */
export default async function InformePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const sesion = await obtenerSesionPanel();
  if (!sesion) notFound();

  const { desde, hasta } = resolverPeriodo(sp);

  const datos = await cargarDatosInforme(sesion.supabase, id, desde, hasta);
  if (!datos) notFound();

  const modelo = modeloTexto();
  const resumen = await generarResumenEjecutivo(
    crearClienteOpenAI(),
    datos,
    modelo,
  );

  const generadoEn = new Date().toISOString();

  // Trazabilidad: persistir el informe (best-effort; nunca rompe el render).
  try {
    await sesion.supabase.from("informes").insert({
      paciente_id: id,
      generado_por: sesion.userId,
      periodo_desde: desde,
      periodo_hasta: hasta,
      resumen: resumen.estado === "ok" ? resumen.resumen : null,
      modelo: resumen.estado === "ok" ? modelo : null,
    });
  } catch {
    // No bloquea el informe si la persistencia falla.
  }

  return (
    <div className="flex flex-col gap-5">
      <BarraInforme pacienteId={id} desde={desde} hasta={hasta} />
      <InformeVista datos={datos} resumen={resumen} fechaGeneracion={generadoEn} />
    </div>
  );
}
