/**
 * Plantillas amigables de reglas de escalado por paciente (WP-06).
 *
 * Módulo PURO y seguro para cliente (solo `zod` y el TIPO `Condicion` de WP-04,
 * que se borra en build). El profesional NO edita JSON crudo: elige una
 * plantilla ("Avisarme si el dolor supera X", "…si deja de tomar su medicación
 * importante N días", "…si el ánimo baja de X durante N días"), rellena unos
 * pocos campos, y aquí se genera el JSONB de `reglas_escalado.condicion` con el
 * formato EXACTO que evalúa el motor de WP-04 (`src/lib/escalado/motor.ts`).
 *
 * `describirCondicion` hace el camino inverso: convierte una condición ya
 * parseada en una frase en español, para mostrar en solo-lectura las reglas
 * globales y las del paciente sin exponer el JSON.
 */

import { z } from "zod";
import type {
  Condicion,
  CondObservacion,
  CondAdherencia,
  CondTendencia,
} from "@/lib/escalado/motor";
import type { NivelEscalado } from "@/types/db";

// --- Niveles con etiqueta amigable -------------------------------------------

/** Etiqueta legible del nivel de escalado para el profesional (sin jerga). */
export const ETIQUETA_NIVEL: Record<NivelEscalado, string> = {
  vigilancia: "Seguimiento (sin urgencia)",
  contactar: "Contactar con el paciente",
  urgencia: "Urgente",
};

export const NIVELES: NivelEscalado[] = ["vigilancia", "contactar", "urgencia"];

// --- Catálogo de plantillas --------------------------------------------------

export type IdPlantilla = "dolor_alto" | "omision_critico" | "animo_bajo";

/** Descriptor de un campo numérico de una plantilla (para pintar el formulario). */
export type CampoPlantilla = {
  clave: "umbral" | "dias";
  etiqueta: string;
  min: number;
  max: number;
  porDefecto: number;
  sufijo?: string;
};

export type Plantilla = {
  id: IdPlantilla;
  titulo: string;
  /** Frase con "{umbral}"/"{dias}" que se muestra como vista previa. */
  patronFrase: string;
  campos: CampoPlantilla[];
  nivelPorDefecto: NivelEscalado;
};

export const PLANTILLAS: Plantilla[] = [
  {
    id: "dolor_alto",
    titulo: "Dolor elevado",
    patronFrase: "Avísame si el dolor llega a {umbral} o más (escala 0–10).",
    campos: [
      { clave: "umbral", etiqueta: "Nivel de dolor", min: 1, max: 10, porDefecto: 8, sufijo: "/10" },
    ],
    nivelPorDefecto: "contactar",
  },
  {
    id: "omision_critico",
    titulo: "Medicación importante sin tomar",
    patronFrase:
      "Avísame si deja de tomar su medicación importante {dias} día(s) seguidos.",
    campos: [
      { clave: "dias", etiqueta: "Días seguidos", min: 1, max: 14, porDefecto: 2, sufijo: "días" },
    ],
    nivelPorDefecto: "contactar",
  },
  {
    id: "animo_bajo",
    titulo: "Ánimo bajo sostenido",
    patronFrase:
      "Avísame si el ánimo baja de {umbral} durante {dias} día(s) seguidos (escala 0–10).",
    campos: [
      { clave: "umbral", etiqueta: "Ánimo por debajo de", min: 0, max: 10, porDefecto: 3, sufijo: "/10" },
      { clave: "dias", etiqueta: "Durante (días seguidos)", min: 1, max: 14, porDefecto: 3, sufijo: "días" },
    ],
    nivelPorDefecto: "vigilancia",
  },
];

export function plantillaPorId(id: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id);
}

// --- Validación de la entrada del formulario ---------------------------------

export const esquemaEntradaPlantilla = z
  .object({
    plantilla: z.enum(["dolor_alto", "omision_critico", "animo_bajo"]),
    nivel: z.enum(["vigilancia", "contactar", "urgencia"]),
    umbral: z.number().int().min(0).max(10).optional(),
    dias: z.number().int().min(1).max(14).optional(),
  })
  .strict();

export type EntradaPlantilla = z.infer<typeof esquemaEntradaPlantilla>;

export type ReglaGenerada = {
  nombre: string;
  descripcion: string;
  condicion: Condicion;
  nivel: NivelEscalado;
};

export type ResultadoPlantilla =
  | { ok: true; regla: ReglaGenerada }
  | { ok: false; error: string };

function reemplazar(frase: string, params: EntradaPlantilla): string {
  return frase
    .replace("{umbral}", String(params.umbral ?? ""))
    .replace("{dias}", String(params.dias ?? ""));
}

