-- Los proveedores y las compras no van en el sistema (D15): se elimina la tabla creada en 20261104250000_suppliers.
-- La tabla no tenía relaciones con otras tablas, así que no se pierde ningún dato relacionado.
DROP TABLE "Supplier";
