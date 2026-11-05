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

describe("esquema: clientes", () => {
  it("no permite dos clientes con el mismo DNI", async () => {
    await prisma.customer.create({ data: { name: "Ana", dni: "30123456" } });

    await expect(prisma.customer.create({ data: { name: "Otra", dni: "30123456" } })).rejects.toThrow();
  });

  it("permite varios clientes sin DNI (los NULL no se consideran iguales) y homónimos", async () => {
    await prisma.customer.create({ data: { name: "Ana" } });
    await prisma.customer.create({ data: { name: "Ana" } });

    expect(await prisma.customer.count()).toBe(2);
  });

  it("no permite un nombre vacío o de solo espacios", async () => {
    await expect(prisma.customer.create({ data: { name: "" } })).rejects.toThrow();
    await expect(prisma.customer.create({ data: { name: "   " } })).rejects.toThrow();
  });

  it("por defecto el cliente nace activo y sin crédito autorizado", async () => {
    const customer = await prisma.customer.create({ data: { name: "Ana" } });

    expect(customer.active).toBe(true);
    expect(customer.creditAuthorized).toBe(false);
  });
});

describe("esquema: parámetros", () => {
  it("tiene una sola fila posible (id = 1) y el recargo por defecto es 5", async () => {
    const setting = await prisma.setting.create({ data: {} });

    expect(setting.id).toBe(1);
    expect(setting.lateFeePercent.toFixed(2)).toBe("5.00");
    await expect(prisma.setting.create({ data: { id: 2 } })).rejects.toThrow();
  });

  it("el porcentaje de recargo va de 0 a 100", async () => {
    await expect(prisma.setting.create({ data: { lateFeePercent: "100.01" } })).rejects.toThrow();
    await expect(prisma.setting.create({ data: { lateFeePercent: "-0.01" } })).rejects.toThrow();
    await expect(prisma.setting.create({ data: { lateFeePercent: "100" } })).resolves.toBeTruthy();
  });

  it("no permite borrar un usuario que cambió los parámetros", async () => {
    const user = await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });
    await prisma.setting.create({ data: { updatedById: user.id } });

    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow();
  });
});

describe("esquema: fichas de cuenta corriente y venta completa", () => {
  const opened = new Date("2026-03-10T15:00:00.000Z");
  const due = new Date("2026-04-10T15:00:00.000Z");

  async function seedUserAndCustomer() {
    const user = await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });
    const customer = await prisma.customer.create({ data: { name: "Ana", creditAuthorized: true } });
    return { user, customer };
  }

  it("el vencimiento tiene que ser posterior a la apertura", async () => {
    const { customer } = await seedUserAndCustomer();

    await expect(prisma.creditAccount.create({ data: { customerId: customer.id, openedAt: opened, dueDate: opened } })).rejects.toThrow();
    await expect(prisma.creditAccount.create({ data: { customerId: customer.id, openedAt: opened, dueDate: due } })).resolves.toBeTruthy();
  });

  it("una ficha abierta no tiene fecha de cierre y una cancelada sí", async () => {
    const { customer } = await seedUserAndCustomer();
    const base = { customerId: customer.id, openedAt: opened, dueDate: due };

    await expect(prisma.creditAccount.create({ data: { ...base, status: "OPEN", closedAt: due } })).rejects.toThrow();
    await expect(prisma.creditAccount.create({ data: { ...base, status: "CANCELLED" } })).rejects.toThrow();
    await expect(prisma.creditAccount.create({ data: { ...base, status: "CANCELLED", closedAt: due } })).resolves.toBeTruthy();
  });

  it("un cliente tiene como máximo una ficha abierta, pero puede tener varias canceladas", async () => {
    const { customer } = await seedUserAndCustomer();
    const base = { customerId: customer.id, openedAt: opened, dueDate: due };

    await prisma.creditAccount.create({ data: base });
    await expect(prisma.creditAccount.create({ data: base })).rejects.toThrow();

    await prisma.creditAccount.create({ data: { ...base, status: "CANCELLED", closedAt: due } });
    await prisma.creditAccount.create({ data: { ...base, status: "CANCELLED", closedAt: due } });
    expect(await prisma.creditAccount.count()).toBe(3);
  });

  it("no permite borrar un cliente con fichas ni una ficha con ventas", async () => {
    const { user, customer } = await seedUserAndCustomer();
    const account = await prisma.creditAccount.create({ data: { customerId: customer.id, openedAt: opened, dueDate: due } });
    await prisma.sale.create({ data: { userId: user.id, customerId: customer.id, onCredit: true, creditAccountId: account.id } });

    await expect(prisma.customer.delete({ where: { id: customer.id } })).rejects.toThrow();
    await expect(prisma.creditAccount.delete({ where: { id: account.id } })).rejects.toThrow();
  });

  describe("coherencia de la venta", () => {
    it("una venta a crédito exige cliente y ficha, y no lleva medio de pago", async () => {
      const { user, customer } = await seedUserAndCustomer();
      const account = await prisma.creditAccount.create({ data: { customerId: customer.id, openedAt: opened, dueDate: due } });
      const credit = { userId: user.id, onCredit: true };

      await expect(prisma.sale.create({ data: { ...credit, creditAccountId: account.id } })).rejects.toThrow(); // sin cliente
      await expect(prisma.sale.create({ data: { ...credit, customerId: customer.id } })).rejects.toThrow(); // sin ficha
      await expect(
        prisma.sale.create({ data: { ...credit, customerId: customer.id, creditAccountId: account.id, paymentMethod: "CASH" } }),
      ).rejects.toThrow();
      await expect(
        prisma.sale.create({ data: { ...credit, customerId: customer.id, creditAccountId: account.id } }),
      ).resolves.toBeTruthy();
    });

    it("una venta que no es a crédito exige medio de pago y no puede tener ficha", async () => {
      const { user, customer } = await seedUserAndCustomer();
      const account = await prisma.creditAccount.create({ data: { customerId: customer.id, openedAt: opened, dueDate: due } });

      await expect(prisma.sale.create({ data: { userId: user.id } })).rejects.toThrow();
      await expect(
        prisma.sale.create({ data: { userId: user.id, paymentMethod: "CASH", creditAccountId: account.id } }),
      ).rejects.toThrow();
      await expect(prisma.sale.create({ data: { userId: user.id, paymentMethod: "CASH" } })).resolves.toBeTruthy();
    });

    it("el descuento no puede ser negativo y la nota no puede ser solo espacios", async () => {
      const { user } = await seedUserAndCustomer();
      const cash = { userId: user.id, paymentMethod: "CASH" as const };

      await expect(prisma.sale.create({ data: { ...cash, discountAmount: "-1.00" } })).rejects.toThrow();
      await expect(prisma.sale.create({ data: { ...cash, note: "   " } })).rejects.toThrow();
      await expect(prisma.sale.create({ data: { ...cash, discountAmount: "0.00", note: "Pedido" } })).resolves.toBeTruthy();
    });
  });
});

