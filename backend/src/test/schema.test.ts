import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma, resetDatabase } from "./db.js";

// Comprueba que la base real (creada por la migración) cumple las reglas del modelo.
const prisma = createTestPrisma();

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe("esquema de la base de datos", () => {
  it("no permite dos categorías con el mismo nombre", async () => {
    await prisma.category.create({ data: { name: "Papelería" } });

    await expect(prisma.category.create({ data: { name: "Papelería" } })).rejects.toThrow();
  });

  it("no permite un producto con una categoría que no existe", async () => {
    await expect(
      prisma.product.create({ data: { name: "Cuaderno", categoryId: 999, salePrice: "10.00" } }),
    ).rejects.toThrow();
  });

  it("no permite borrar una categoría que tiene productos", async () => {
    const category = await prisma.category.create({ data: { name: "Papelería" } });
    await prisma.product.create({
      data: { name: "Cuaderno", categoryId: category.id, salePrice: "10.00" },
    });

    await expect(prisma.category.delete({ where: { id: category.id } })).rejects.toThrow();
  });

  it("guarda el precio con dos decimales exactos (Decimal, no float)", async () => {
    const category = await prisma.category.create({ data: { name: "Papelería" } });
    const product = await prisma.product.create({
      data: { name: "Lapicera", categoryId: category.id, salePrice: "1234.50" },
    });

    expect(product.salePrice.toString()).toBe("1234.5");
    expect(product.salePrice.toFixed(2)).toBe("1234.50");
    expect(product.minStock).toBe(0);
    expect(product.active).toBe(true);
  });
});
