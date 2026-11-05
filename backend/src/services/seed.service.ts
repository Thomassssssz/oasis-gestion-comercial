import { Prisma, type PrismaClient } from "../config/prisma.js";
import { AppError } from "../helpers/errors.js";
import { addDays, localDate, startOfLocalDay } from "../helpers/report-dates.js";
import { createRandom, generateCustomers, generateProducts, seedCategories } from "../helpers/seed-data.js";
import { createCategoryRepository } from "../repositories/category.repository.js";
import { createCreditAccountRepository } from "../repositories/credit-account.repository.js";
import { createCustomerRepository } from "../repositories/customer.repository.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createSaleRepository } from "../repositories/sale.repository.js";
import { createCategoryService } from "./category.service.js";
import { createCreditAccountService } from "./credit-account.service.js";
import { createCustomerService } from "./customer.service.js";
import { createProductService } from "./product.service.js";
import { createSaleService } from "./sale.service.js";
import { customerInputSchema } from "../validators/customer.validator.js";
import { productInputSchema } from "../validators/product.validator.js";
import { saleInputSchema } from "../validators/sale.validator.js";

export type SeedOptions = {
  userId: number; // quién figura como autor de las ventas, pagos y movimientos
  products?: number;
  customers?: number;
  days?: number; // cuántos días hacia atrás se simula la actividad
  seed?: number; // semilla del azar: la misma semilla da siempre los mismos datos
  now?: Date;
};

export type SeedSummary = Awaited<ReturnType<typeof seedDatabase>>;

const ANNULMENT_REASONS = ["Se cargó mal el producto", "El cliente se arrepintió", "Error en la cantidad", "Venta duplicada"];
const roundTo50 = (amount: number) => Math.max(50, Math.round(amount / 50) * 50);

