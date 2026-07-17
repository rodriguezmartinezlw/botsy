/**
 * Textos de consentimiento por tipo (WP-07; v1 genérica 2026-07).
 *
 * Versión GENÉRICA conforme al RGPD (arts. 6.1.a, 7 y 9.2.a) con la estructura
 * completa de una cláusula informada: responsable, finalidad, base, destinatarios
 * y encargados, conservación, derechos y revocación. Decisión del fundador
 * (2026-07-17): se usan textos genéricos estándar; la revisión por asesoría
 * jurídica antes de operar con pacientes reales es RECOMENDABLE, no bloqueante.
 * Módulo puro (sin dependencias), reutilizable en la app y en el interstitial.
 */

import type { TipoConsentimiento } from "@/types/db";

/** Versión del texto vigente (se persiste al registrar cada consentimiento). */
export const VERSION_TEXTO = "v1-generica-2026-07";

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
  "El responsable del tratamiento es la entidad titular del servicio Botsy. Puedes contactar con el responsable en materia de protección de datos a través de los canales de contacto indicados en la propia aplicación o por medio de tu centro sanitario.";

const DESTINATARIOS =
  "Tus datos se comparten únicamente con el equipo sanitario de tu institución que participa en tu seguimiento. Para prestar el servicio se utilizan proveedores tecnológicos que actúan como encargados del tratamiento bajo contrato (alojamiento seguro de datos y procesamiento del lenguaje de la conversación); dichos proveedores no pueden usar tus datos para fines propios. No se ceden datos identificables a terceros: los patrocinadores del programa solo acceden a estadísticas agregadas y anonimizadas.";

const DERECHOS =
  "Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, así como retirar este consentimiento desde esta misma pantalla, con efecto inmediato y sin que ello afecte a la licitud del tratamiento previo. También puedes presentar una reclamación ante la autoridad de protección de datos competente en tu país.";

const CONSERVACION_BASE =
  "Los datos se conservan mientras mantengas tu cuenta y, tras su cierre, durante los plazos que exija la normativa sanitaria y de protección de datos aplicable en tu país; después se suprimen o se anonimizan de forma irreversible.";

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
          "Registrar el contenido (texto) de tus conversaciones de check-in para realizar tu seguimiento de salud, construir tu perfil evolutivo y ponerlo a disposición del equipo sanitario de tu institución. Botsy no diagnostica: registra lo que cuentas y avisa a tu equipo cuando detecta una señal que conviene revisar. Este permiso es imprescindible para poder conversar con Botsy.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "Tu consentimiento explícito para el tratamiento de datos de salud (art. 9.2.a RGPD). Sin él, la app no puede prestar el servicio de check-in.",
      },
      { titulo: "Destinatarios y encargados", cuerpo: DESTINATARIOS },
      { titulo: "Conservación", cuerpo: CONSERVACION_BASE },
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
          "Guardar la grabación de audio de tus check-ins por voz para que tu equipo sanitario pueda revisarla como apoyo a tu seguimiento. Es un permiso independiente del registro de la conversación: puedes hablar con Botsy sin otorgarlo y, en ese caso, no se graba nada.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "Tu consentimiento explícito, específico y separado (arts. 7 y 9.2.a RGPD), al tratarse la voz de un dato especialmente protegido.",
      },
      { titulo: "Destinatarios y encargados", cuerpo: DESTINATARIOS },
      {
        titulo: "Conservación",
        cuerpo:
          "El audio se almacena cifrado en un espacio privado con acceso restringido a tu equipo sanitario. " +
          CONSERVACION_BASE,
      },
      {
        titulo: "Efecto de la revocación",
        cuerpo:
          "Si retiras este permiso, a partir de tu siguiente check-in por voz Botsy dejará de grabar el audio de inmediato. Puedes solicitar además la supresión de las grabaciones anteriores ejerciendo tu derecho de supresión.",
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
          "Analizar características acústicas de tu voz (ritmo, pausas, energía) como señal de cribado —nunca como diagnóstico— para tu seguimiento a lo largo del tiempo. Esta funcionalidad se activará en una fase futura; hoy únicamente se recoge tu autorización, que podrás revisar cuando se active.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "Tu consentimiento explícito y separado del resto (arts. 7 y 9.2.a RGPD). Es totalmente opcional y no condiciona el uso de la app.",
      },
      { titulo: "Destinatarios y encargados", cuerpo: DESTINATARIOS },
      {
        titulo: "Conservación",
        cuerpo:
          "Se conservarán preferentemente las características derivadas (no el audio en bruto) y fragmentos mínimos de auditoría con caducidad. " +
          CONSERVACION_BASE,
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
          "Reutilizar tus datos de salud, previamente seudonimizados (sin tu nombre ni datos de contacto), para investigación, generación de evidencia científica y mejora del servicio. Es un permiso SEPARADO y estrictamente opcional: no otorgarlo no cambia en nada tu seguimiento ni tu atención.",
      },
      {
        titulo: "Base legitimadora",
        cuerpo:
          "Tu consentimiento explícito, específico y separado del resto (arts. 7 y 9.2.a RGPD). Ninguna funcionalidad de la app depende de él.",
      },
      {
        titulo: "Destinatarios y encargados",
        cuerpo:
          "Los resultados de investigación se comparten únicamente de forma agregada y anonimizada. " +
          DESTINATARIOS,
      },
      {
        titulo: "Conservación",
        cuerpo:
          "Los datos empleados para uso secundario se tratan seudonimizados y se conservan el tiempo necesario para los fines de investigación autorizados. " +
          CONSERVACION_BASE,
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
