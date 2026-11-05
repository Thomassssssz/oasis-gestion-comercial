import type { Request, Response } from "express";
import type { SupplierService } from "../services/supplier.service.js";
import { idParamSchema } from "../validators/common.validator.js";
import { supplierInputSchema, supplierListQuerySchema, supplierUpdateSchema } from "../validators/supplier.validator.js";

// Controlador de proveedores: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createSupplierController(service: SupplierService) {
  return {
    async list(req: Request, res: Response) {
      res.json(await service.list(supplierListQuerySchema.parse(req.query)));
    },

    async get(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.get(id));
    },

    async create(req: Request, res: Response) {
      res.status(201).json(await service.create(supplierInputSchema.parse(req.body ?? {})));
    },

    async update(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.update(id, supplierUpdateSchema.parse(req.body ?? {})));
    },
  };
}
