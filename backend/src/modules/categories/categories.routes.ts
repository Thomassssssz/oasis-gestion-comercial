import { Router } from "express";
import type { PrismaClient } from "../../lib/prisma.js";
import { categoryInputSchema, idParamSchema } from "./categories.schemas.js";
import { createCategoriesRepository } from "./categories.repository.js";
import { createCategoriesService } from "./categories.service.js";

// Rutas HTTP de categorías: validan la entrada, llaman al servicio y arman la respuesta.
export function createCategoriesRouter(prisma: PrismaClient) {
  const service = createCategoriesService(createCategoriesRepository(prisma));
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await service.list());
  });

  router.get("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.get(id));
  });

  router.post("/", async (req, res) => {
    const { name } = categoryInputSchema.parse(req.body ?? {});
    res.status(201).json(await service.create(name));
  });

  router.put("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { name } = categoryInputSchema.parse(req.body ?? {});
    res.json(await service.update(id, name));
  });

  router.delete("/:id", async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await service.remove(id);
    res.status(204).send();
  });

  return router;
}
