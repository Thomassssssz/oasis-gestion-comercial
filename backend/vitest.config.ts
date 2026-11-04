import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"], // src/ se quita cuando todas las pruebas estén en tests/
    setupFiles: ["./tests/setup.ts"],
    // Las pruebas con base de datos comparten las mismas tablas:
    // los archivos de prueba se ejecutan de a uno para que no se pisen.
    fileParallelism: false,
  },
});
