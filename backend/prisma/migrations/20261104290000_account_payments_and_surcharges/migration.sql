-- CreateTable: pagos a la cuenta corriente (D18). Cada pago es un renglón propio: nunca se edita ni se borra.
CREATE TABLE "AccountPayment" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recargos por mora registrados (D18). Guardan el porcentaje y la base con que se calcularon,
-- para que cambiar el parámetro más adelante no reescriba el pasado.
CREATE TABLE "Surcharge" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "base" DECIMAL(12,2) NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "chargedOn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Surcharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountPayment_accountId_idx" ON "AccountPayment"("accountId");
CREATE INDEX "Surcharge_accountId_idx" ON "Surcharge"("accountId");
CREATE UNIQUE INDEX "Surcharge_accountId_monthNumber_key" ON "Surcharge"("accountId", "monthNumber");

-- AddForeignKey
ALTER TABLE "AccountPayment" ADD CONSTRAINT "AccountPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountPayment" ADD CONSTRAINT "AccountPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en schema.prisma (D18):
-- un pago es siempre mayor que cero y su nota no es solo espacios;
-- un recargo es de un mes de atraso (1 en adelante) con base, porcentaje (hasta 100) y monto mayores que cero.
-- La unicidad (accountId, monthNumber) impide cobrar dos veces el mismo mes de una ficha.
ALTER TABLE "AccountPayment" ADD CONSTRAINT "AccountPayment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "AccountPayment" ADD CONSTRAINT "AccountPayment_note_not_blank" CHECK ("note" IS NULL OR length(btrim("note")) > 0);
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_month_positive" CHECK ("monthNumber" >= 1);
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_base_positive" CHECK ("base" > 0);
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_percent_range" CHECK ("percent" > 0 AND "percent" <= 100);
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_amount_positive" CHECK ("amount" > 0);
