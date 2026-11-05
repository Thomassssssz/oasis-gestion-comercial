import { badRequest, notFound } from "../helpers/errors.js";
import { hasPrismaCode } from "../helpers/prisma-errors.js";
import type { ProductRecord, ProductRepository } from "../repositories/product.repository.js";
import type { ListQuery, ProductInput, ProductUpdate } from "../validators/product.validator.js";

const NOT_FOUND = "El producto no existe";
const CATEGORY_NOT_FOUND = "La categoría indicada no existe";

// Forma en que la API devuelve un producto. El precio va como texto con 2 decimales ("1234.50").
// Además trae su stock y si está en alerta: stock igual o menor al mínimo (D5).
function toDto(product: ProductRecord, stock: number) {
  return { ...product, salePrice: product.salePrice.toFixed(2), stock, lowStock: stock <= product.minStock };
}

// Reglas de negocio de los productos. Un producto no se borra: se da de baja (active = false).
export function createProductService(repository: ProductRepository) {
  return {
    async list({ lowStock, ...filters }: ListQuery) {
      const products = await repository.findAll(filters);
      const stocks = await repository.stockByProduct(products.map((product) => product.id));

      return products
        .map((product) => toDto(product, stocks.get(product.id) ?? 0))
        .filter((product) => lowStock === undefined || product.lowStock === lowStock);
    },

    async get(id: number) {
      const product = await repository.findById(id);
      if (!product) throw notFound(NOT_FOUND);
      return toDto(product, (await repository.stockByProduct([id])).get(id) ?? 0);
    },

    async create(data: ProductInput) {
      try {
        // Un producto recién creado no tiene movimientos: su stock es 0.
        return toDto(await repository.create(data), 0);
      } catch (error) {
        if (hasPrismaCode(error, "P2003")) throw badRequest(CATEGORY_NOT_FOUND);
        throw error;
      }
    },

    async update(id: number, data: ProductUpdate) {
      try {
        const product = await repository.update(id, data);
        return toDto(product, (await repository.stockByProduct([id])).get(id) ?? 0);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound(NOT_FOUND);
        if (hasPrismaCode(error, "P2003")) throw badRequest(CATEGORY_NOT_FOUND);
        throw error;
      }
    },
  };
}

export type ProductService = ReturnType<typeof createProductService>;