/**
 * Genera la regla (nombre + descripción legible + `condicion` JSONB de WP-04 +
 * nivel) a partir de una plantilla y sus parámetros. Valida con Zod y comprueba
 * que estén los campos que la plantilla requiere. Nunca lanza.
 */
export function construirReglaDesdePlantilla(
  entrada: unknown,
): ResultadoPlantilla {
  const analizado = esquemaEntradaPlantilla.safeParse(entrada);
  if (!analizado.success) {
    return { ok: false, error: "Datos de la regla no válidos." };
  }
  const p = analizado.data;
  const plantilla = plantillaPorId(p.plantilla);
  if (!plantilla) return { ok: false, error: "Plantilla desconocida." };

  const frase = reemplazar(plantilla.patronFrase, p);

  switch (p.plantilla) {
    case "dolor_alto": {
      if (p.umbral === undefined) {
        return { ok: false, error: "Falta el nivel de dolor." };
      }
      const condicion: CondObservacion = {
        tipo: "observacion",
        dominio: "dolor",
        valor_num_gte: p.umbral,
      };
      return {
        ok: true,
        regla: {
          nombre: `Dolor alto (≥ ${p.umbral}/10)`,
          descripcion: frase,
          condicion,
          nivel: p.nivel,
        },
      };
    }
    case "omision_critico": {
      if (p.dias === undefined) {
        return { ok: false, error: "Faltan los días seguidos." };
      }
      const condicion: CondAdherencia = {
        tipo: "adherencia_critica",
        dias_consecutivos: p.dias,
      };
      return {
        ok: true,
        regla: {
          nombre: `Medicación importante sin tomar (${p.dias} día/s)`,
          descripcion: frase,
          condicion,
          nivel: p.nivel,
        },
      };
    }
    case "animo_bajo": {
      if (p.umbral === undefined || p.dias === undefined) {
        return { ok: false, error: "Faltan el umbral o los días." };
      }
      const condicion: CondTendencia = {
        tipo: "tendencia",
        dominio: "animo",
        valor_num_lte: p.umbral,
        dias_consecutivos: p.dias,
      };
      return {
        ok: true,
        regla: {
          nombre: `Ánimo bajo (≤ ${p.umbral}) durante ${p.dias} día/s`,
          descripcion: frase,
          condicion,
          nivel: p.nivel,
        },
      };
    }
  }
}

// --- Descripción legible de una condición (camino inverso) -------------------

const NOMBRE_DOMINIO: Record<string, string> = {
  dolor: "dolor",
  animo: "ánimo",
  ansiedad: "ansiedad",
  estres: "estrés",
  sueno: "sueño",
  cognicion: "cognición",
  sintoma_fisico: "síntoma físico",
  adherencia: "adherencia",
};

function nombreDominio(dominio: string): string {
  return NOMBRE_DOMINIO[dominio] ?? dominio.replace(/_/g, " ");
}

function rango(gte?: number, lte?: number): string {
  const partes: string[] = [];
  if (gte !== undefined) partes.push(`≥ ${gte}`);
  if (lte !== undefined) partes.push(`≤ ${lte}`);
  return partes.join(" y ");
}

/**
 * Convierte una condición ya parseada (WP-04) en una frase en español para
 * mostrarla en solo-lectura (reglas globales y del paciente). Nunca lanza.
 */
export function describirCondicion(cond: Condicion): string {
  switch (cond.tipo) {
    case "observacion": {
      const r = rango(cond.valor_num_gte, cond.valor_num_lte);
      const cod = cond.codigo ? ` (${cond.codigo.replace(/_/g, " ")})` : "";
      return `${nombreDominio(cond.dominio)}${cod}${r ? ` ${r}` : " registrado"}`;
    }
    case "senal":
      return `señal detectada: ${cond.codigo.replace(/_/g, " ")}`;
    case "adherencia_critica":
      return `medicación importante sin tomar ${cond.dias_consecutivos} día(s) seguidos`;
    case "tendencia": {
      const r = rango(cond.valor_num_gte, cond.valor_num_lte);
      return `${nombreDominio(cond.dominio)} ${r} durante ${cond.dias_consecutivos} día(s) seguidos`;
    }
    case "instrumento": {
      const r = rango(cond.puntuacion_gte, cond.puntuacion_lte);
      const nombre =
        cond.instrumento === "termometro_distres_nccn"
          ? "termómetro de distrés"
          : cond.instrumento.replace(/_/g, " ");
      return `${nombre}${r ? ` ${r}` : " registrado"}`;
    }
    case "combinacion": {
      const todas = (cond.todas ?? []).map(describirCondicion);
      const alguna = (cond.alguna ?? []).map(describirCondicion);
      const partes: string[] = [];
      if (todas.length > 0) partes.push(todas.join(" y "));
      if (alguna.length > 0) partes.push(`alguna de: ${alguna.join(", ")}`);
      return partes.join("; ");
    }
  }
}
