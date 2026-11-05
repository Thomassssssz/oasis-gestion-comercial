import type { AdjustmentReason, MovementType, RegistrableMovementType } from '@/types/stock-movement.types'

// Textos para mostrar en pantalla de los tipos y motivos que usa la API.
export const movementTypeLabels: Record<MovementType, string> = {
  INITIAL_STOCK: 'Stock inicial',
  ADJUSTMENT: 'Ajuste',
  SALE: 'Venta',
  SALE_ANNULMENT: 'Anulación de venta',
}

// Tipos que se pueden elegir en el formulario de Inventario, en el orden en que se muestran.
export const registrableTypes: RegistrableMovementType[] = ['INITIAL_STOCK', 'ADJUSTMENT']

// Es una lista fija (D7); el orden es el que se muestra en el desplegable.
export const adjustmentReasonLabels: Record<AdjustmentReason, string> = {
  PHYSICAL_COUNT: 'Conteo físico',
  DAMAGE_OR_LOSS: 'Rotura o pérdida',
  SUPPLIER_RETURN: 'Devolución a proveedor',
  OTHER: 'Otro',
}
