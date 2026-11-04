# API REST

Base: `http://localhost:3000/api`. Todas las respuestas son JSON.
**Todavía no hay login:** hasta que se construya el módulo de usuarios, los endpoints no están protegidos. No usar con datos reales ni exponer a internet.

## Formato de errores

| Código | Cuándo | Cuerpo |
|---|---|---|
| 400 | Datos inválidos | `{ "error": "Datos inválidos", "details": [{ "field": "name", "message": "..." }] }` |
| 404 | No existe el recurso o la ruta | `{ "error": "..." }` |
| 409 | Choca con una regla (por ejemplo, nombre repetido) | `{ "error": "..." }` |
| 500 | Error inesperado del servidor | `{ "error": "Error interno del servidor" }` |

## Salud

- `GET /health` → `200 { "status": "ok" }`

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
| `GET /products` | Lista, ordenados por nombre, cada uno con su categoría. Filtros opcionales: `search` (parte del nombre), `categoryId`, `active` (`true` o `false`) | 200, 400 |
| `GET /products/:id` | Devuelve uno | 200, 400, 404 |
| `POST /products` | Crea uno activo. Cuerpo: `{ "name", "categoryId", "salePrice", "minStock" }` | 201, 400 |
| `PUT /products/:id` | Cambia todos los datos. Cuerpo: igual que al crear, más `"active": true/false` | 200, 400, 404 |

No hay `DELETE`: un producto se da de baja con `"active": false`, para no perder su historial.

Reglas: el nombre es obligatorio (hasta 150 caracteres); la categoría tiene que existir (400 si no); el precio es un importe mayor que cero con hasta 2 decimales y se devuelve como texto con 2 decimales (`"1500.50"`); el stock mínimo es un entero de 0 en adelante (0 por defecto). El stock actual no es parte del producto: se calcula desde los movimientos de inventario (módulo siguiente).

