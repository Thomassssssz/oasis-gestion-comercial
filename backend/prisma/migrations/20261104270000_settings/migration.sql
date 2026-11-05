-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lateFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en schema.prisma (D16): hay una sola fila y el porcentaje va de 0 a 100.
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_single_row" CHECK ("id" = 1);
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_late_fee_range" CHECK ("lateFeePercent" >= 0 AND "lateFeePercent" <= 100);
