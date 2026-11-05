import type { Request, Response } from "express";
import type { ReportService } from "../services/report.service.js";
import { salesReportQuerySchema } from "../validators/report.validator.js";

// Controlador de reportes: valida el rango, llama al servicio y devuelve el resultado.
export function createReportController(service: ReportService) {
  return {
    async sales(req: Request, res: Response) {
      res.json(await service.sales(salesReportQuerySchema.parse(req.query)));
    },

    async debt(_req: Request, res: Response) {
      res.json(await service.debt());
    },
  };
}
