import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createStockMovementController } from "../controllers/stock-movement.controller.js";
import { createStockMovementRepository } from "../repositories/stock-movement.repository.js";
import { createStockMovementService } from "../services/stock-movement.service.js";

// Rutas de movimientos de stock. No hay PUT ni DELETE: un movimiento no se edita ni se borra.
export function createStockMovementRouter(prisma: PrismaClient) {
  const controller = createStockMovementController(
    createStockMovementService(createStockMovementRepository(prisma)),
  );
  const router = Router();

  router.get("/", controller.list);
  router.post("/", controller.create);

  return router;
}
