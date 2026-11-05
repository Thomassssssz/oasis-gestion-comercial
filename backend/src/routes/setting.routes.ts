import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createSettingController } from "../controllers/setting.controller.js";
import { createSettingRepository } from "../repositories/setting.repository.js";
import { createSettingService } from "../services/setting.service.js";

// Rutas de parámetros del sistema. Solo se consultan y se modifican: no se crean ni se borran.
export function createSettingRouter(prisma: PrismaClient) {
  const controller = createSettingController(createSettingService(createSettingRepository(prisma)));
  const router = Router();

  router.get("/", controller.get);
  router.put("/", controller.update);
  router.get("/business", controller.getBusiness);
  router.put("/business", controller.updateBusiness);

  return router;
}
