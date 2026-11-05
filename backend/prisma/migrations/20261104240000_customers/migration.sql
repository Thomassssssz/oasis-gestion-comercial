-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "dni" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "creditAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_dni_key" ON "Customer"("dni");

-- Regla que Prisma no expresa en schema.prisma: el nombre nunca queda vacío, aunque falle el código (D14).
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_name_not_blank" CHECK (length(btrim("name")) > 0);
