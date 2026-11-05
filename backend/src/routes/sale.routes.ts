import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createSaleController } from "../controllers/sale.controller.js";
import { createSaleRepository } from "../repositories/sale.repository.js";
import { createSaleService } from "../services/sale.service.js";

// Rutas de ventas. No hay PUT ni DELETE: una venta no se edita ni se borra, se anula (D3).
export function createSaleRouter(prisma: PrismaClient) {
  const controller = createSaleController(createSaleService(createSaleRepository(prisma)));
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.post("/:id/annul", controller.annul);

  return router;
}
