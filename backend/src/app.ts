import express from "express";
import type { PrismaClient } from "./config/prisma.js";
import { createLoginLimiter, type LoginLimiter } from "./helpers/login-limiter.js";
import { createRequireAuth } from "./middlewares/auth.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { createAuthRepository } from "./repositories/auth.repository.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createCategoryRouter } from "./routes/category.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { createProductRouter } from "./routes/product.routes.js";
import { createAuthService } from "./services/auth.service.js";

// loginLimiter y now son opcionales: las pruebas los reemplazan para controlar el tiempo.
type AppDeps = { prisma: PrismaClient; loginLimiter?: LoginLimiter; now?: () => Date };

// Crea la aplicación Express. Está separada de server.ts para poder
// probarla con Supertest sin abrir un puerto real.
export function createApp({ prisma, loginLimiter = createLoginLimiter(), now }: AppDeps) {
  const app = express();

  // No revelar con qué tecnología está hecho el servidor.
  app.disable("x-powered-by");

  app.use(express.json());

  const authService = createAuthService(createAuthRepository(prisma), loginLimiter, now);
  const requireAuth = createRequireAuth(authService);

  // Pública: sirve para saber si el servidor está vivo.
  app.use("/api/health", healthRouter);
  // Login y compañía: cada ruta decide si exige sesión.
  app.use("/api/auth", createAuthRouter(authService, requireAuth));
  // Privadas: sin sesión válida responden 401.
  app.use("/api/categories", requireAuth, createCategoryRouter(prisma));
  app.use("/api/products", requireAuth, createProductRouter(prisma));

  // Cualquier ruta que no exista responde 404 en formato JSON.
  app.use((_req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
  });

  // Va al final: atrapa los errores de todas las rutas de arriba.
  app.use(errorHandler);

  return app;
}
