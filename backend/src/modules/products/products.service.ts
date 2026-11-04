import { badRequest, notFound } from "../../lib/errors.js";
import { hasPrismaCode } from "../../lib/prisma-errors.js";
import type { ProductRecord, ProductsRepository } from "./products.repository.js";
import type { ListQuery, ProductInput, ProductUpdate } from "./products.schemas.js";

const NOT_FOUND = "El producto no existe";
const CATEGORY_NOT_FOUND = "La categoría indicada no existe";

// Forma en que la API devuelve un producto. El precio va como texto con 2 decimales ("1234.50").
function toDto(product: ProductRecord) {
  return { ...product, salePrice: product.salePrice.toFixed(2) };
}

// Reglas de negocio de los productos. Un producto no se borra: se da de baja (active = false).
export function createProductsService(repository: ProductsRepository) {
  return {
    async list(query: ListQuery) {
      return (await repository.findAll(query)).map(toDto);
    },

    async get(id: number) {
      const product = await repository.findById(id);
      if (!product) throw notFound(NOT_FOUND);
      return toDto(product);
    },

    async create(data: ProductInput) {
      try {
        return toDto(await repository.create(data));
      } catch (error) {
        if (hasPrismaCode(error, "P2003")) throw badRequest(CATEGORY_NOT_FOUND);
        throw error;
      }
    },

    async update(id: number, data: ProductUpdate) {
      try {
        return toDto(await repository.update(id, data));
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound(NOT_FOUND);
        if (hasPrismaCode(error, "P2003")) throw badRequest(CATEGORY_NOT_FOUND);
        throw error;
      }
    },
  };
}
