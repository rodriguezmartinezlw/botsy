/**
 * GET /api/cron/recordatorios  (WP-07, RF-CV-07 versión ligera F1)
 *
 * Job de recordatorio de check-in. Protegido por CRON_SECRET vía cabecera
 * `Authorization: Bearer <CRON_SECRET>` (NO por sesión de Supabase: el cron no
 * tiene usuario; ver CLAUDE.md / memoria "Next 16 proxy no toca /api"). Con
 * secreto incorrecto o ausente → 401.
 *
 * Busca pacientes cuya `hora_checkin` ya pasó en su zona y que aún no tienen
 * check-in hoy, y les envía un email cálido (Resend) con enlace al check-in. No
 * reenvía si ya se envió hoy (consulta a `eventos_auditoria`). Registra cada
 * envío en `eventos_auditoria`.
 *
 * El push web/nativo (RF-CV-07 completo) llega en F2; F1 usa email.
 *
 * Los clientes de servidor (service-role) y Resend se importan DINÁMICAMENTE,
 * tras validar el secreto, para que la comprobación de autorización sea barata y
 * testeable sin tocar infraestructura.
 */

import {
  autorizarCron,
  fechaLocal,
  procesarRecordatorios,
  type EntradaRecordatorio,
} from "@/lib/recordatorios/core";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(request: Request): Promise<Response> {
  // 1. Autorización por CRON_SECRET (primero: si falla, no tocamos nada más).
  if (!autorizarCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return json({ error: "No autorizado." }, 401);
  }

  try {
    const { crearClienteAdmin } = await import("@/lib/supabase/admin");
    const { plantillaRecordatorio, enviarEmailResend } = await import(
      "@/lib/recordatorios/email"
    );
    const supabase = crearClienteAdmin();
    const ahora = new Date();

    // --- Candidatos: todos los pacientes con su zona y hora de check-in -----
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, hora_checkin");
    if (!pacientes || pacientes.length === 0) {
      return json({ candidatos: 0, enviados: 0, omitidos: 0, errores: 0 }, 200);
    }
    const ids = pacientes.map((p) => p.id);

    const { data: perfiles } = await supabase
      .from("perfiles")
      .select("id, nombre, zona_horaria")
      .in("id", ids);
    const perfilPorId = new Map((perfiles ?? []).map((p) => [p.id, p]));

    // Check-ins recientes (últimos 2 días UTC) para cubrir cualquier zona.
    const desdeCheckins = fechaLocal(
      "UTC",
      new Date(ahora.getTime() - 2 * 86_400_000),
    );
    const { data: checkins } = await supabase
      .from("checkins")
      .select("paciente_id, fecha")
      .eq("tipo", "checkin") // WP-24: las consultas no cuentan como check-in del día
      .in("paciente_id", ids)
      .gte("fecha", desdeCheckins);
    const fechasPorPaciente = new Map<string, string[]>();
    for (const c of checkins ?? []) {
      const lista = fechasPorPaciente.get(c.paciente_id) ?? [];
      lista.push(c.fecha);
      fechasPorPaciente.set(c.paciente_id, lista);
    }

    const entradas: EntradaRecordatorio[] = pacientes.map((p) => {
      const perfil = perfilPorId.get(p.id);
      return {
        pacienteId: p.id,
        nombre: perfil?.nombre ?? "",
        zona: perfil?.zona_horaria ?? "Europe/Madrid",
        horaCheckin: p.hora_checkin ?? "10:00:00",
        fechasConCheckin: fechasPorPaciente.get(p.id) ?? [],
      };
    });

    // --- Dependencias reales (Supabase + Resend) ----------------------------
    const baseUrl =
      process.env.APP_URL && process.env.APP_URL.trim().length > 0
        ? process.env.APP_URL.replace(/\/$/, "")
        : "https://botsy.app";
    const urlCheckin = `${baseUrl}/checkin`;

    const resumen = await procesarRecordatorios(entradas, {
      ahora,
      yaEnviadoHoy: async (pacienteId, fecha) => {
        const { count } = await supabase
          .from("eventos_auditoria")
          .select("id", { count: "exact", head: true })
          .eq("accion", "recordatorio_enviado")
          .eq("entidad_id", pacienteId)
          .eq("detalle->>fecha", fecha);
        return (count ?? 0) > 0;
      },
      enviarEmail: async ({ pacienteId, nombre }) => {
        const { data } = await supabase.auth.admin.getUserById(pacienteId);
        const email = data.user?.email;
        if (!email) throw new Error("Paciente sin email.");
        const plantilla = plantillaRecordatorio(nombre, urlCheckin);
        await enviarEmailResend({
          para: email,
          asunto: plantilla.asunto,
          html: plantilla.html,
          texto: plantilla.texto,
        });
      },
      registrarEnvio: async (pacienteId, fecha) => {
        await supabase.from("eventos_auditoria").insert({
          actor_id: null,
          accion: "recordatorio_enviado",
          entidad: "pacientes",
          entidad_id: pacienteId,
          detalle: { fecha, canal: "email" },
        });
      },
    });

    return json(resumen, 200);
  } catch {
    return json({ error: "No se pudieron procesar los recordatorios." }, 500);
  }
}
