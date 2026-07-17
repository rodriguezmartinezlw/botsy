import { MARCA_DEMO } from "@/lib/demo";

/**
 * Marca de agua del MODO DEMO (WP-17). Banner permanente + filigrana diagonal
 * tenue, para que quede INEQUÍVOCO —en pantalla y en el PDF— que los datos son
 * sintéticos y no hay pacientes reales. Se muestra solo cuando `DEMO_MODE`.
 */
export default function MarcaDemo() {
  return (
    <>
      <div
        role="status"
        className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900"
      >
        <span aria-hidden>▲</span>
        {MARCA_DEMO} · no contiene pacientes reales
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <span
          className="whitespace-nowrap text-6xl font-black uppercase tracking-widest text-amber-400/10 md:text-8xl"
          style={{ transform: "rotate(-24deg)" }}
        >
          DEMO · datos sintéticos
        </span>
      </div>
    </>
  );
}
