import express from "express";
import { errorHandler } from "./middlewares/error.middleware.js";
import type { PrismaClient } from "./config/prisma.js";
import { createCategoryRouter } from "./routes/category.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { createProductRouter } from "./routes/product.routes.js";

type AppDeps = { prisma: PrismaClient };

// Crea la aplicación Express. Está separada de server.ts para poder
// probarla con Supertest sin abrir un puerto real.
export function createApp({ prisma }: AppDeps) {
  const app = express();

  // No revelar con qué tecnología está hecho el servidor.
  app.disable("x-powered-by");

  app.use(express.json());

  app.use("/api/health", healthRouter);
  app.use("/api/categories", createCategoryRouter(prisma));
  app.use("/api/products", createProductRouter(prisma));

  // Cualquier ruta que no exista responde 404 en formato JSON.
  app.use((_req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
  });

  // Va al final: atrapa los errores de todas las rutas de arriba.
  app.use(errorHandler);

  return app;
}