describe("esquema: pagos y recargos de las fichas", () => {
  async function seedAccount() {
    const user = await prisma.user.create({ data: { username: "ana", fullName: "Ana", passwordHash: "x" } });
    const customer = await prisma.customer.create({ data: { name: "Ana", creditAuthorized: true } });
    const account = await prisma.creditAccount.create({
      data: { customerId: customer.id, openedAt: new Date("2026-03-10T15:00:00Z"), dueDate: new Date("2026-04-10T15:00:00Z") },
    });
    return { user, account };
  }
  const charged = new Date("2026-05-10T15:00:00Z");

  it("un pago es siempre mayor que cero y su nota no puede ser solo espacios", async () => {
    const { user, account } = await seedAccount();
    const base = { accountId: account.id, userId: user.id, paymentMethod: "CASH" as const };

    await expect(prisma.accountPayment.create({ data: { ...base, amount: "0.00" } })).rejects.toThrow();
    await expect(prisma.accountPayment.create({ data: { ...base, amount: "-1.00" } })).rejects.toThrow();
    await expect(prisma.accountPayment.create({ data: { ...base, amount: "1.00", note: "  " } })).rejects.toThrow();
    await expect(prisma.accountPayment.create({ data: { ...base, amount: "0.01", note: "Seña" } })).resolves.toBeTruthy();
  });

  it("un pago exige medio de pago", async () => {
    const { user, account } = await seedAccount();
    await expect(
      prisma.$executeRaw`INSERT INTO "AccountPayment" ("accountId", "userId", "amount") VALUES (${account.id}, ${user.id}, 10)`,
    ).rejects.toThrow();
  });

  it("un recargo tiene mes desde 1, base, monto y porcentaje (hasta 100) mayores que cero", async () => {
    const { user, account } = await seedAccount();
    const ok = { accountId: account.id, userId: user.id, monthNumber: 1, base: "1000.00", percent: "5.00", amount: "50.00", chargedOn: charged };

    await expect(prisma.surcharge.create({ data: { ...ok, monthNumber: 0 } })).rejects.toThrow();
    await expect(prisma.surcharge.create({ data: { ...ok, base: "0.00" } })).rejects.toThrow();
    await expect(prisma.surcharge.create({ data: { ...ok, amount: "0.00" } })).rejects.toThrow();
    await expect(prisma.surcharge.create({ data: { ...ok, percent: "0.00" } })).rejects.toThrow();
    await expect(prisma.surcharge.create({ data: { ...ok, percent: "100.01" } })).rejects.toThrow();
    await expect(prisma.surcharge.create({ data: { ...ok, percent: "100.00" } })).resolves.toBeTruthy();
  });

  it("no se puede cobrar dos veces el mismo mes de una ficha, pero sí el mismo mes en otra ficha", async () => {
    const { user, account } = await seedAccount();
    const other = await prisma.creditAccount.create({
      data: { customerId: account.customerId, status: "CANCELLED", openedAt: new Date("2026-01-10T15:00:00Z"), dueDate: new Date("2026-02-10T15:00:00Z"), closedAt: new Date("2026-02-01T15:00:00Z") },
    });
    const data = { userId: user.id, monthNumber: 1, base: "1000.00", percent: "5.00", amount: "50.00", chargedOn: charged };

    await prisma.surcharge.create({ data: { ...data, accountId: account.id } });
    await expect(prisma.surcharge.create({ data: { ...data, accountId: account.id } })).rejects.toThrow();
    await expect(prisma.surcharge.create({ data: { ...data, accountId: other.id } })).resolves.toBeTruthy();
  });

  it("no permite borrar una ficha ni un usuario que tienen pagos o recargos", async () => {
    const { user, account } = await seedAccount();
    await prisma.accountPayment.create({ data: { accountId: account.id, userId: user.id, amount: "10.00", paymentMethod: "CASH" } });
    await prisma.surcharge.create({
      data: { accountId: account.id, userId: user.id, monthNumber: 1, base: "10.00", percent: "5.00", amount: "0.50", chargedOn: charged },
    });

    await expect(prisma.creditAccount.delete({ where: { id: account.id } })).rejects.toThrow();
    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow();
  });

  it("guarda los importes con dos decimales exactos", async () => {
    const { user, account } = await seedAccount();
    const payment = await prisma.accountPayment.create({
      data: { accountId: account.id, userId: user.id, amount: "1234.50", paymentMethod: "TRANSFER" },
    });
    expect(payment.amount.toFixed(2)).toBe("1234.50");
  });
});
