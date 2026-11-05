import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Las pruebas con base de datos comparten las mismas tablas:
    // los archivos de prueba se ejecutan de a uno para que no se pisen.
    fileParallelism: false,
  },
});
