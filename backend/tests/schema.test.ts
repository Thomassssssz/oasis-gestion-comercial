import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";

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

  it("no permite dos usuarios con el mismo nombre de usuario", async () => {
    await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });

    await expect(
      prisma.user.create({ data: { username: "ana", fullName: "Otra Ana", passwordHash: "y" } }),
    ).rejects.toThrow();
  });

  it("no permite una sesión de un usuario que no existe", async () => {
    await expect(
      prisma.session.create({ data: { tokenHash: "abc", userId: 999, expiresAt: new Date() } }),
    ).rejects.toThrow();
  });

  it("borra las sesiones de un usuario cuando se borra el usuario", async () => {
    const user = await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });
    await prisma.session.create({ data: { tokenHash: "abc", userId: user.id, expiresAt: new Date() } });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.session.count()).toBe(0);
  });

  it("no permite repetir el código de sesión", async () => {
    const user = await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });
    await prisma.session.create({ data: { tokenHash: "abc", userId: user.id, expiresAt: new Date() } });

    await expect(
      prisma.session.create({ data: { tokenHash: "abc", userId: user.id, expiresAt: new Date() } }),
    ).rejects.toThrow();
  });
});
