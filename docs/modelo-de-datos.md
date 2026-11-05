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
| type | `INITIAL_STOCK`, `ADJUSTMENT`, `SALE` o `SALE_ANNULMENT` | stock inicial, ajuste manual, venta y anulación de venta (las compras agregan su tipo en su módulo) |
| quantity | entero con signo | positivo = entra mercadería, negativo = sale. Nunca cero |
| reason | `PHYSICAL_COUNT`, `DAMAGE_OR_LOSS`, `SUPPLIER_RETURN` u `OTHER` | motivo del ajuste (conteo físico, rotura o pérdida, devolución a proveedor, otro). Solo los ajustes lo llevan |
| note | texto, opcional | obligatoria cuando el motivo es `OTHER` |
| userId | entero, clave foránea → User | quién registró el movimiento (auditoría). No se puede borrar un usuario con movimientos |
| saleId | entero, clave foránea → Sale, opcional | la venta que originó el movimiento. Solo `SALE` y `SALE_ANNULMENT` la llevan |
| createdAt | fecha y hora | cuándo se registró |

El **stock de un producto** es la suma de `quantity` de todos sus movimientos (D1). Un producto está en **alerta** cuando su stock es igual o menor a `minStock` (D5). Los movimientos no se editan ni se borran: un error se corrige con otro movimiento (D12).

**Reglas que hace cumplir la propia base de datos** (además del código): cantidad distinta de cero; solo los ajustes llevan motivo y todos lo llevan; el stock inicial siempre es positivo; el motivo `OTHER` exige una nota con contenido; solo los movimientos de venta y de anulación llevan venta; una venta saca stock (cantidad negativa) y su anulación lo devuelve (positiva).

### Por qué está en 3FN

- La clave primaria es un solo campo (`id`), así que se cumple 2FN.
- Todos los campos describen al movimiento y dependen solo de su `id`. El nombre del producto y el nombre del usuario no se repiten acá: se guardan en Product y User y se llega a ellos con `productId` y `userId`.
- El stock **no se guarda** (ni en Product ni en StockMovement): se calcula sumando, así no hay un dato derivado que pueda quedar desactualizado.
- `reason` y `note` pueden estar vacíos según el tipo; eso es una regla de validez del movimiento (la base la controla), no una dependencia entre campos no clave.

### Supuestos a confirmar (no están relevados)

- Que un ajuste no pueda dejar el stock por debajo de cero (propuesta de Claude, ver D12-f).
- Que el listado de motivos de ajuste sea exactamente el de D7.

## Módulo 3 – Ventas rápidas

### Sale (Venta)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| status | `CONFIRMED` o `ANNULLED` | una venta nace confirmada; se puede anular, nunca borrar (D3) |
| paymentMethod | `CASH`, `TRANSFER`, `CARD` o `DIGITAL_WALLET` | efectivo, transferencia, tarjeta o billetera virtual |
| userId | entero, clave foránea → User | quién registró la venta (auditoría) |
| createdAt | fecha y hora | cuándo se registró |
| annulledAt, annulledById, annulmentReason | fecha, clave foránea → User, texto | cuándo, quién y por qué se anuló. Vacíos mientras la venta está confirmada; los tres obligatorios si está anulada |

### SaleItem (Ítem de venta)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| saleId | entero, clave foránea → Sale | a qué venta pertenece |
| productId | entero, clave foránea → Product | qué producto se vendió. Un producto no se repite dentro de la misma venta (clave única `saleId` + `productId`) |
| quantity | entero mayor que cero | unidades vendidas (D6) |
| unitPrice | decimal(12,2) mayor que cero | precio de lista **del día de la venta** (D13-a) |

El **total de la venta no se guarda**: es la suma de `quantity × unitPrice` de sus ítems (D13-c). Confirmar una venta crea un movimiento de stock `SALE` por ítem; anularla crea uno `SALE_ANNULMENT` por ítem (D13).

**Reglas que hace cumplir la propia base de datos:** una venta confirmada no tiene datos de anulación y una anulada los tiene todos (con motivo no vacío); cantidad y precio de cada ítem mayores que cero; no se puede borrar una venta, ni un producto o usuario que tengan ventas.

### Por qué está en 3FN

