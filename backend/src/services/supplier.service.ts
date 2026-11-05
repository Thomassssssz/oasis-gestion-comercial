import { conflict, notFound } from "../helpers/errors.js";
import { hasPrismaCode } from "../helpers/prisma-errors.js";
import type { SupplierRepository } from "../repositories/supplier.repository.js";
import type { SupplierInput, SupplierListQuery, SupplierUpdate } from "../validators/supplier.validator.js";

const NOT_FOUND = "El proveedor no existe";
const DUPLICATED_NAME = "Ya existe un proveedor con ese nombre";

// Reglas de negocio de los proveedores. Un proveedor no se borra: se da de baja (active = false) (D15-e).
export function createSupplierService(repository: SupplierRepository) {
  return {
    list: (query: SupplierListQuery) => repository.findAll(query),

    async get(id: number) {
      const supplier = await repository.findById(id);
      if (!supplier) throw notFound(NOT_FOUND);
      return supplier;
    },

    async create(data: SupplierInput) {
      try {
        return await repository.create(data);
      } catch (error) {
        if (hasPrismaCode(error, "P2002")) throw conflict(DUPLICATED_NAME);
        throw error;
      }
    },

    async update(id: number, data: SupplierUpdate) {
      try {
        return await repository.update(id, data);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound(NOT_FOUND);
        if (hasPrismaCode(error, "P2002")) throw conflict(DUPLICATED_NAME);
        throw error;
      }
    },
  };
}

export type SupplierService = ReturnType<typeof createSupplierService>;
