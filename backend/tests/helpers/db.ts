import { createPrismaClient } from "../../src/config/prisma.js";

// Devuelve un cliente conectado a la base de PRUEBAS.
// Las pruebas borran datos, así que se frena si la URL podría apuntar a la base real.
export function createTestPrisma() {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      "Falta TEST_DATABASE_URL. Copiá backend/.env.example como backend/.env y completalo.",
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL no puede ser igual a DATABASE_URL: las pruebas borran datos.");
  }
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error(`La base de pruebas debe terminar en "_test" (es "${databaseName}").`);
  }

  return createPrismaClient(url);
}

// Vacía las tablas antes de cada prueba. CASCADE y RESTART IDENTITY dejan todo como nuevo.
export async function resetDatabase(prisma: ReturnType<typeof createTestPrisma>) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Setting", "Customer", "SaleItem", "Sale", "StockMovement", "Session", "User", "Product", "Category" RESTART IDENTITY CASCADE');
}
