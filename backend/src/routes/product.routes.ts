import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createProductController } from "../controllers/product.controller.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductService } from "../services/product.service.js";

// Rutas de productos: dicen qué URL existe y a qué controlador va cada una.
// No hay DELETE: un producto se da de baja con active = false.
export function createProductRouter(prisma: PrismaClient) {
  const controller = createProductController(createProductService(createProductRepository(prisma)));
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.put("/:id", controller.update);

  return router;
}
