import { conflict, notFound } from "../helpers/errors.js";
import type { StockMovementRecord, StockMovementRepository } from "../repositories/stock-movement.repository.js";
import type { MovementListQuery, StockMovementInput } from "../validators/stock-movement.validator.js";

const PRODUCT_NOT_FOUND = "El producto no existe";

// Forma en que la API devuelve un movimiento.
function toDto(movement: StockMovementRecord) {
  return {
    id: movement.id,
    productId: movement.productId,
    productName: movement.product.name,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    note: movement.note,
    userId: movement.userId,
    saleId: movement.saleId,
    userName: movement.user.fullName,
    createdAt: movement.createdAt,
  };
}

// Reglas de negocio de los movimientos de stock (D1, D6, D7 y D12).
// Los movimientos no se editan ni se borran: un error se corrige con otro movimiento.
export function createStockMovementService(repository: StockMovementRepository) {
  return {
    async list(query: MovementListQuery) {
      return (await repository.findAll(query)).map(toDto);
    },

    // Registra un movimiento a nombre de `userId` y devuelve el movimiento con el stock que quedó.
    async register(userId: number, input: StockMovementInput) {
      const result = await repository.withLockedProduct(input.productId, async (ops) => {
        const { stock, movements } = await ops.currentStock();

        if (input.type === "INITIAL_STOCK" && movements > 0) {
          throw conflict("El producto ya tiene movimientos: para corregir su stock usá un ajuste");
        }
        if (stock + input.quantity < 0) {
          throw conflict(`El ajuste dejaría el stock en negativo (stock actual: ${stock})`);
        }

        const { id } = await ops.create(userId, input);
        return { id, stock: stock + input.quantity };
      });

      if (!result) throw notFound(PRODUCT_NOT_FOUND);

      const movement = await repository.findById(result.id);
      return { ...toDto(movement!), stock: result.stock };
    },
  };
}

export type StockMovementService = ReturnType<typeof createStockMovementService>;
