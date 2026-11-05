import type { SettingRepository } from "../repositories/setting.repository.js";
import type { BusinessSettingInput, SettingInput } from "../validators/setting.validator.js";

type SettingRow = Awaited<ReturnType<SettingRepository["get"]>>;

// El porcentaje sale como texto con 2 decimales ("5.00"), igual que los importes.
function toResponse(row: SettingRow) {
  return {
    lateFeePercent: row.lateFeePercent.toFixed(2),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

// Los datos del comercio salen con los mismos nombres que usa la pantalla del remito.
function toBusinessResponse(row: SettingRow) {
  return {
    name: row.businessName,
    owner: row.businessOwner,
    address: row.businessAddress,
    taxCondition: row.businessTaxCondition,
    cuit: row.businessCuit,
    grossIncome: row.businessGrossIncome,
    activityStart: row.businessActivityStart,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

// Reglas de los parámetros del sistema (D16).
export function createSettingService(repository: SettingRepository) {
  return {
    async get() {
      return toResponse(await repository.get());
    },

    // Cambiar el porcentaje no modifica recargos ya registrados: cada uno guarda el porcentaje con el que se calculó (D16).
    async update(userId: number, input: SettingInput) {
      return toResponse(await repository.update(input, userId));
    },

    async getBusiness() {
      return toBusinessResponse(await repository.get());
    },

    async updateBusiness(userId: number, input: BusinessSettingInput) {
      return toBusinessResponse(await repository.updateBusiness(input, userId));
    },
  };
}

export type SettingService = ReturnType<typeof createSettingService>;
