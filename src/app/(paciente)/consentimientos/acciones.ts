"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  VERSION_TEXTO_CONSENTIMIENTO,
  type ResultadoConsentimiento,
} from "./constantes";

const esquemaConsentimiento = z.object({
  tipo: z.enum([
    "conversacion",
    "voz_grabacion",
    "voz_biomarcadores",
    "uso_secundario",
  ]),
  otorgado: z.boolean(),
});

/**
 * Registra (append-only) el consentimiento del paciente autenticado.
 * Valida la entrada con Zod y comprueba la sesión dentro de la acción
 * (defensa en profundidad, además del guard del layout).
 */
export async function registrarConsentimiento(
  entrada: unknown,
): Promise<ResultadoConsentimiento> {
  const analizado = esquemaConsentimiento.safeParse(entrada);
  if (!analizado.success) {
    return { ok: false, error: "Datos de consentimiento no válidos." };
  }

  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "No has iniciado sesión." };
    }

    const { error } = await supabase.from("consentimientos").insert({
      paciente_id: user.id,
      tipo: analizado.data.tipo,
      otorgado: analizado.data.otorgado,
      version_texto: VERSION_TEXTO_CONSENTIMIENTO,
    });
    if (error) {
      return { ok: false, error: "No se pudo guardar el consentimiento." };
    }

    // Revalida las rutas cuyo contenido depende del estado de consentimientos
    // (el gating del check-in y el interstitial).
    revalidatePath("/consentimientos");
    revalidatePath("/inicio");
    revalidatePath("/checkin");
    revalidatePath("/checkin/voz");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No se pudo conectar con el servidor. Inténtalo más tarde.",
    };
  }
}
