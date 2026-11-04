import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    // Las pruebas con base de datos comparten las mismas tablas:
    // los archivos de prueba se ejecutan de a uno para que no se pisen.
    fileParallelism: false,
  },
});
