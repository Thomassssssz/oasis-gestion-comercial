import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("lee DATABASE_URL y usa el puerto 3000 por defecto", () => {
    const env = loadEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/oasis" });

    expect(env).toEqual({ DATABASE_URL: "postgresql://u:p@localhost:5432/oasis", PORT: 3000 });
  });

  it("toma el puerto de PORT", () => {
    const env = loadEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/oasis", PORT: "4000" });

    expect(env.PORT).toBe(4000);
  });

  it("falla con un mensaje claro si falta DATABASE_URL", () => {
    expect(() => loadEnv({})).toThrow("Falta DATABASE_URL");
  });
});
