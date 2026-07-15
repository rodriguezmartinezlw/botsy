import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config de Vitest para el motor conversacional (WP-02).
 * Resuelve el alias `@` → `./src` (igual que tsconfig) para que los tests
 * importen los módulos de `src/lib/ia/*` sin rutas relativas frágiles.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
