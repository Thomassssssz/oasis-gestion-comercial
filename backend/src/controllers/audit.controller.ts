import type { Request, Response } from "express";
import type { AuditService } from "../services/audit.service.js";
import { auditListQuerySchema } from "../validators/audit.validator.js";

// Controlador de auditoría: solo consulta.
export function createAuditController(service: AuditService) {
  return {
    async list(req: Request, res: Response) {
      res.json(await service.list(auditListQuerySchema.parse(req.query)));
    },
  };
}
