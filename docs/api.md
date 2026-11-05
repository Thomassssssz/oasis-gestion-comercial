# API REST

Base: `http://localhost:3000/api`. Todas las respuestas son JSON.
**Hay login:** todas las rutas, salvo `/health` y `/auth/login`, exigen una sesión abierta (cookie `oasis_session`); sin ella responden 401. El login todavía necesita una revisión de seguridad antes de usar datos reales (ver D9 en `decisiones.md`).

## Formato de errores

| Código | Cuándo | Cuerpo |
|---|---|---|
| 400 | Datos inválidos | `{ "error": "Datos inválidos", "details": [{ "field": "name", "message": "..." }] }` |
| 401 | No hay sesión abierta, o el usuario o la contraseña son incorrectos | `{ "error": "..." }` |
| 404 | No existe el recurso o la ruta | `{ "error": "..." }` |
| 409 | Choca con una regla (por ejemplo, nombre repetido) | `{ "error": "..." }` |
| 429 | Demasiados intentos fallidos de login | `{ "error": "..." }` |
| 500 | Error inesperado del servidor | `{ "error": "Error interno del servidor" }` |

## Salud

- `GET /health` → `200 { "status": "ok" }`

## Autenticación

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `POST /auth/login` | Abre una sesión. Cuerpo: `{ "username", "password" }`. Entrega la cookie de sesión y devuelve `{ id, username, fullName }` | 200, 400, 401, 429 |
| `POST /auth/logout` | Cierra la sesión actual (responde 204 aunque no haya una) | 204 |
| `GET /auth/me` | Devuelve el usuario de la sesión actual | 200, 401 |
| `POST /auth/change-password` | Cambia la contraseña. Cuerpo: `{ "currentPassword", "newPassword" }`. Cierra las demás sesiones | 204, 400, 401 |

Reglas: el usuario no distingue mayúsculas; la contraseña nueva tiene entre 10 y 128 caracteres y tiene que ser distinta de la actual; después de 5 intentos fallidos para un usuario en 15 minutos, el login responde 429 por un rato; la sesión dura 12 horas. Para el mismo error (usuario inexistente, dado de baja o contraseña incorrecta) se da el mismo mensaje, para no revelar qué usuarios existen.

## Categorías

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /categories` | Lista todas, ordenadas por nombre | 200 |
| `GET /categories/:id` | Devuelve una | 200, 400, 404 |
| `POST /categories` | Crea una. Cuerpo: `{ "name": "Papelería" }` | 201, 400, 409 |
| `PUT /categories/:id` | Cambia el nombre. Cuerpo: `{ "name": "..." }` | 200, 400, 404, 409 |
| `DELETE /categories/:id` | Borra una categoría sin productos | 204, 400, 404, 409 |

Reglas: el nombre es obligatorio, se le quitan los espacios de los costados, tiene hasta 100 caracteres y no puede repetirse (se distingue entre mayúsculas y minúsculas). Una categoría con productos no se puede borrar.

## Productos

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /products` | Lista, ordenados por nombre, cada uno con su categoría. Filtros opcionales: `search` (parte del nombre), `categoryId`, `active` (`true` o `false`), `lowStock` (`true` trae solo los productos en alerta de stock mínimo; `false`, el resto) | 200, 400 |
| `GET /products/:id` | Devuelve uno | 200, 400, 404 |
| `POST /products` | Crea uno activo. Cuerpo: `{ "name", "categoryId", "salePrice", "minStock" }` | 201, 400 |
| `PUT /products/:id` | Cambia todos los datos. Cuerpo: igual que al crear, más `"active": true/false` | 200, 400, 404 |

No hay `DELETE`: un producto se da de baja con `"active": false`, para no perder su historial.

Reglas: el nombre es obligatorio (hasta 150 caracteres); la categoría tiene que existir (400 si no); el precio es un importe mayor que cero con hasta 2 decimales y se devuelve como texto con 2 decimales (`"1500.50"`); el stock mínimo es un entero de 0 en adelante (0 por defecto). El stock no se guarda en el producto: cada respuesta trae `stock` (la suma de sus movimientos, ver *Movimientos de stock*) y `lowStock` (`true` si el stock es igual o menor al stock mínimo, D5). Un producto nuevo tiene stock 0; con stock mínimo 0, un producto sin stock ya figura en alerta.


## Movimientos de stock

