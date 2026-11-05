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

  describe("movimientos de stock", () => {
    // Crea un producto y un usuario para colgarles movimientos.
    async function setup() {
      const category = await prisma.category.create({ data: { name: "Papelería" } });
      const product = await prisma.product.create({
        data: { name: "Cuaderno", categoryId: category.id, salePrice: "10.00" },
      });
      const user = await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });
      return { productId: product.id, userId: user.id };
    }

    it("guarda un ajuste con motivo y cantidad negativa", async () => {
      const { productId, userId } = await setup();

      const movement = await prisma.stockMovement.create({
        data: { productId, userId, type: "ADJUSTMENT", quantity: -2, reason: "DAMAGE_OR_LOSS" },
      });

      expect(movement.quantity).toBe(-2);
      expect(movement.createdAt).toBeInstanceOf(Date);
    });

    it("no permite un movimiento de un producto que no existe", async () => {
      const { userId } = await setup();

      await expect(
        prisma.stockMovement.create({ data: { productId: 999, userId, type: "INITIAL_STOCK", quantity: 5 } }),
      ).rejects.toThrow();
    });

    it("no permite un movimiento de un usuario que no existe", async () => {
      const { productId } = await setup();

      await expect(
        prisma.stockMovement.create({ data: { productId, userId: 999, type: "INITIAL_STOCK", quantity: 5 } }),
      ).rejects.toThrow();
    });

    it("no permite borrar un producto que tiene movimientos", async () => {
      const { productId, userId } = await setup();
      await prisma.stockMovement.create({ data: { productId, userId, type: "INITIAL_STOCK", quantity: 5 } });

      await expect(prisma.product.delete({ where: { id: productId } })).rejects.toThrow();
    });

    it("no permite borrar un usuario que tiene movimientos (queda quién los hizo)", async () => {
      const { productId, userId } = await setup();
      await prisma.stockMovement.create({ data: { productId, userId, type: "INITIAL_STOCK", quantity: 5 } });

      await expect(prisma.user.delete({ where: { id: userId } })).rejects.toThrow();
    });

    it("no permite un movimiento de cantidad cero", async () => {
      const { productId, userId } = await setup();

      await expect(
        prisma.stockMovement.create({
          data: { productId, userId, type: "ADJUSTMENT", quantity: 0, reason: "PHYSICAL_COUNT" },
        }),
      ).rejects.toThrow();
    });

    it("no permite un ajuste sin motivo", async () => {
      const { productId, userId } = await setup();

      await expect(
        prisma.stockMovement.create({ data: { productId, userId, type: "ADJUSTMENT", quantity: 1 } }),
      ).rejects.toThrow();
    });

    it("no permite un stock inicial con motivo de ajuste", async () => {
      const { productId, userId } = await setup();

      await expect(
        prisma.stockMovement.create({
          data: { productId, userId, type: "INITIAL_STOCK", quantity: 5, reason: "PHYSICAL_COUNT" },
        }),
      ).rejects.toThrow();
    });

    it("no permite un stock inicial negativo", async () => {
      const { productId, userId } = await setup();

      await expect(
        prisma.stockMovement.create({ data: { productId, userId, type: "INITIAL_STOCK", quantity: -5 } }),
      ).rejects.toThrow();
    });

    it("no permite el motivo 'otro' sin nota ni con la nota en blanco", async () => {
      const { productId, userId } = await setup();
      const data = { productId, userId, type: "ADJUSTMENT" as const, quantity: -1, reason: "OTHER" as const };

      await expect(prisma.stockMovement.create({ data })).rejects.toThrow();
      await expect(prisma.stockMovement.create({ data: { ...data, note: "   " } })).rejects.toThrow();
      await expect(prisma.stockMovement.create({ data: { ...data, note: "Se mojó" } })).resolves.toBeTruthy();
    });
  });

  describe("ventas", () => {
    async function setup() {
      const category = await prisma.category.create({ data: { name: "Papelería" } });
      const product = await prisma.product.create({
        data: { name: "Cuaderno", categoryId: category.id, salePrice: "10.00" },
      });
      const user = await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });
      const sale = await prisma.sale.create({ data: { userId: user.id, paymentMethod: "CASH" } });
      return { productId: product.id, userId: user.id, saleId: sale.id };
    }

    it("una venta nace confirmada y sin datos de anulación", async () => {
      const { saleId } = await setup();

      const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });

      expect(sale).toMatchObject({ status: "CONFIRMED", annulledAt: null, annulledById: null, annulmentReason: null });
    });

    it("no permite marcar una venta como anulada sin quién, cuándo y por qué", async () => {
      const { saleId, userId } = await setup();

      await expect(prisma.sale.update({ where: { id: saleId }, data: { status: "ANNULLED" } })).rejects.toThrow();
      await expect(
        prisma.sale.update({
          where: { id: saleId },
          data: { status: "ANNULLED", annulledAt: new Date(), annulledById: userId, annulmentReason: "   " },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.sale.update({
          where: { id: saleId },
          data: { status: "ANNULLED", annulledAt: new Date(), annulledById: userId, annulmentReason: "Error" },
        }),
      ).resolves.toBeTruthy();
    });

    it("no permite datos de anulación en una venta confirmada", async () => {
      const { saleId } = await setup();

      await expect(prisma.sale.update({ where: { id: saleId }, data: { annulmentReason: "Error" } })).rejects.toThrow();
    });

    it("no permite un ítem con cantidad cero, negativa o con precio cero", async () => {
      const { saleId, productId } = await setup();
      const item = { saleId, productId, quantity: 1, unitPrice: "10.00" };

      await expect(prisma.saleItem.create({ data: { ...item, quantity: 0 } })).rejects.toThrow();
      await expect(prisma.saleItem.create({ data: { ...item, quantity: -1 } })).rejects.toThrow();
      await expect(prisma.saleItem.create({ data: { ...item, unitPrice: "0.00" } })).rejects.toThrow();
      await expect(prisma.saleItem.create({ data: item })).resolves.toBeTruthy();
    });

    it("no permite repetir un producto dentro de la misma venta", async () => {
      const { saleId, productId } = await setup();
      await prisma.saleItem.create({ data: { saleId, productId, quantity: 1, unitPrice: "10.00" } });

      await expect(
        prisma.saleItem.create({ data: { saleId, productId, quantity: 2, unitPrice: "10.00" } }),
      ).rejects.toThrow();
    });

    it("guarda el precio con dos decimales exactos en el ítem", async () => {
      const { saleId, productId } = await setup();

      const item = await prisma.saleItem.create({ data: { saleId, productId, quantity: 3, unitPrice: "1500.55" } });

      expect(item.unitPrice.toFixed(2)).toBe("1500.55");
    });

    it("no permite borrar una venta con ítems, ni un producto o usuario que tienen ventas", async () => {
      const { saleId, productId, userId } = await setup();
      await prisma.saleItem.create({ data: { saleId, productId, quantity: 1, unitPrice: "10.00" } });

      await expect(prisma.sale.delete({ where: { id: saleId } })).rejects.toThrow();
      await expect(prisma.product.delete({ where: { id: productId } })).rejects.toThrow();
      await expect(prisma.user.delete({ where: { id: userId } })).rejects.toThrow();
    });

    it("los movimientos de venta exigen venta y cantidad negativa; los de anulación, cantidad positiva", async () => {
      const { saleId, productId, userId } = await setup();
      const base = { productId, userId };

      await expect(prisma.stockMovement.create({ data: { ...base, type: "SALE", quantity: -1 } })).rejects.toThrow();
      await expect(prisma.stockMovement.create({ data: { ...base, type: "SALE", quantity: 1, saleId } })).rejects.toThrow();
      await expect(prisma.stockMovement.create({ data: { ...base, type: "SALE", quantity: -1, saleId } })).resolves.toBeTruthy();
      await expect(
        prisma.stockMovement.create({ data: { ...base, type: "SALE_ANNULMENT", quantity: -1, saleId } }),
      ).rejects.toThrow();
      await expect(
        prisma.stockMovement.create({ data: { ...base, type: "SALE_ANNULMENT", quantity: 1, saleId } }),
      ).resolves.toBeTruthy();
    });

    it("un ajuste o un stock inicial no pueden llevar venta", async () => {
      const { saleId, productId, userId } = await setup();

      await expect(
        prisma.stockMovement.create({
          data: { productId, userId, type: "ADJUSTMENT", quantity: 1, reason: "PHYSICAL_COUNT", saleId },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.stockMovement.create({ data: { productId, userId, type: "INITIAL_STOCK", quantity: 1, saleId } }),
      ).rejects.toThrow();
    });
  });
});
