import type { PrismaClient } from "../config/prisma.js";

// Acceso a datos de los reportes: solo lectura. Trae las ventas confirmadas del período con sus ítems;
// las cuentas se leen con el servicio de cuentas corrientes, que ya sabe calcular saldos.
export function createReportRepository(prisma: PrismaClient) {
  return {
    findConfirmedSales: (from: Date, toExclusive: Date) =>
      prisma.sale.findMany({
        where: { status: "CONFIRMED", createdAt: { gte: from, lt: toExclusive } },
        select: {
          createdAt: true,
          paymentMethod: true,
          onCredit: true,
          discountAmount: true,
          items: { select: { productId: true, quantity: true, unitPrice: true, product: { select: { name: true } } } },
        },
      }),
  };
}

export type ReportRepository = ReturnType<typeof createReportRepository>;