- Todas las tablas tienen clave de un solo campo (`id`): se cumple 2FN. `SaleItem` también tiene una clave única compuesta (`saleId`, `productId`), pero `quantity` y `unitPrice` dependen de la clave completa (de qué producto en qué venta), no de una parte.
- Los datos del producto (nombre, categoría) y del usuario (nombre) no se repiten en `Sale` ni `SaleItem`: se llega a ellos con `productId` y `userId`.
- `unitPrice` **no** es un dato repetido de `Product.salePrice`: es el precio histórico del día de la venta, que no se puede deducir del precio actual (puede haber cambiado). Por eso se guarda en el ítem.
- No hay datos derivados guardados: el total de la venta y el stock se calculan.
- Los campos de anulación (`annulledAt`, `annulledById`, `annulmentReason`) describen a la venta como un todo y dependen solo de su `id`.

### Supuestos a confirmar (no están relevados)

- Que cualquier usuario pueda anular una venta (hoy no hay roles, D4).
- Que el motivo de anulación sea obligatorio (propuesta de Claude, D13-h).
- Que no haga falta numerar las ventas con un número de comprobante propio (hoy se identifican por su `id`).


## Módulo 4 – Clientes

### Customer (Cliente)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| name | texto, obligatorio | hasta 150 caracteres; no puede quedar vacío ni de solo espacios. Puede repetirse (D14-e) |
| phone | texto, opcional | solo dígitos, espacios, `+`, `-` y paréntesis; de 6 a 30 caracteres (D14-f) |
| dni | texto, opcional, **único** | 7 u 8 dígitos, sin puntos (D14-d). Se guarda como texto para no perder ceros ni tratarlo como número |
| address | texto, opcional | hasta 200 caracteres |
| notes | texto, opcional | observaciones, hasta 500 caracteres |
| creditAuthorized | verdadero o falso | si puede comprar a crédito; por defecto `false` (D14-b) |
| active | verdadero o falso | `false` es un cliente dado de baja; por defecto `true`. Un cliente no se borra (D14-c) |
| createdAt, updatedAt | fecha y hora | cuándo se creó y se modificó por última vez |

**Reglas que hace cumplir la propia base de datos:** el DNI no se repite (la restricción única admite varios clientes sin DNI, porque en PostgreSQL los valores `NULL` no se consideran iguales entre sí) y el nombre no puede estar vacío.

Esta tabla todavía no se relaciona con otras: las ventas con cliente y las cuentas corrientes (módulo 5) la van a referenciar con una clave foránea `customerId`.

### Por qué está en 3FN

- La clave es un solo campo (`id`), así que se cumple 2FN: no hay dependencias de una parte de la clave.
- Todos los datos (nombre, teléfono, DNI, dirección, observaciones, crédito, estado) describen al cliente y dependen solo de su `id`. Ninguno depende de otro dato que no sea la clave: no hay dependencias transitivas.
- `dni` es una clave candidata (identifica al cliente, igual que `id`), por eso tiene restricción única; los demás datos dependen de la clave, no de otros campos no clave.
- No hay grupos repetidos (un solo teléfono y una sola dirección por ficha, D14-a): se cumple 1FN. Si hiciera falta más de un teléfono, habría que pasar a una tabla aparte.
- No se guarda ningún dato derivado (ni deuda ni cantidad de compras): se calculan cuando existan ventas y cuentas corrientes.

### Supuestos a confirmar (no están relevados)

- Que el DNI argentino de 7 u 8 dígitos alcance (deja afuera documentos de extranjeros o CUIT).
- Que alcance con un solo teléfono y una sola dirección por cliente.
- Que no haga falta un límite de deuda por cliente.

## Módulo 8 (parte) – Parámetros del sistema

### Setting (Parámetros)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | siempre vale 1: la base de datos solo admite una fila (D16-a) |
| lateFeePercent | decimal(5,2) entre 0 y 100 | porcentaje de recargo por cada mes de atraso; por defecto 5 |
| updatedAt | fecha y hora | cuándo se modificó por última vez |
| updatedById | entero, clave foránea → User, opcional | quién lo modificó por última vez; vacío mientras nadie lo cambió. No se puede borrar un usuario que figure acá |

**Reglas que hace cumplir la propia base de datos:** una sola fila (`id = 1`) y porcentaje entre 0 y 100.

### Por qué está en 3FN

- La clave es un solo campo (`id`): se cumple 2FN.
- `lateFeePercent`, `updatedAt` y `updatedById` dependen solo de la clave. El nombre de quien lo modificó no se repite: se llega a él con `updatedById`.
- No hay datos derivados guardados.

### Supuestos a confirmar (no están relevados)

- Que cualquier usuario pueda cambiar el porcentaje (hoy no hay roles, D4).
- Que el rango de 0 a 100 sea suficiente.
