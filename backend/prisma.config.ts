import { defineConfig, env } from 'prisma/config'

// Prisma 7 no lee el archivo .env solo: lo cargamos acá (si existe).
try {
  process.loadEnvFile()
} catch {
  // Sin .env: se usan las variables que ya tenga el entorno.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