Requieren sesión (401 si no hay). El stock de un producto es la suma de las cantidades de sus movimientos (D1).

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /stock-movements` | Lista del más nuevo al más viejo, con el nombre del producto y de quien lo registró. Filtros opcionales: `productId`, `limit` (de 1 a 200, 50 por defecto) | 200, 400 |
| `POST /stock-movements` | Registra un movimiento y devuelve el movimiento con el `stock` que quedó | 201, 400, 404, 409 |

Cuerpo de `POST` según el tipo:

- Stock inicial: `{ "type": "INITIAL_STOCK", "productId", "quantity", "note" }`. La cantidad es un entero mayor que cero. Solo se puede cargar si el producto todavía no tiene movimientos (409 si ya tiene).
- Ajuste: `{ "type": "ADJUSTMENT", "productId", "quantity", "reason", "note" }`. La cantidad es un entero distinto de cero: positiva suma y negativa resta. `reason` es uno de `PHYSICAL_COUNT` (conteo físico), `DAMAGE_OR_LOSS` (rotura o pérdida), `SUPPLIER_RETURN` (devolución a proveedor) u `OTHER` (otro). Con `OTHER`, `note` es obligatoria.

Los movimientos que devuelve el `GET` incluyen también los de venta (`SALE`) y de anulación de venta (`SALE_ANNULMENT`), con su `saleId`; esos tipos los crea el módulo de ventas, no se pueden registrar con este `POST`.

Reglas: la `note` es opcional (hasta 500 caracteres). Un ajuste no puede dejar el stock en negativo (409 con el stock actual en el mensaje). Un producto que no existe responde 404. Quién registró el movimiento sale de la sesión, nunca del cuerpo del pedido. No hay `PUT` ni `DELETE`: un movimiento no se edita ni se borra, un error se corrige con otro movimiento (D12).

## Ventas

Requieren sesión (401 si no hay). Venta rápida: el precio siempre es el de lista del producto (D13-a). El total no se guarda: se calcula sumando los ítems (D13-c).

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /sales` | Lista del más nuevo al más viejo, con total e ítems. Filtros opcionales: `status` (`CONFIRMED` o `ANNULLED`), `paymentMethod`, `limit` (de 1 a 200, 50 por defecto) | 200, 400 |
| `GET /sales/:id` | Devuelve una venta con su detalle | 200, 400, 404 |
| `POST /sales` | Registra una venta. Cuerpo: `{ "paymentMethod", "items": [{ "productId", "quantity" }] }` | 201, 400, 409 |
| `POST /sales/:id/annul` | Anula una venta. Cuerpo: `{ "reason" }` | 200, 400, 404, 409 |

`paymentMethod` es uno de `CASH`, `TRANSFER`, `CARD`, `DIGITAL_WALLET`. Cada venta devuelve `total` e importes como texto con 2 decimales, `status`, `userName` (quién la registró), `items` (con `productName`, `quantity`, `unitPrice` y `subtotal`) y `annulment` (`null` si está confirmada; si no, `at`, `byName` y `reason`).

Reglas: hace falta al menos un producto (hasta 100) y no se puede repetir un producto en la misma venta; la cantidad es un entero mayor que cero. Si un producto no existe responde 400. Si un producto está dado de baja o no tiene stock suficiente, responde 409 con el producto y su stock actual, y **no se guarda nada** (todo o nada). Al confirmar se descuenta el stock; al anular se devuelve con un movimiento propio. Una venta anulada no se puede volver a anular (409) y sigue en el historial. El motivo de anulación es obligatorio (hasta 500 caracteres). Quién registra y quién anula sale de la sesión, nunca del cuerpo del pedido. No hay `PUT` ni `DELETE` (D3).


## Clientes

Requieren sesión (401 si no hay). Cada cliente tiene su ficha individual (D14).

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /customers` | Lista ordenada por nombre. Filtros opcionales: `search` (busca en nombre, DNI y teléfono, sin distinguir mayúsculas), `active` (`true` o `false`), `creditAuthorized` (`true` o `false`) | 200, 400 |
| `GET /customers/:id` | Devuelve una ficha | 200, 400, 404 |
| `POST /customers` | Crea un cliente. Cuerpo: `{ "name", "phone", "dni", "address", "notes", "creditAuthorized" }` (solo `name` es obligatorio) | 201, 400, 409 |
| `PUT /customers/:id` | Cambia todos los datos. Cuerpo: igual que al crear, más `"active": true/false` | 200, 400, 404, 409 |

No hay `DELETE`: un cliente se da de baja con `"active": false` y se reactiva con `"active": true`, para no perder su historial. Un `PUT` reemplaza la ficha completa: los datos opcionales que no se envían quedan vacíos.

Reglas: el nombre es obligatorio (hasta 150 caracteres) y puede repetirse. El DNI es opcional, tiene 7 u 8 dígitos y se acepta con puntos o espacios (`30.123.456`), pero se guarda y devuelve solo con dígitos; si ya lo tiene otro cliente responde 409. El teléfono es opcional: números, espacios, `+`, `-` y paréntesis, de 6 a 30 caracteres. La dirección admite hasta 200 caracteres y las observaciones hasta 500. Un texto opcional enviado vacío o con solo espacios se guarda como sin dato (`null`). Al crear, `creditAuthorized` es `false` por defecto y el cliente siempre nace activo.

## Proveedores

Requieren sesión (401 si no hay). Solo la ficha del proveedor: las compras no se registran en el sistema (D15-f).

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /suppliers` | Lista ordenada por nombre. Filtros opcionales: `search` (busca en nombre, email y teléfono, sin distinguir mayúsculas en nombre y email), `active` (`true` o `false`) | 200, 400 |
| `GET /suppliers/:id` | Devuelve una ficha | 200, 400, 404 |
| `POST /suppliers` | Crea un proveedor. Cuerpo: `{ "name", "phone", "email", "address", "notes" }` (solo `name` es obligatorio) | 201, 400, 409 |
| `PUT /suppliers/:id` | Cambia todos los datos. Cuerpo: igual que al crear, más `"active": true/false` | 200, 400, 404, 409 |

No hay `DELETE`: un proveedor se da de baja con `"active": false` y se reactiva con `"active": true`. Un `PUT` reemplaza la ficha completa: los datos opcionales que no se envían quedan vacíos.

Reglas: el nombre es obligatorio (hasta 150 caracteres) y **no puede repetirse** (409; se ignoran los espacios de más). El email es opcional y tiene que tener formato válido (hasta 254 caracteres). El teléfono es opcional: números, espacios, `+`, `-` y paréntesis, de 6 a 30 caracteres. La dirección admite hasta 200 caracteres y las observaciones hasta 500. Un texto opcional enviado vacío o con solo espacios se guarda como sin dato (`null`). Al crear, el proveedor siempre nace activo.
