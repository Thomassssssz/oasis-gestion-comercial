import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createCustomerController } from "../controllers/customer.controller.js";
import { createCustomerRepository } from "../repositories/customer.repository.js";
import { createCustomerService } from "../services/customer.service.js";

// Rutas de clientes. No hay DELETE: un cliente se da de baja con active = false (D14-c).
export function createCustomerRouter(prisma: PrismaClient) {
  const controller = createCustomerController(createCustomerService(createCustomerRepository(prisma)));
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.put("/:id", controller.update);

  return router;
}
