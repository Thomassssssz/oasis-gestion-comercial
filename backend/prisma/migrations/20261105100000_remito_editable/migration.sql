-- CreateEnum: condición frente al IVA (D23)
CREATE TYPE "TaxCondition" AS ENUM ('CONSUMER', 'EXEMPT', 'REGISTERED', 'MONOTAX');

-- AlterTable: datos del cliente que se completan en el remito (todos opcionales)
ALTER TABLE "Customer" ADD COLUMN "locality" TEXT,
ADD COLUMN "taxCondition" "TaxCondition",
ADD COLUMN "cuit" TEXT;

-- AlterTable: números que se escriben a mano en el remito de papel (todos opcionales)
ALTER TABLE "CreditAccount" ADD COLUMN "number" TEXT,
ADD COLUMN "remitoNumber" TEXT;

-- AlterTable: datos del comercio para el encabezado del remito (arrancan vacíos, no se inventa ningún dato)
ALTER TABLE "Setting" ADD COLUMN "businessName" TEXT,
ADD COLUMN "businessOwner" TEXT,
ADD COLUMN "businessAddress" TEXT,
ADD COLUMN "businessTaxCondition" "TaxCondition",
ADD COLUMN "businessCuit" TEXT,
ADD COLUMN "businessGrossIncome" TEXT,
ADD COLUMN "businessActivityStart" TEXT;

-- Reglas que Prisma no expresa en schema.prisma (D23):
-- el CUIT son 11 dígitos; los textos opcionales no pueden ser solo espacios.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_cuit_format" CHECK ("cuit" IS NULL OR "cuit" ~ '^[0-9]{11}$');
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_locality_not_blank" CHECK ("locality" IS NULL OR length(btrim("locality")) > 0);
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_number_not_blank" CHECK ("number" IS NULL OR length(btrim("number")) > 0);
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_remito_number_not_blank" CHECK ("remitoNumber" IS NULL OR length(btrim("remitoNumber")) > 0);
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_business_cuit_format" CHECK ("businessCuit" IS NULL OR "businessCuit" ~ '^[0-9]{11}$');
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_business_name_not_blank" CHECK ("businessName" IS NULL OR length(btrim("businessName")) > 0);
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_business_owner_not_blank" CHECK ("businessOwner" IS NULL OR length(btrim("businessOwner")) > 0);
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_business_address_not_blank" CHECK ("businessAddress" IS NULL OR length(btrim("businessAddress")) > 0);
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_business_gross_income_not_blank" CHECK ("businessGrossIncome" IS NULL OR length(btrim("businessGrossIncome")) > 0);
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_business_activity_start_not_blank" CHECK ("businessActivityStart" IS NULL OR length(btrim("businessActivityStart")) > 0);
