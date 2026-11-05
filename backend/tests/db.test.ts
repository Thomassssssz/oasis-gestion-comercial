import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma } from "./helpers/db.js";

// El freno de seguridad: las pruebas nunca deben poder borrar la base real.
describe("createTestPrisma", () => {
  const original = {
    test: process.env.TEST_DATABASE_URL,
    main: process.env.DATABASE_URL,
  };

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/oasis";
  });

  afterEach(() => {
    process.env.TEST_DATABASE_URL = original.test;
    process.env.DATABASE_URL = original.main;
  });

  it("falla si falta TEST_DATABASE_URL", () => {
    delete process.env.TEST_DATABASE_URL;

    expect(() => createTestPrisma()).toThrow("Falta TEST_DATABASE_URL");
  });

  it("falla si apunta a la misma base que DATABASE_URL", () => {
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;

    expect(() => createTestPrisma()).toThrow("no puede ser igual");
  });

  it('falla si el nombre de la base no termina en "_test"', () => {
    process.env.TEST_DATABASE_URL = "postgresql://u:p@localhost:5432/produccion";

    expect(() => createTestPrisma()).toThrow('debe terminar en "_test"');
  });

  it("acepta una base cuyo nombre termina en _test", () => {
    process.env.TEST_DATABASE_URL = "postgresql://u:p@localhost:5432/oasis_test";

    expect(() => createTestPrisma()).not.toThrow();
  });
});
