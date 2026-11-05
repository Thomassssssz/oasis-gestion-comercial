import type { PrismaClient } from "../config/prisma.js";
import type { SettingInput } from "../validators/setting.validator.js";

const SETTINGS_ID = 1;
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
  };
}

export type SettingRepository = ReturnType<typeof createSettingRepository>;
