import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";

// La migración que carga el encabezado original del remito (D23-g). Las pruebas la vuelven a correr sobre la tabla vacía.
const prisma = createTestPrisma();
const sql = readFileSync(new URL("../prisma/migrations/20261105110000_remito_header_defaults/migration.sql", import.meta.url), "utf8");
const statements = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
const runMigration = async () => {
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
};

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe("migración: encabezado original del remito", () => {
  it("con la tabla vacía crea los parámetros con el encabezado del papel y un CUIT y Ingresos Brutos de ejemplo", async () => {
    await runMigration();

    const row = await prisma.setting.findUniqueOrThrow({ where: { id: 1 } });
    expect(row).toMatchObject({
      businessName: "Ediciones Oasis",
      businessOwner: "DIEGO FRANCISCO SCAGLIA",
      businessAddress: "Bº LA PLATA - MZ. 50 - LOTE A\n3601 - HERRADURA\nFORMOSA",
      businessTaxCondition: "MONOTAX",
      businessCuit: "20123456789", // de ejemplo
      businessGrossIncome: "01-20-12345678-9", // de ejemplo
      businessActivityStart: "03/2011",
    });
    expect(row.lateFeePercent.toFixed(2)).toBe("5.00"); // el recargo por defecto no se toca
  });

  it("si ya había parámetros pero el encabezado estaba vacío, lo completa y conserva el recargo", async () => {
    await prisma.setting.create({ data: { id: 1, lateFeePercent: "7.5" } });

    await runMigration();

    const row = await prisma.setting.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.businessName).toBe("Ediciones Oasis");
    expect(row.lateFeePercent.toFixed(2)).toBe("7.50");
  });

  it("no pisa un encabezado que alguien ya cargó, ni siquiera un solo dato", async () => {
    await prisma.setting.create({ data: { id: 1, businessGrossIncome: "999" } });

    await runMigration();

    const row = await prisma.setting.findUniqueOrThrow({ where: { id: 1 } });
    expect(row).toMatchObject({ businessGrossIncome: "999", businessName: null, businessCuit: null });
  });

  it("correrla otra vez no cambia lo que se editó después", async () => {
    await runMigration();
    await prisma.setting.update({ where: { id: 1 }, data: { businessName: "Otro nombre", businessCuit: "30711111111" } });

    await runMigration();

    expect(await prisma.setting.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({ businessName: "Otro nombre", businessCuit: "30711111111" });
  });
});
