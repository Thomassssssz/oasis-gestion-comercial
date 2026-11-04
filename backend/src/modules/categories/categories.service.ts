import { conflict, notFound } from "../../helpers/errors.js";
import { hasPrismaCode } from "../../helpers/prisma-errors.js";
import type { CategoriesRepository } from "./categories.repository.js";

const DUPLICATE_NAME = "Ya existe una categoría con ese nombre";
const NOT_FOUND = "La categoría no existe";

// Reglas de negocio de las categorías. No sabe nada de HTTP ni de Prisma más allá de sus errores.
export function createCategoriesService(repository: CategoriesRepository) {
  return {
    list: () => repository.findAll(),

    async get(id: number) {
      const category = await repository.findById(id);
      if (!category) throw notFound(NOT_FOUND);
      return category;
    },

    async create(name: string) {
      try {
        return await repository.create(name);
      } catch (error) {
        if (hasPrismaCode(error, "P2002")) throw conflict(DUPLICATE_NAME);
        throw error;
      }
    },

    async update(id: number, name: string) {
      try {
        return await repository.update(id, name);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound(NOT_FOUND);
        if (hasPrismaCode(error, "P2002")) throw conflict(DUPLICATE_NAME);
        throw error;
      }
    },

    async remove(id: number) {
      if (!(await repository.findById(id))) throw notFound(NOT_FOUND);

      // Regla: una categoría con productos no se puede borrar.
      if ((await repository.countProducts(id)) > 0) {
        throw conflict("No se puede borrar una categoría que tiene productos");
      }

      try {
        await repository.remove(id);
      } catch (error) {
        // Por si alguien le agrega un producto justo entre la revisión y el borrado.
        if (hasPrismaCode(error, "P2003")) {
          throw conflict("No se puede borrar una categoría que tiene productos");
        }
        if (hasPrismaCode(error, "P2025")) throw notFound(NOT_FOUND);
        throw error;
      }
    },
  };
}
