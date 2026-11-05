-- Encabezado del remito: se carga el que traía el remito en papel del comercio, para que la app no arranque en blanco (D23-g).
-- Nombre, titular, domicilio, condición e inicio de actividades son los de la hoja (información relevada).
-- El CUIT y el número de Ingresos Brutos son DE EJEMPLO (12345678): hay que reemplazarlos tocándolos en el remito.
-- Solo rellena si el encabezado está vacío: nunca pisa datos que alguien ya cargó.
INSERT INTO "Setting" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

UPDATE "Setting"
SET "businessName" = 'Ediciones Oasis',
    "businessOwner" = 'DIEGO FRANCISCO SCAGLIA',
    "businessAddress" = E'Bº LA PLATA - MZ. 50 - LOTE A\n3601 - HERRADURA\nFORMOSA',
    "businessTaxCondition" = 'MONOTAX',
    "businessCuit" = '20123456789',
    "businessGrossIncome" = '01-20-12345678-9',
    "businessActivityStart" = '03/2011'
WHERE "id" = 1
  AND "businessName" IS NULL AND "businessOwner" IS NULL AND "businessAddress" IS NULL AND "businessTaxCondition" IS NULL
  AND "businessCuit" IS NULL AND "businessGrossIncome" IS NULL AND "businessActivityStart" IS NULL;
