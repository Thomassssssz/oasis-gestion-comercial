import type { Request, Response } from "express";
import type { SaleService } from "../services/sale.service.js";
import { idParamSchema } from "../validators/common.validator.js";
import { annulInputSchema, saleInputSchema, saleListQuerySchema } from "../validators/sale.validator.js";

// Controlador de ventas: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createSaleController(service: SaleService) {
  return {
    async list(req: Request, res: Response) {
      res.json(await service.list(saleListQuerySchema.parse(req.query)));
    },

    async get(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.get(id));
    },

    // El usuario sale de la sesión, nunca de lo que mande el cliente (auditoría).
    async create(req: Request, res: Response) {
      const input = saleInputSchema.parse(req.body ?? {});
      res.status(201).json(await service.register(req.auth!.user.id, input));
    },

    async annul(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      const input = annulInputSchema.parse(req.body ?? {});
      res.json(await service.annul(id, req.auth!.user.id, input));
    },
  };
}
