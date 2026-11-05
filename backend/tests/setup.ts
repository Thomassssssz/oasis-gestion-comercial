// Carga backend/.env (si existe) para que las pruebas encuentren TEST_DATABASE_URL.
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables que ya tenga el entorno.
}
