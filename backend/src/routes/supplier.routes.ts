import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createSupplierController } from "../controllers/supplier.controller.js";
import { createSupplierRepository } from "../repositories/supplier.repository.js";
import { createSupplierService } from "../services/supplier.service.js";

// Rutas de proveedores. No hay DELETE: un proveedor se da de baja con active = false (D15-e).
export function createSupplierRouter(prisma: PrismaClient) {
  const controller = createSupplierController(createSupplierService(createSupplierRepository(prisma)));
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.put("/:id", controller.update);

  return router;
}
