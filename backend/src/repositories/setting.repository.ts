import type { PrismaClient } from "../config/prisma.js";
import type { BusinessSettingInput, SettingInput } from "../validators/setting.validator.js";

export const SETTINGS_ID = 1;
const include = { updatedBy: { select: { id: true, fullName: true } } };

// Acceso a datos: la tabla de parámetros tiene una sola fila (id = 1), que se crea con sus valores por defecto la primera vez que se pide.
export function createSettingRepository(prisma: PrismaClient) {
  return {
    get: () => prisma.setting.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID }, include }),
    update: (data: SettingInput, userId: number) =>
      prisma.setting.upsert({
        where: { id: SETTINGS_ID },
        update: { ...data, updatedById: userId },
        create: { id: SETTINGS_ID, ...data, updatedById: userId },
        include,
      }),
    // Datos del comercio para el encabezado del remito (D23). El porcentaje de recargo no se toca.
    updateBusiness: (data: BusinessSettingInput, userId: number) => {
      const columns = {
        businessName: data.name,
        businessOwner: data.owner,
        businessAddress: data.address,
        businessTaxCondition: data.taxCondition,
        businessCuit: data.cuit,
        businessGrossIncome: data.grossIncome,
        businessActivityStart: data.activityStart,
        updatedById: userId,
      };
      return prisma.setting.upsert({ where: { id: SETTINGS_ID }, update: columns, create: { id: SETTINGS_ID, ...columns }, include });
    },
  };
}

export type SettingRepository = ReturnType<typeof createSettingRepository>;