// Llena la base con datos de prueba (D21). Pasa por los MISMOS servicios que usa la API, no escribe las tablas a mano:
// así las reglas de negocio se cumplen (stock, descuento, fichas, vencimientos, recargos) y los datos quedan coherentes.
// La actividad se simula día por día hacia atrás, con un reloj que va avanzando, para que haya ventas de varias fechas,
// fichas vencidas con recargos, pagos parciales, fichas canceladas y alguna venta anulada.
// Solo corre sobre una base vacía: nunca mezcla datos de prueba con datos que alguien cargó.
export async function seedDatabase(prisma: PrismaClient, options: SeedOptions) {
  const { userId, products: productCount = 1000, customers: customerCount = 50, days = 75, seed = 20261104, now = new Date() } = options;
  const random = createRandom(seed);

  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    throw new Error("El usuario indicado no existe: creá uno con npm run user:create");
  }
  const existing = (await prisma.product.count()) + (await prisma.customer.count()) + (await prisma.sale.count()) + (await prisma.category.count());
  if (existing > 0) {
    throw new Error("La base ya tiene productos, clientes, categorías o ventas: la seed solo se corre sobre una base vacía");
  }

  // Un reloj compartido: cada operación "ocurre" en el momento que marca.
  let clock = now;
  const clockFn = () => clock;
  const categoryService = createCategoryService(createCategoryRepository(prisma));
  const productService = createProductService(createProductRepository(prisma));
  const customerService = createCustomerService(createCustomerRepository(prisma));
  const saleService = createSaleService(createSaleRepository(prisma), clockFn);
  const accountService = createCreditAccountService(createCreditAccountRepository(prisma), clockFn);

  const today = localDate(now);
  const firstDay = addDays(today, -days);

  // 1. Categorías y productos.
  const categoryIds = new Map<string, number>();
  for (const { name } of seedCategories()) categoryIds.set(name, (await categoryService.create(name)).id);

  const products: { id: number; price: number; minStock: number }[] = [];
  for (const product of generateProducts(productCount, random)) {
    const data = productInputSchema.parse({
      name: product.name,
      categoryId: categoryIds.get(product.categoryName)!,
      salePrice: product.salePrice,
      minStock: product.minStock,
    });
    // Number solo sirve acá para elegir descuentos redondos; el dinero se guarda siempre como texto con 2 decimales.
    products.push({ id: (await productService.create(data)).id, price: Number(product.salePrice), minStock: data.minStock });
  }

  // 2. Stock inicial, anterior a la primera venta. Una parte queda cerca del mínimo y unos pocos sin stock.
  await prisma.stockMovement.createMany({
    data: products.flatMap((product) => {
      const roll = random.next();
      if (roll < 0.03) return [];
      const quantity = roll < 0.1 ? random.int(1, Math.max(1, product.minStock)) : random.int(20, 250);
      return [{ productId: product.id, userId, type: "INITIAL_STOCK" as const, quantity, createdAt: startOfLocalDay(firstDay) }];
    }),
  });

  // 3. Clientes.
  const customers: { id: number; creditAuthorized: boolean }[] = [];
  for (const customer of generateCustomers(customerCount, random)) {
    const created = await customerService.create(customerInputSchema.parse(customer));
    customers.push({ id: created.id, creditAuthorized: created.creditAuthorized });
  }
  const creditCustomers = customers.filter((c) => c.creditAuthorized);
  // Cerca del 40% de los clientes con crédito "se atrasa": casi nunca paga, así quedan fichas vencidas para probar la mora.
  const latePayers = new Set(creditCustomers.filter(() => random.chance(0.4)).map((c) => c.id));

  // 4. Actividad día por día. Los productos "populares" se venden mucho más que el resto (así el top de Reportes tiene forma).
  const popularity = random.shuffle(products);
  const pickProduct = () => popularity[Math.floor(popularity.length * random.next() ** 2.2)]!;

  let sales = 0;
  let annulled = 0;
  let payments = 0;
  let skipped = 0; // intentos rechazados por las reglas (por ejemplo, sin stock): la seed los saltea

  async function sell(customerId: number | undefined, onCredit: boolean) {
    const items: { productId: number; quantity: number }[] = [];
    const wanted = random.pickWeighted([[1, 55], [2, 25], [3, 12], [4, 8]] as const);
    for (let attempt = 0; attempt < 12 && items.length < wanted; attempt++) {
      const product = pickProduct();
      if (items.some((item) => item.productId === product.id)) continue;
      const quantity = random.pickWeighted([[1, 60], [2, 25], [3, 10], [4, 5]] as const);
      items.push({ productId: product.id, quantity });
    }

    const input = saleInputSchema.parse({
      items,
      customerId,
      onCredit,
      ...(onCredit ? {} : { paymentMethod: random.pickWeighted([["CASH", 50], ["TRANSFER", 20], ["CARD", 20], ["DIGITAL_WALLET", 10]] as const) }),
    });

    try {
      const sale = await saleService.register(userId, input);
      sales++;
      if (random.chance(0.015)) {
        clock = new Date(clock.getTime() + random.int(1, 30) * 60_000);
        try {
          await saleService.annul(sale.id, userId, { reason: random.pick(ANNULMENT_REASONS) });
          annulled++;
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
        }
      }
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      skipped++;
    }
  }

  async function pay() {
    const open = await accountService.list({ status: "OPEN" });
    if (open.length === 0) return;
    const account = random.pick(open);
    if (latePayers.has(account.customer.id) && !random.chance(0.03)) return;
    // El 30% de las veces paga todo lo que debe (la ficha pasa al historial); el resto, un pago parcial.
    const wanted = new Prisma.Decimal(roundTo50(Number(account.balance) * (0.2 + random.next() * 0.5)));
    const amount = random.chance(0.3) || wanted.greaterThanOrEqualTo(account.payable) ? account.payable : wanted.toFixed(2);
    try {
      await accountService.pay(account.id, userId, {
        amount,
        paymentMethod: random.pickWeighted([["CASH", 60], ["TRANSFER", 25], ["DIGITAL_WALLET", 10], ["CARD", 5]] as const),
        note: null,
      });
      payments++;
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }
  }

  for (let day = firstDay; day < today; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = domingo
    const cashSales = weekday === 0 ? random.int(0, 3) : weekday === 6 ? random.int(5, 12) : random.int(7, 18);

    type Event = { minute: number; run: () => Promise<void> };
    const events: Event[] = [];
    const at = () => random.int(9 * 60, 20 * 60); // horario comercial: de 9 a 20 hs de Argentina
    for (let i = 0; i < cashSales; i++) {
      const customerId = random.chance(0.25) ? random.pick(customers).id : undefined;
      events.push({ minute: at(), run: () => sell(customerId, false) });
    }
    for (const customer of creditCustomers) {
      if (random.chance(0.045)) events.push({ minute: at(), run: () => sell(customer.id, true) });
    }
    for (let i = random.pickWeighted([[0, 5], [1, 4], [2, 1]] as const); i > 0; i--) events.push({ minute: at(), run: pay });

    for (const event of events.sort((a, b) => a.minute - b.minute)) {
      clock = new Date(startOfLocalDay(day).getTime() + event.minute * 60_000);
      await event.run();
    }
  }

  // Al final, a la mitad de las fichas vencidas se les registran los recargos (las demás los muestran pendientes de registrar).
  clock = now;
  for (const account of await accountService.list({ status: "OPEN" })) {
    if (account.overdue && random.chance(0.5)) await accountService.applySurcharges(account.id, userId);
  }

  // 5. Los movimientos de stock de cada venta se crean con la hora real de la seed: se llevan al momento de la venta
  // (y al de la anulación), para que el historial de Inventario tenga las fechas correctas.
  await prisma.$executeRaw`UPDATE "StockMovement" m SET "createdAt" = s."createdAt" FROM "Sale" s WHERE m."saleId" = s."id" AND m."type" = 'SALE'`;
  await prisma.$executeRaw`UPDATE "StockMovement" m SET "createdAt" = s."annulledAt" FROM "Sale" s WHERE m."saleId" = s."id" AND m."type" = 'SALE_ANNULMENT'`;

  // 6. Para probar filtros: unos pocos productos y clientes (sin crédito) dados de baja.
  const inactiveProducts = random.shuffle(products).slice(0, Math.min(12, products.length)).map((p) => p.id);
  await prisma.product.updateMany({ where: { id: { in: inactiveProducts } }, data: { active: false } });
  const inactiveCustomers = customers.filter((c) => !c.creditAuthorized).slice(0, 2).map((c) => c.id);
  await prisma.customer.updateMany({ where: { id: { in: inactiveCustomers } }, data: { active: false } });

  return {
    categories: categoryIds.size,
    products: products.length,
    customers: customers.length,
    creditCustomers: creditCustomers.length,
    sales,
    annulled,
    skipped,
    payments,
    openAccounts: await prisma.creditAccount.count({ where: { status: "OPEN" } }),
    cancelledAccounts: await prisma.creditAccount.count({ where: { status: "CANCELLED" } }),
  };
}
