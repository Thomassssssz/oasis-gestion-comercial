import { conflict, notFound } from "../helpers/errors.js";
import { hasPrismaCode } from "../helpers/prisma-errors.js";
import type { CustomerRepository } from "../repositories/customer.repository.js";
import type { CustomerInput, CustomerListQuery, CustomerUpdate } from "../validators/customer.validator.js";

const NOT_FOUND = "El cliente no existe";
const DUPLICATED_DNI = "Ya existe un cliente con ese DNI";

// Reglas de negocio de los clientes. Un cliente no se borra: se da de baja (active = false) (D14-c).
export function createCustomerService(repository: CustomerRepository) {
  return {
    list: (query: CustomerListQuery) => repository.findAll(query),

    async get(id: number) {
      const customer = await repository.findById(id);
      if (!customer) throw notFound(NOT_FOUND);
      return customer;
    },

    async create(data: CustomerInput) {
      try {
        return await repository.create(data);
      } catch (error) {
        if (hasPrismaCode(error, "P2002")) throw conflict(DUPLICATED_DNI);
        throw error;
      }
    },

    async update(id: number, data: CustomerUpdate) {
      try {
        return await repository.update(id, data);
      } catch (error) {
        if (hasPrismaCode(error, "P2025")) throw notFound(NOT_FOUND);
        if (hasPrismaCode(error, "P2002")) throw conflict(DUPLICATED_DNI);
        throw error;
      }
    },
  };
}

export type CustomerService = ReturnType<typeof createCustomerService>;
