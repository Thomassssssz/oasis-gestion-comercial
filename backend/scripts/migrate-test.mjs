// Aplica las migraciones de Prisma a la base de PRUEBAS (TEST_DATABASE_URL).
// Se usa con: npm run db:test:deploy
import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables que ya tenga el entorno.
}

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Falta TEST_DATABASE_URL en backend/.env");
  process.exit(1);
}

const databaseName = new URL(url).pathname.slice(1);
if (!databaseName.endsWith("_test")) {
  console.error(`La base de pruebas debe terminar en "_test" (es "${databaseName}").`);
  process.exit(1);
}

console.log(`Aplicando migraciones a la base de pruebas "${databaseName}"...`);

// Prisma lee DATABASE_URL: se la reemplazamos por la de pruebas solo para este comando.
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});

process.exit(result.status ?? 1);
