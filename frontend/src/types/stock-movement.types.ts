// Tipos que muestra el historial. Venta y anulación de venta los crea el módulo de ventas.
export type MovementType = 'INITIAL_STOCK' | 'ADJUSTMENT' | 'SALE' | 'SALE_ANNULMENT'

// Los únicos tipos que se pueden registrar a mano desde Inventario.
export type RegistrableMovementType = 'INITIAL_STOCK' | 'ADJUSTMENT'

export type AdjustmentReason = 'PHYSICAL_COUNT' | 'DAMAGE_OR_LOSS' | 'SUPPLIER_RETURN' | 'OTHER'

// Movimiento de stock tal como lo devuelve la API.
export type StockMovement = {
  id: number
  productId: number
  productName: string
  type: MovementType
  quantity: number // positivo = entró mercadería, negativo = salió
  reason: AdjustmentReason | null
  note: string | null
  saleId: number | null // la venta que lo originó (solo venta y anulación de venta)
  userId: number
  userName: string
  createdAt: string
}

// Lo que se envía para registrar un movimiento. El stock inicial no lleva motivo.
export type MovementInput =
  | { type: 'INITIAL_STOCK'; productId: number; quantity: number; note?: string }
  | { type: 'ADJUSTMENT'; productId: number; quantity: number; reason: AdjustmentReason; note?: string }

// La API responde el movimiento registrado más el stock que quedó.
export type RegisteredMovement = StockMovement & { stock: number }
