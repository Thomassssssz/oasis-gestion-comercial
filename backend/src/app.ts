import express from "express";
import { healthRouter } from "./modules/health/health.routes.js";

// Crea la aplicación Express. Está separada de server.ts para poder
// probarla con Supertest sin abrir un puerto real.
export function createApp() {
  const app = express();

  // No revelar con qué tecnología está hecho el servidor.
  app.disable("x-powered-by");

  app.use("/api/health", healthRouter);

  // Cualquier ruta que no exista responde 404 en formato JSON.
  app.use((_req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
  });

  return app;
}
