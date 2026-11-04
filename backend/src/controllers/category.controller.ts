import type { Request, Response } from "express";
import type { CategoryService } from "../services/category.service.js";
import { categoryInputSchema } from "../validators/category.validator.js";
import { idParamSchema } from "../validators/common.validator.js";

// Controlador de categorías: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createCategoryController(service: CategoryService) {
  return {
    async list(_req: Request, res: Response) {
      res.json(await service.list());
    },

    async get(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.get(id));
    },

    async create(req: Request, res: Response) {
      const { name } = categoryInputSchema.parse(req.body ?? {});
      res.status(201).json(await service.create(name));
    },

    async update(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      const { name } = categoryInputSchema.parse(req.body ?? {});
      res.json(await service.update(id, name));
    },

    async remove(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      await service.remove(id);
      res.status(204).send();
    },
  };
}
