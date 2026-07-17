/**
 * Textos de consentimiento por tipo (WP-07).
 *
 * IMPORTANTE: son un BORRADOR de trabajo (`v0-borrador`), NO el texto legal
 * definitivo. Cada apartado va marcado con `[PENDIENTE LEGAL]` porque el texto
 * real lo debe aprobar la asesoría jurídica (ver PLAN-MAESTRO §6). La estructura
 * sí es la real de una cláusula RGPD: responsable, finalidad, base, conservación,
 * derechos y revocación. Módulo puro (sin dependencias), reutilizable en la app
 * del paciente y en el interstitial.
 */

import type { TipoConsentimiento } from "@/types/db";

/** Versión del texto vigente (debe coincidir con la que se persiste al registrar). */
export const VERSION_TEXTO = "v0-borrador";

export type ApartadoConsentimiento = { titulo: string; cuerpo: string };

export type TextoConsentimiento = {
  tipo: TipoConsentimiento;
  /** Título corto para la tarjeta. */
  titulo: string;
  /** Resumen de una línea (lo que ya mostraba WP-01). */
  resumen: string;
  /** Si es obligatorio para poder usar la app (conversación) o no (opcionales). */
  obligatorio: boolean;
  /** Apartados del texto completo. */
  apartados: ApartadoConsentimiento[];
};

const RESPONSABLE =
  "[PENDIENTE LEGAL] Botsy (denominación social y datos de contacto del responsable del tratamiento pendientes de confirmar). Delegado de Protección de Datos: pendiente de designar.";

const DERECHOS =
  "[PENDIENTE LEGAL] Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, así como retirar este consentimiento en cualquier momento, desde esta misma pantalla o escribiendo a la dirección de contacto del responsable. También puedes reclamar ante la autoridad de control competente (en España, la AEPD).";

export const TEXTOS_CONSENTIMIENTO: Record<
  TipoConsentimiento,
  TextoConsentimiento
> = {
  conversacion: {
    tipo: "conversacion",
    titulo: "Registro de conversaciones",
    resumen:
      "Permites que Botsy guarde el texto de tus check-ins para tu seguimiento y para compartirlo con tu profesional.",
    obligatorio: true,
    apartados: [
      { titulo: "Responsable", cuerpo: RESPONSABLE },
      {
        titulo: "Finalidad",
        cuerpo:
          "[PENDIENTE LEGAL] Registrar el contenido (texto) de tus conversaciones de check-in diario para hacer tu seguimiento de salud, generar tu perfil evolutivo y ponerlo a disposición del profesional sanitario que te atiende. Es imprescindible para poder conversar con Botsy.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "[PENDIENTE LEGAL] Tu consentimiento explícito para el tratamiento de datos de salud. Sin él, la app no puede prestar el servicio de check-in.",
      },
      {
        titulo: "Conservación",
        cuerpo:
          "[PENDIENTE LEGAL] Los datos se conservan mientras seas usuario y durante los plazos legales aplicables al historial de seguimiento; después se suprimen o anonimizan.",
      },
      { titulo: "Tus derechos y revocación", cuerpo: DERECHOS },
    ],
  },
  voz_grabacion: {
    tipo: "voz_grabacion",
    titulo: "Grabación de voz",
    resumen:
      "Permites grabar el audio de tus check-ins por voz. Es opcional: sin este permiso podrás hablar igual, pero no se guardará el audio.",
    obligatorio: false,
    apartados: [
      { titulo: "Responsable", cuerpo: RESPONSABLE },
      {
        titulo: "Finalidad",
        cuerpo:
          "[PENDIENTE LEGAL] Guardar la grabación de audio de tus check-ins por voz para que el profesional pueda revisarla como apoyo a tu seguimiento. Es un permiso independiente del registro de la conversación.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "[PENDIENTE LEGAL] Tu consentimiento explícito, específico y separado. Puedes hablar con Botsy sin otorgarlo; en ese caso no se graba nada.",
      },
      {
        titulo: "Conservación",
        cuerpo:
          "[PENDIENTE LEGAL] El audio se almacena en un espacio privado con acceso restringido a tu profesional y se conserva durante el plazo definido en la política de retención; caduca o se elimina según dicha política.",
      },
      {
        titulo: "Efecto de la revocación",
        cuerpo:
          "Si retiras este permiso, a partir de tu siguiente check-in por voz Botsy dejará de grabar el audio de inmediato. Las grabaciones anteriores se gestionan según la política de conservación.",
      },
      { titulo: "Tus derechos y revocación", cuerpo: DERECHOS },
    ],
  },
  voz_biomarcadores: {
    tipo: "voz_biomarcadores",
    titulo: "Análisis de biomarcadores de voz",
    resumen:
      "Permites, de cara al futuro, analizar rasgos de tu voz como apoyo al seguimiento. No está activo todavía.",
    obligatorio: false,
    apartados: [
      { titulo: "Responsable", cuerpo: RESPONSABLE },
      {
        titulo: "Finalidad",
        cuerpo:
          "[PENDIENTE LEGAL] Analizar características acústicas de tu voz (ritmo, pausas, energía, etc.) como señal de cribado —nunca como diagnóstico— para el seguimiento longitudinal. Esta funcionalidad se activará en una fase futura; hoy solo se recoge el consentimiento.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "[PENDIENTE LEGAL] Tu consentimiento explícito y separado del resto. Es totalmente opcional y no condiciona el uso de la app.",
      },
      {
        titulo: "Conservación",
        cuerpo:
          "[PENDIENTE LEGAL] Se conservarán preferentemente las características derivadas y fragmentos mínimos de auditoría, con caducidad, según la política de retención.",
      },
      { titulo: "Tus derechos y revocación", cuerpo: DERECHOS },
    ],
  },
  uso_secundario: {
    tipo: "uso_secundario",
    titulo: "Uso secundario de datos (investigación y mejora)",
    resumen:
      "Permites, de forma totalmente opcional, que tus datos ya seudonimizados se usen para investigación y mejora del servicio. No afecta a tu seguimiento ni a la atención que recibes.",
    obligatorio: false,
    apartados: [
      { titulo: "Responsable", cuerpo: RESPONSABLE },
      {
        titulo: "Finalidad",
        cuerpo:
          "[PENDIENTE LEGAL] Reutilizar tus datos de salud, previamente seudonimizados, para fines de investigación, generación de evidencia y mejora del servicio. Es un permiso SEPARADO y estrictamente opcional: no otorgarlo no cambia en nada tu seguimiento ni tu atención.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "[PENDIENTE LEGAL] Tu consentimiento explícito, específico y separado del resto. Ninguna funcionalidad de la app depende de él.",
      },
      {
        titulo: "Conservación",
        cuerpo:
          "[PENDIENTE LEGAL] Los datos empleados para uso secundario se tratan seudonimizados y se conservan según la política de retención aplicable a investigación.",
      },
      {
        titulo: "Efecto de la revocación",
        cuerpo:
          "Si retiras este permiso, tus datos dejan de incorporarse a nuevos usos secundarios a partir de ese momento. El cambio queda registrado con fecha.",
      },
      { titulo: "Tus derechos y revocación", cuerpo: DERECHOS },
    ],
  },
};

/** Lista ordenada (obligatorio primero) para renderizar. */
export const TEXTOS_ORDENADOS: TextoConsentimiento[] = [
  TEXTOS_CONSENTIMIENTO.conversacion,
  TEXTOS_CONSENTIMIENTO.voz_grabacion,
  TEXTOS_CONSENTIMIENTO.voz_biomarcadores,
  TEXTOS_CONSENTIMIENTO.uso_secundario,
];
