-- CreateEnum
CREATE TYPE "CreditAccountStatus" AS ENUM ('OPEN', 'CANCELLED');

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" "CreditAccountStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditAccount_customerId_idx" ON "CreditAccount"("customerId");
CREATE INDEX "CreditAccount_status_dueDate_idx" ON "CreditAccount"("status", "dueDate");

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en schema.prisma (D17):
-- el vencimiento es posterior a la apertura; una ficha abierta no tiene fecha de cierre y una cancelada sí;
-- y cada cliente tiene como máximo UNA ficha abierta a la vez (su ciclo propio).
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_due_after_open" CHECK ("dueDate" > "openedAt");
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_closed_consistency" CHECK (
    ("status" = 'OPEN' AND "closedAt" IS NULL) OR ("status" = 'CANCELLED' AND "closedAt" IS NOT NULL)
);
CREATE UNIQUE INDEX "CreditAccount_one_open_per_customer" ON "CreditAccount"("customerId") WHERE "status" = 'OPEN';

-- AlterTable: la venta completa suma cliente, descuento, nota y venta a crédito.
ALTER TABLE "Sale" ALTER COLUMN "paymentMethod" DROP NOT NULL;
ALTER TABLE "Sale" ADD COLUMN "customerId" INTEGER,
ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "note" TEXT,
ADD COLUMN "onCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "creditAccountId" INTEGER;

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "Sale_creditAccountId_idx" ON "Sale"("creditAccountId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas de la venta que hace cumplir la base (D17): el descuento no es negativo, la nota no es solo espacios,
-- una venta a crédito tiene cliente y ficha y no tiene medio de pago, y una venta al contado tiene medio de pago y no ficha.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_discount_not_negative" CHECK ("discountAmount" >= 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_note_not_blank" CHECK ("note" IS NULL OR length(btrim("note")) > 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_credit_consistency" CHECK (
    ("onCredit" AND "customerId" IS NOT NULL AND "creditAccountId" IS NOT NULL AND "paymentMethod" IS NULL)
    OR (NOT "onCredit" AND "creditAccountId" IS NULL AND "paymentMethod" IS NOT NULL)
);
