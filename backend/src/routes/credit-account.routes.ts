import { Router } from "express";
import type { PrismaClient } from "../config/prisma.js";
import { createCreditAccountController } from "../controllers/credit-account.controller.js";
import { createCreditAccountRepository } from "../repositories/credit-account.repository.js";
import { createCreditAccountService } from "../services/credit-account.service.js";

// Rutas de cuentas corrientes. Las fichas no se crean ni se borran a mano: se abren al vender a crédito (D17).
// Pagos y recargos se agregan como movimientos nuevos; nunca se editan ni se borran (D18).
// Lo único que se edita a mano son los números del remito (D23).
export function createCreditAccountRouter(prisma: PrismaClient, now?: () => Date) {
  const controller = createCreditAccountController(createCreditAccountService(createCreditAccountRepository(prisma), now));
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.put("/:id/remito", controller.updateRemito);
  router.post("/:id/payments", controller.pay);
  router.post("/:id/surcharges", controller.applySurcharges);

  return router;
}
