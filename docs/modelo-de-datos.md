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

## Módulo 3 – Ventas (rápidas y completas)

### Sale (Venta)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| status | `CONFIRMED` o `ANNULLED` | una venta nace confirmada; se puede anular, nunca borrar (D3) |
| paymentMethod | `CASH`, `TRANSFER`, `CARD` o `DIGITAL_WALLET`, o vacío | efectivo, transferencia, tarjeta o billetera virtual. Vacío solo en las ventas a crédito (se cobra después) |
| customerId | entero, clave foránea → Customer, opcional | cliente de la venta completa (D17-b) |
| discountAmount | decimal(12,2), no negativo, por defecto 0 | descuento en pesos de toda la venta (D17-c) |
| note | texto opcional, no solo espacios | nota de casos especiales (D17-d) |
| onCredit | verdadero o falso | si la venta se carga a la cuenta corriente del cliente |
| creditAccountId | entero, clave foránea → CreditAccount, opcional | ficha a la que pertenece; obligatoria si `onCredit` |
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

El **total de la venta no se guarda**: es la suma de `quantity × unitPrice` de sus ítems menos `discountAmount` (D13-c, D17-c). Confirmar una venta crea un movimiento de stock `SALE` por ítem; anularla crea uno `SALE_ANNULMENT` por ítem (D13).

**Reglas que hace cumplir la propia base de datos:** una venta confirmada no tiene datos de anulación y una anulada los tiene todos (con motivo no vacío); cantidad y precio de cada ítem mayores que cero; el descuento no es negativo; una venta a crédito tiene cliente y ficha y no tiene medio de pago, y una que no es a crédito tiene medio de pago y no tiene ficha; no se puede borrar una venta, ni un producto, usuario, cliente o ficha que tengan ventas.

### Por qué está en 3FN

- Todas las tablas tienen clave de un solo campo (`id`): se cumple 2FN. `SaleItem` también tiene una clave única compuesta (`saleId`, `productId`), pero `quantity` y `unitPrice` dependen de la clave completa (de qué producto en qué venta), no de una parte.
- Los datos del producto (nombre, categoría) y del usuario (nombre) no se repiten en `Sale` ni `SaleItem`: se llega a ellos con `productId` y `userId`.
- `unitPrice` **no** es un dato repetido de `Product.salePrice`: es el precio histórico del día de la venta, que no se puede deducir del precio actual (puede haber cambiado). Por eso se guarda en el ítem.
- No hay datos derivados guardados: el total de la venta y el stock se calculan.
- Los datos del cliente (nombre, DNI) no se copian a la venta: se llega a ellos con `customerId`.
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


## Módulo 5 (parte) – Fichas de cuenta corriente

### CreditAccount (Ficha de cuenta corriente)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| customerId | entero, clave foránea → Customer | de quién es la ficha |
| status | `OPEN` o `CANCELLED` | pendiente o cancelada (historial separado) |
| openedAt | fecha y hora | momento de la primera venta a crédito del ciclo (D17-f) |
| dueDate | fecha y hora | `openedAt` + 1 mes. No cambia con ventas ni pagos posteriores |
| closedAt | fecha y hora, opcional | cuándo se canceló; vacío mientras está abierta |

El **saldo no se guarda**: se calcula como ventas de la ficha (`Sale.creditAccountId`, con descuentos y sin las anuladas) + recargos registrados − pagos (D17-h, D18).

**Reglas que hace cumplir la propia base de datos:** el vencimiento es posterior a la apertura; una ficha abierta no tiene fecha de cierre y una cancelada sí; un cliente tiene **como máximo una ficha abierta** (índice único parcial) pero puede tener muchas canceladas; no se puede borrar un cliente con fichas ni una ficha con ventas, pagos o recargos.

### Por qué está en 3FN

- Clave de un solo campo (`id`): cumple 2FN.
- El nombre y los datos del cliente no se repiten: se llega con `customerId`.
- `dueDate` depende de la ficha (de su `openedAt` y de la regla de un mes vigente cuando se abrió). Se guarda a propósito porque es un dato histórico del ciclo: si mañana cambia el plazo, las fichas viejas deben conservar el suyo. No es un derivado recalculable, y por eso no viola 3FN.
- El saldo y el estado de mora (vencida o no) se calculan; no se guardan.
- `status` y `closedAt` describen a la ficha como un todo.

### Supuestos a confirmar (no están relevados)

- Que haya una sola ficha abierta por cliente y que una compra a crédito después de cancelar abra un ciclo nuevo (D17-f, D17-g).
- Qué pasa al reabrir una ficha cancelada.

