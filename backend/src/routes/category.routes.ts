import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createCategoryController } from "../controllers/category.controller.js";
import { createCategoryRepository } from "../repositories/category.repository.js";
import { createCategoryService } from "../services/category.service.js";

// Rutas de categorías: dicen qué URL existe y a qué controlador va cada una.
// Acá también se arma la cadena repositorio -> servicio -> controlador.
export function createCategoryRouter(prisma: PrismaClient) {
  const controller = createCategoryController(createCategoryService(createCategoryRepository(prisma)));
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);

  return router;
}
