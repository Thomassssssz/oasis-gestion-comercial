import { Router } from "express";
import type { PrismaClient } from "../../config/prisma.js";
import { createProductsRepository } from "./products.repository.js";
import { idParamSchema, listQuerySchema, productInputSchema, productUpdateSchema } from "./products.schemas.js";
import { createProductsService } from "./products.service.js";

// Rutas HTTP de productos: validan la entrada, llaman al servicio y arman la respuesta.
export function createProductsRouter(prisma: PrismaClient) {
  const service = createProductsService(createProductsRepository(prisma));
  const router = Router();

  router.get("/", async (req, res) => {
    res.json(await service.list(listQuerySchema.parse(req.query)));
  });

  router.get("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.get(id));
  });

  router.post("/", async (req, res) => {
    res.status(201).json(await service.create(productInputSchema.parse(req.body ?? {})));
  });

  router.put("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.update(id, productUpdateSchema.parse(req.body ?? {})));
  });

  return router;
}