### AccountPayment (Pago a la cuenta)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| accountId | entero, clave foránea → CreditAccount | a qué ficha se paga |
| userId | entero, clave foránea → User | quién registró el pago (auditoría) |
| amount | decimal(12,2) mayor que cero | importe pagado |
| paymentMethod | `CASH`, `TRANSFER`, `CARD` o `DIGITAL_WALLET` | cómo pagó el cliente |
| note | texto opcional, no solo espacios | aclaración |
| createdAt | fecha y hora | cuándo se registró |

Un pago **no modifica** `CreditAccount.dueDate` (regla confirmada). Nunca se edita ni se borra.

### Surcharge (Recargo por mora)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| accountId | entero, clave foránea → CreditAccount | a qué ficha se recarga |
| userId | entero, clave foránea → User | quién lo registró |
| monthNumber | entero desde 1 | cuál mes de atraso es. Único por ficha (`accountId` + `monthNumber`) |
| base | decimal(12,2) mayor que cero | capital pendiente al inicio de ese mes, con el que se calculó |
| percent | decimal(5,2), mayor que 0 y hasta 100 | porcentaje usado (copia del parámetro del momento, D16-d) |
| amount | decimal(12,2) mayor que cero | monto del recargo (D18-b) |
| chargedOn | fecha y hora | fecha en que ese mes de atraso quedó completo |
| createdAt | fecha y hora | cuándo se registró |

**Reglas que hace cumplir la propia base de datos:** importes, base y porcentaje mayores que cero (porcentaje hasta 100), mes desde 1, el mismo mes no se cobra dos veces en una ficha, y no se puede borrar una ficha o un usuario que tengan pagos o recargos.

### Por qué siguen en 3FN

- Las tres tablas (ficha, pago, recargo) tienen clave de un solo campo (`id`); `Surcharge` tiene además la clave única (`accountId`, `monthNumber`), y todos sus campos dependen de esa clave completa.
- Los datos del cliente y del usuario no se repiten: se llega con las claves foráneas.
- `Surcharge.base`, `percent` y `amount` **no son datos derivados repetidos**: `percent` es el valor del parámetro **al momento** de calcular (puede cambiar después) y `base` es el capital de ese momento (depende de pagos y anulaciones que pueden ocurrir luego). Se guardan para que el recargo sea trazable y el pasado no se recalcule. `amount` es el resultado ya cobrado, no se puede deducir si cambian las reglas.
- El **saldo**, los **recargos pendientes** y los **meses de atraso** no se guardan: se calculan.

### Supuestos a confirmar (no están relevados)

- La fórmula completa del recargo y el orden de imputación de los pagos (D18-a a D18-e).
- Que no se admita saldo a favor (D18-h) y qué pasa al reabrir una ficha cancelada (D18-l).


## Módulo 8 (parte) – Auditoría

### AuditLog (Registro de auditoría)

| Campo | Tipo | Detalle |
|---|---|---|
| id | entero, clave primaria | autoincremental |
| userId | entero, clave foránea → User | quién realizó la operación |
| action | texto | clave de la acción (`SALE_REGISTERED`, `SALE_ANNULLED`, `ACCOUNT_PAYMENT_REGISTERED`…) |
| entityType | texto | tipo de lo afectado (`Sale`, `Product`, `CreditAccount`…) |
| entityId | entero, opcional | número de lo afectado |
| summary | texto | descripción en español de lo que se hizo |
| createdAt | fecha y hora | cuándo |

**Reglas que hace cumplir la propia base de datos:** acción, tipo y resumen no vacíos; **no se puede modificar ni borrar una fila** (disparador `AuditLog_append_only`); no se puede borrar un usuario con anotaciones.

### Por qué está en 3FN

- Clave de un solo campo (`id`): cumple 2FN.
- El nombre del usuario no se repite: se llega con `userId`.
- `entityType` + `entityId` apuntan a una fila de cualquier tabla, por eso **no es una clave foránea** (una clave foránea solo puede apuntar a una tabla). Es una referencia polimórfica deliberada: el registro de auditoría debe sobrevivir aunque la fila original cambie.
- `summary` es un texto histórico (qué se vio y se hizo en ese momento): **no es un dato derivado repetido**, porque si el producto cambia de nombre mañana, la anotación de hoy debe seguir diciendo lo que decía.

### Supuestos a confirmar (no están relevados)

- Qué operaciones se auditan (D20-a) y quién puede consultar el registro (D20-g).

