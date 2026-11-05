-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INITIAL_STOCK', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('PHYSICAL_COUNT', 'DAMAGE_OR_LOSS', 'SUPPLIER_RETURN', 'OTHER');

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "AdjustmentReason",
    "note" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en schema.prisma: la base las hace cumplir aunque falle el código (D12).
-- Un movimiento nunca es de cantidad cero.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_not_zero" CHECK ("quantity" <> 0);

-- Solo los ajustes llevan motivo, y todos los ajustes lo llevan.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reason_matches_type" CHECK (("type" = 'ADJUSTMENT') = ("reason" IS NOT NULL));

-- El stock inicial siempre es una entrada.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_initial_is_positive" CHECK ("type" <> 'INITIAL_STOCK' OR "quantity" > 0);

-- El motivo "otro" exige una nota con contenido.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_other_needs_note" CHECK ("reason" IS DISTINCT FROM 'OTHER' OR length(btrim(coalesce("note", ''))) > 0);
