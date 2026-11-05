import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createReportController } from "../controllers/report.controller.js";
import { createCreditAccountRepository } from "../repositories/credit-account.repository.js";
import { createReportRepository } from "../repositories/report.repository.js";
import { createCreditAccountService } from "../services/credit-account.service.js";
import { createReportService } from "../services/report.service.js";

// Rutas de reportes: solo GET. El stock bajo sale de /api/products?lowStock=true (D5).
export function createReportRouter(prisma: PrismaClient, now?: () => Date) {
  const accounts = createCreditAccountService(createCreditAccountRepository(prisma), now);
  const controller = createReportController(createReportService(createReportRepository(prisma), accounts, now));
  const router = Router();

  router.get("/sales", controller.sales);
  router.get("/debt", controller.debt);

  return router;
}
