# Modelo de datos

Se construye de a un módulo por vez. Este documento crece con cada módulo.
**Es una propuesta de trabajo:** hay que contrastarla con los DFD y el diccionario de datos de Desarrollo de Sistemas II antes de darla por final.

Los nombres de tablas y campos están en inglés (convención del código). Entre paréntesis, el término del negocio.

## Módulo 1 – Productos y categorías

### Category (Categoría)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| name | texto | único: no puede haber dos categorías con el mismo nombre |
| createdAt, updatedAt | fecha y hora | los completa el sistema |

### Product (Producto)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| name | texto | nombre del producto |
| categoryId | entero, clave foránea → Category | obligatoria; no se puede borrar una categoría que tiene productos |
| salePrice | decimal(12,2) | precio de venta. Decimal exacto, nunca float |
| minStock | entero, por defecto 0 | umbral para la alerta de stock mínimo |
| active | verdadero/falso, por defecto verdadero | un producto dado de baja se desactiva, no se borra |
| createdAt, updatedAt | fecha y hora | los completa el sistema |

El **stock no es un campo** de Product: se calcula sumando los movimientos de inventario (decisión D1 en `decisiones.md`).

### Por qué está en 3FN

- **1FN:** todos los campos son simples (un valor por celda) y cada fila se identifica con su `id`.
- **2FN:** la clave primaria es un solo campo (`id`), así que ningún campo puede depender de solo una parte de la clave.
- **3FN:** ningún campo depende de otro campo que no sea la clave. Por ejemplo, el nombre de la categoría **no** se repite en Product: se guarda una sola vez en Category y Product apunta a ella con `categoryId`. Tampoco hay datos derivados guardados (el stock se calcula).

### Supuestos a confirmar (no están relevados)

- Que todo producto pertenezca a exactamente una categoría.
- Que dos productos puedan tener el mismo nombre (hoy no hay restricción).
- Si el comercio usa un código o código de barras por producto (hoy no hay campo).
- Si hace falta guardar el precio de costo (se agregaría con Compras o Reportes, cuando se necesite).

## Módulo 8 (parte) – Usuarios y sesiones

### User (Usuario)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| username | texto | nombre para entrar; único. Se guarda en minúsculas |
| fullName | texto | nombre de la persona, para mostrar |
| passwordHash | texto | hash de la contraseña (nunca la contraseña) |
| active | verdadero/falso, por defecto verdadero | un usuario dado de baja no puede entrar |
| createdAt, updatedAt | fecha y hora | los completa el sistema |

### Session (Sesión)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| tokenHash | texto | hash del código de la cookie; único |
| userId | entero, clave foránea → User | si se borra el usuario, se borran sus sesiones |
| expiresAt | fecha y hora | cuándo vence la sesión |
| createdAt | fecha y hora | cuándo se abrió |

### Por qué está en 3FN

- Cada tabla tiene clave de un solo campo (`id`), así que se cumple 2FN.
- Los datos del usuario (nombre, hash) están solo en User; Session apunta con `userId` y no repite el nombre del usuario (3FN).
- No hay roles ni permisos guardados: todos los usuarios son propietarios (decisión D4).

## Módulo 2 – Inventario y movimientos

### StockMovement (Movimiento de stock)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| productId | entero, clave foránea → Product | no se puede borrar un producto que tiene movimientos |
| type | `INITIAL_STOCK` o `ADJUSTMENT` | stock inicial o ajuste manual (las ventas y compras agregan sus tipos en sus módulos) |
| quantity | entero con signo | positivo = entra mercadería, negativo = sale. Nunca cero |
| reason | `PHYSICAL_COUNT`, `DAMAGE_OR_LOSS`, `SUPPLIER_RETURN` u `OTHER` | motivo del ajuste (conteo físico, rotura o pérdida, devolución a proveedor, otro). Solo los ajustes lo llevan |
| note | texto, opcional | obligatoria cuando el motivo es `OTHER` |
| userId | entero, clave foránea → User | quién registró el movimiento (auditoría). No se puede borrar un usuario con movimientos |
| createdAt | fecha y hora | cuándo se registró |

El **stock de un producto** es la suma de `quantity` de todos sus movimientos (D1). Un producto está en **alerta** cuando su stock es igual o menor a `minStock` (D5). Los movimientos no se editan ni se borran: un error se corrige con otro movimiento (D12).

**Reglas que hace cumplir la propia base de datos** (además del código): cantidad distinta de cero; solo los ajustes llevan motivo y todos lo llevan; el stock inicial siempre es positivo; el motivo `OTHER` exige una nota con contenido.

### Por qué está en 3FN

- La clave primaria es un solo campo (`id`), así que se cumple 2FN.
- Todos los campos describen al movimiento y dependen solo de su `id`. El nombre del producto y el nombre del usuario no se repiten acá: se guardan en Product y User y se llega a ellos con `productId` y `userId`.
- El stock **no se guarda** (ni en Product ni en StockMovement): se calcula sumando, así no hay un dato derivado que pueda quedar desactualizado.
- `reason` y `note` pueden estar vacíos según el tipo; eso es una regla de validez del movimiento (la base la controla), no una dependencia entre campos no clave.

### Supuestos a confirmar (no están relevados)

- Que un ajuste no pueda dejar el stock por debajo de cero (propuesta de Claude, ver D12-f).
- Que el listado de motivos de ajuste sea exactamente el de D7.

