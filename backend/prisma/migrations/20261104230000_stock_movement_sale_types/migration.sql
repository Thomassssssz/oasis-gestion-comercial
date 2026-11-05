-- AlterEnum
-- Los valores nuevos se agregan en su propia migración: PostgreSQL no deja usarlos
-- (por ejemplo, en una regla CHECK) dentro de la misma transacción en la que se crean.
ALTER TYPE "StockMovementType" ADD VALUE 'SALE';
ALTER TYPE "StockMovementType" ADD VALUE 'SALE_ANNULMENT';
