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
