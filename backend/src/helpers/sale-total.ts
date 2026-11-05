import { Prisma } from "../config/prisma.js";

type PricedItem = { quantity: number; unitPrice: Prisma.Decimal };

// Subtotal: suma de cantidad × precio de cada ítem.
export const subtotalOf = (items: PricedItem[]) =>
  items.reduce((sum, item) => sum.add(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0));

// Total de la venta = subtotal - descuento. No se guarda: se calcula siempre (D13-c, D17).
export const totalOf = (items: PricedItem[], discount: Prisma.Decimal) => subtotalOf(items).sub(discount);
