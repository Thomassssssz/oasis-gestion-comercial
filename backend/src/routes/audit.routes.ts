import { Router } from "express";
import { createAuditController } from "../controllers/audit.controller.js";
import type { AuditService } from "../services/audit.service.js";

// Rutas de auditoría: solo GET. El registro no se edita ni se borra (D20).
export function createAuditRouter(service: AuditService) {
  const controller = createAuditController(service);
  const router = Router();

  router.get("/", controller.list);

  return router;
}
