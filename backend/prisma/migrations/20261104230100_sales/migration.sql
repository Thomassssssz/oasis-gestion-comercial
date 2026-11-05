-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'DIGITAL_WALLET');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('CONFIRMED', 'ANNULLED');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "saleId" INTEGER;

-- CreateTable
CREATE TABLE "Sale" (
    "id" SERIAL NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annulledAt" TIMESTAMP(3),
    "annulledById" INTEGER,
    "annulmentReason" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_userId_idx" ON "Sale"("userId");

-- CreateIndex
CREATE INDEX "Sale_annulledById_idx" ON "Sale"("annulledById");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_saleId_productId_key" ON "SaleItem"("saleId", "productId");

-- CreateIndex
CREATE INDEX "StockMovement_saleId_idx" ON "StockMovement"("saleId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_annulledById_fkey" FOREIGN KEY ("annulledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en schema.prisma: la base las hace cumplir aunque falle el código (D13).
-- Una venta confirmada no tiene datos de anulación; una anulada los tiene todos (quién, cuándo y por qué).
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_annulment_matches_status" CHECK (
    ("status" = 'CONFIRMED' AND "annulledAt" IS NULL AND "annulledById" IS NULL AND "annulmentReason" IS NULL)
    OR
    ("status" = 'ANNULLED' AND "annulledAt" IS NOT NULL AND "annulledById" IS NOT NULL AND length(btrim(coalesce("annulmentReason", ''))) > 0)
);

-- Cada ítem vende al menos una unidad y a un precio mayor que cero.
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_unitPrice_positive" CHECK ("unitPrice" > 0);

-- Solo los movimientos de venta y de anulación llevan venta; la venta saca stock y la anulación lo devuelve.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sale_matches_type" CHECK (("type" IN ('SALE', 'SALE_ANNULMENT')) = ("saleId" IS NOT NULL));
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sale_is_negative" CHECK ("type" <> 'SALE' OR "quantity" < 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_annulment_is_positive" CHECK ("type" <> 'SALE_ANNULMENT' OR "quantity" > 0);
