import type { Request, Response } from "express";
import type { StockMovementService } from "../services/stock-movement.service.js";
import { movementListQuerySchema, stockMovementInputSchema } from "../validators/stock-movement.validator.js";

// Controlador de movimientos de stock: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createStockMovementController(service: StockMovementService) {
  return {
    async list(req: Request, res: Response) {
      res.json(await service.list(movementListQuerySchema.parse(req.query)));
    },

    // El usuario que registra el movimiento sale de la sesión, nunca de lo que mande el cliente (auditoría).
    async create(req: Request, res: Response) {
      const input = stockMovementInputSchema.parse(req.body ?? {});
      res.status(201).json(await service.register(req.auth!.user.id, input));
    },
  };
}
