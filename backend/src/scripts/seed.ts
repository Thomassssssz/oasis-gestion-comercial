import { loadEnv } from "../config/env.js";
import { createPrismaClient } from "../config/prisma.js";
import { seedDatabase } from "../services/seed.service.js";

// Llena la base de desarrollo con datos de prueba (1.000 productos, 50 clientes, ventas, pagos y fichas).
// Uso:  npm run db:seed -- <usuario>
// El usuario tiene que existir (npm run user:create) y la base tiene que estar vacía de productos, clientes y ventas.

async function main() {
  const [username] = process.argv.slice(2);
  if (!username) {
    console.error("Uso: npm run db:seed -- <usuario>");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production") {
    console.error("La seed no se corre en producción.");
    process.exit(1);
  }

  try {
    process.loadEnvFile();
  } catch {
    // Sin .env: se usan las variables que ya tenga el entorno.
  }
  const prisma = createPrismaClient(loadEnv().DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      console.error(`No existe el usuario "${username}". Creálo con: npm run user:create -- ${username} "Nombre completo"`);
      process.exitCode = 1;
      return;
    }

    console.log("Cargando datos de prueba (tarda un momento)...");
    const summary = await seedDatabase(prisma, { userId: user.id });
    console.log("Listo:");
    console.table(summary);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await main();
