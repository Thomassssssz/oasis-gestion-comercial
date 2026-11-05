import type { Request, Response } from "express";
import type { CustomerService } from "../services/customer.service.js";
import { idParamSchema } from "../validators/common.validator.js";
import { customerInputSchema, customerListQuerySchema, customerUpdateSchema } from "../validators/customer.validator.js";

// Controlador de clientes: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createCustomerController(service: CustomerService) {
  return {
    async list(req: Request, res: Response) {
      res.json(await service.list(customerListQuerySchema.parse(req.query)));
    },

    async get(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.get(id));
    },

    async create(req: Request, res: Response) {
      res.status(201).json(await service.create(customerInputSchema.parse(req.body ?? {})));
    },

    async update(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.update(id, customerUpdateSchema.parse(req.body ?? {})));
    },
  };
}
