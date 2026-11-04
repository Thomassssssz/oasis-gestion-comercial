import { Router } from "express";

export const healthRouter = Router();

// GET /api/health -> sirve para saber si el servidor está vivo.
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});
