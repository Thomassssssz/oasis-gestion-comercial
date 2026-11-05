import type { Request, Response } from "express";
import type { ProductService } from "../services/product.service.js";
import { idParamSchema } from "../validators/common.validator.js";
import { listQuerySchema, productInputSchema, productUpdateSchema } from "../validators/product.validator.js";

// Controlador de productos: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createProductController(service: ProductService) {
  return {
    async list(req: Request, res: Response) {
      res.json(await service.list(listQuerySchema.parse(req.query)));
    },

    async get(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.get(id));
    },

    async create(req: Request, res: Response) {
      res.status(201).json(await service.create(productInputSchema.parse(req.body ?? {})));
    },

    async update(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.update(id, productUpdateSchema.parse(req.body ?? {})));
    },
  };
}
