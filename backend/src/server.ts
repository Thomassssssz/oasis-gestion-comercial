import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPrismaClient } from "./lib/prisma.js";

// Carga backend/.env si existe (en producción las variables vienen del entorno).
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables que ya tenga el entorno.
}

const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);

createApp({ prisma }).listen(env.PORT, () => {
  console.log(`API de Oasis escuchando en http://localhost:${env.PORT}`);
});
