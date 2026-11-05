# Decisiones de diseño y de negocio

Registro de decisiones tomadas por el autor. Cada una dice qué se decidió, por qué y qué otras opciones había.
Las decisiones que dependen de los propietarios del comercio se marcan como **a confirmar**.

## D1 – El stock se calcula desde los movimientos

- **Decisión:** los productos no tienen un campo `stock`. El stock actual es la suma de los movimientos de inventario (entradas suman, salidas restan).
- **Por qué:** guardar el stock además de los movimientos repetiría un dato que se puede derivar, y los dos podrían quedar desincronizados. Calcularlo mantiene el modelo normalizado (3FN) y deja todo auditable.
- **Alternativa descartada:** campo `stock` guardado más historial de movimientos (más directo de leer, pero con dato derivado repetido).
- **Costo conocido:** hay que hacer una suma por producto al consultar. Con unos 1.000 productos (dato de dimensionamiento) no debería ser un problema.

## D2 – No se vende sin stock suficiente

- **Decisión:** el sistema bloquea la confirmación de una venta si alguno de los productos no tiene stock suficiente. No se permite stock negativo.
- **Por qué:** evita inventario inconsistente y obliga a mantener el stock al día.
- **Alternativa descartada:** permitir la venta con advertencia y dejar el stock en negativo.
- **A confirmar con los propietarios:** si en la práctica del comercio se vende a veces mercadería que todavía no se cargó.

## D3 – Las ventas confirmadas se anulan, no se borran

- **Decisión:** una venta confirmada nunca se elimina. Se puede anular indicando el motivo y quién la anuló; al anularla, el stock vuelve mediante un movimiento de inventario.
- **Por qué:** todas las ventas deben registrarse y las operaciones importantes se auditan.
- **Alternativa descartada:** no permitir anulaciones por ahora.
- **Pendiente:** las devoluciones parciales y los reembolsos no están definidos.

## D4 – Un solo tipo de usuario: propietario

- **Decisión:** el sistema tiene usuarios con login y contraseña protegida, todos con los mismos permisos (los dos propietarios).
- **Por qué:** es lo único definido hasta ahora; no se asumen roles que nadie pidió.
- **Alternativa descartada:** dos roles (administrador y empleado).
- **Nota:** si más adelante se necesitan roles, se agregan sin rehacer el login.

## D5 – La alerta de stock mínimo salta con "igual o menor"

- **Decisión:** un producto está en alerta cuando su stock es **menor o igual** a su stock mínimo.
- **Por qué:** avisa a tiempo para reponer, antes de quedarse sin mercadería.
- **Alternativa descartada:** alertar solo cuando el stock es menor al mínimo.

## D6 – Las cantidades de stock son siempre unidades enteras

- **Decisión:** el stock y los movimientos se miden en unidades enteras (1, 2, 3).
- **Por qué:** es lo habitual en una librería y simplifica el modelo.
- **Alternativa descartada:** cantidades con decimales (metros, kilos), que obligarían a definir una unidad de medida por producto.
- **A confirmar con los propietarios:** si hay productos que se venden por medida.

## D7 – Los ajustes manuales de stock llevan un motivo de una lista fija

- **Decisión:** un ajuste manual se registra con un motivo elegido de una lista: conteo físico, rotura o pérdida, devolución a proveedor y otro (con una nota).
- **Por qué:** permite analizar las diferencias de stock en los reportes.
- **Alternativa descartada:** motivo en texto libre.
- **A confirmar con los propietarios:** si la lista de motivos alcanza.

## D8 – Primero usuarios y login, después inventario

- **Decisión:** se construye el módulo de usuarios y login antes que inventario y ventas.
- **Por qué:** así cada movimiento y cada venta guardan desde el principio quién la realizó (auditoría), y se cierra el hecho de que la API hoy está abierta a cualquiera.
- **Alternativa descartada:** inventario primero y login después (los movimientos quedarían sin usuario y habría que completarlos).

## D9 – Cómo funciona el login (propuesta de Claude, a revisar por el autor)

Esta decisión de diseño la propuso Claude y no fue elegida entre opciones por el autor; hay que revisarla y poder defenderla.

- **Contraseñas:** se guardan solo como hash con `scrypt` (incluido en Node, sin librerías extra), con una sal aleatoria por contraseña. La contraseña original nunca se guarda ni se muestra.
- **Sesión:** al entrar, el servidor genera un código aleatorio, guarda en la base solo su hash SHA-256 y entrega el código en una cookie `HttpOnly` y `SameSite=Lax` (el código JavaScript de la página no puede leerla). La sesión dura 12 horas y se puede cerrar desde el servidor.
- **Límite de intentos:** después de 5 intentos fallidos para un mismo usuario en 15 minutos, el login se bloquea por un rato.
- **Usuarios nuevos:** no hay registro público. Los usuarios se crean con un script de línea de comandos (por ahora, los dos propietarios).
- **Alternativas descartadas:** JWT sin estado (no se puede cerrar una sesión desde el servidor) y librerías externas de hash como bcrypt o argon2 (más dependencias que compilar).
- **Límites conocidos:** el límite de intentos está en memoria del servidor (se reinicia si se reinicia el servidor) y no hay recuperación de contraseña por correo. Antes de uso comercial real, el login requiere revisión de seguridad.

## D10 – El código se ordena por tipo de archivo, como el proyecto SITGI

- **Decisión:** tanto el backend como el frontend se organizan en carpetas por tipo de archivo (`routes/`, `controllers/`, `services/`, `pages/`, `components/`...), siguiendo la estructura del repositorio SITGI, y no por módulo.
- **Por qué:** el autor la entiende mejor y puede explicarla paso a paso. Cada carpeta tiene una sola responsabilidad.
- **Qué se tomó de SITGI y qué no:** se tomó la forma de ordenar las carpetas y la convención de nombres `<nombre>.<tipo>`. No se tomó su tecnología (JavaScript, MySQL, Sequelize): el proyecto sigue con TypeScript, PostgreSQL y Prisma. SITGI no separa servicios, repositorios ni validadores; en Oasis se agregaron `services/`, `repositories/` y `validators/` para conservar la separación entre rutas, reglas de negocio y acceso a datos.
- **Alternativas descartadas:** dejar el backend por módulo (`src/modules/<nombre>/`) y una versión más corta del backend sin repositorios.
- **Costo conocido:** agregar un módulo nuevo toca varias carpetas (un archivo en cada una), en vez de una sola.


## D11 – El frontend usa react-router-dom para las pantallas y el login

- **Decisión:** se agrega `react-router-dom` al frontend. Cada sección tiene su propia dirección (`/login`, `/productos`, `/categorias`) y las pantallas con datos solo se muestran si hay una sesión abierta.
- **Por qué:** hace falta una pantalla de login y que todo lo demás quede protegido; con direcciones reales se puede recargar la página sin perder el lugar y las pantallas protegidas se resuelven en un solo lugar (`routes/AppRoutes.tsx`). SITGI usa la misma librería.
- **Cómo funciona:** al abrir la app, `AuthProvider` le pregunta a la API quién tiene la sesión abierta (`GET /api/auth/me`). Si no hay sesión, `ProtectedRoute` manda a `/login`. Si en cualquier momento la API responde 401 (por ejemplo, la sesión venció a las 12 horas), la app vuelve sola al login.
- **Alternativa descartada:** seguir con el estado interno `Section` y un login que reemplace toda la pantalla (no se podía abrir ni recargar una sección concreta).
- **Límite conocido:** el frontend no guarda la sesión: la guarda el navegador en la cookie `HttpOnly` que entrega el servidor (ver D9). Cambiar la contraseña desde la pantalla todavía no existe (la API sí lo permite).

## D12 – Cómo se registran los movimientos de stock

Decisiones elegidas por el autor (a, b, c) y reglas que propuso Claude (d a g) para aplicar D1, D2, D6 y D7. Las reglas propuestas hay que revisarlas y poder defenderlas.

- **a) Cantidad con signo (autor):** cada movimiento tiene una sola columna `quantity`: positiva si entra mercadería y negativa si sale. El stock de un producto es la suma de esa columna. Alternativa descartada: dos columnas (entrada y salida), porque se podría cargar un dato inválido con las dos con valor.
- **b) Stock inicial como tipo propio (autor):** el stock que el comercio ya tiene al empezar se carga con el tipo `INITIAL_STOCK`, distinto de los ajustes. Así el historial muestra claramente cuál fue la carga de arranque.
- **c) El ajuste se escribe como diferencia (autor):** quien ajusta indica cuántas unidades suma o resta (por ejemplo, -2 por rotura), no el stock real contado. Así el movimiento guardado no depende de cuánto stock había en ese momento.
- **d) Tipos de movimiento hoy:** `INITIAL_STOCK` y `ADJUSTMENT`. Las ventas, anulaciones y compras agregan sus propios tipos cuando se construyan esos módulos.
- **e) Reglas del stock inicial (propuesta):** cantidad mayor que cero, y solo se puede cargar si el producto todavía no tiene ningún movimiento (si ya tiene, se corrige con un ajuste).
- **f) Reglas del ajuste (propuesta):** la cantidad es un entero distinto de cero (D6), lleva un motivo de la lista fija de D7 y, si el motivo es "otro", una nota obligatoria. Un ajuste no puede dejar el stock por debajo de cero (misma idea que D2). **Esto resuelve en la práctica el punto pendiente de "stock negativo"; confirmar con los propietarios.**
- **g) Trazabilidad:** cada movimiento guarda quién lo hizo (`userId`) y cuándo (`createdAt`). Los movimientos no se editan ni se borran: un error se corrige con otro movimiento. Un producto dado de baja puede recibir ajustes (por ejemplo, para llevar su stock a cero).
- **Protección contra dos operaciones a la vez:** al registrar un movimiento se bloquea la fila del producto durante la operación, así dos ajustes simultáneos no pueden dejar el stock en negativo.

## D13 – Cómo funciona la venta rápida

Decisiones elegidas por el autor (a, b, c) y reglas que propuso Claude (d a i) para aplicar D2, D3 y D12. Las reglas propuestas hay que revisarlas y poder defenderlas.

- **a) Precio de lista siempre (autor):** en la venta rápida no se puede cambiar el precio de un producto. La venta guarda el precio que tenía el producto ese día (`unitPrice` en cada ítem), así un cambio de precio posterior no altera las ventas viejas. Los descuentos se hacen en la venta completa (módulo posterior).
- **b) La anulación devuelve el stock (autor):** al anular una venta, cada ítem vuelve al inventario con un movimiento propio de tipo `SALE_ANNULMENT`, que queda registrado con quién y cuándo.
- **c) El total se calcula, no se guarda (autor):** el total de una venta es la suma de `quantity × unitPrice` de sus ítems. No hay un campo `total`, así que no puede quedar desactualizado y la tabla se mantiene en 3FN.
- **d) Qué lleva una venta:** medio de pago (efectivo, transferencia, tarjeta o billetera virtual), al menos un producto con su cantidad (entero mayor que cero), y quién la registró. Un mismo producto no se repite dentro de una venta.
- **e) Descuento de stock (D2):** confirmar la venta descuenta el stock con un movimiento de tipo `SALE` por ítem. Si algún producto no tiene stock suficiente, no se registra nada (todo o nada).
- **f) Qué se puede vender:** solo productos activos. Un producto dado de baja no se puede vender.
- **g) Las ventas no se editan ni se borran (D3):** se anulan, y la venta anulada queda en el historial con su motivo, quién la anuló y cuándo. Una venta anulada no se puede volver a anular.
- **h) Motivo de anulación obligatorio (propuesta):** para que quede registrado por qué se anuló (hasta 500 caracteres).
- **i) Quién puede anular (propuesta):** cualquier usuario con sesión, porque no hay roles (D4). Si más adelante se quiere limitar, se define con los propietarios.
- **Protección contra operaciones simultáneas:** al vender o anular se bloquean las filas de los productos involucrados, así dos ventas al mismo tiempo no pueden vender el mismo stock dos veces.

## D14 – Cómo se guarda la ficha de un cliente

Decisiones elegidas por el autor (a, b, c) y reglas que propuso Claude (d a g). Las reglas propuestas hay que revisarlas y poder defenderlas.

- **a) Datos de la ficha (autor):** nombre (obligatorio), teléfono, DNI, dirección y observaciones. Todos menos el nombre son opcionales.
- **b) Crédito con una casilla (autor):** cada cliente está autorizado o no a comprar a crédito (`creditAuthorized`, por defecto no). No hay límite de deuda: no se relevó que exista, y no se inventa. Si los propietarios definen uno, se agrega después.
- **c) Los clientes no se borran (autor):** se dan de baja (`active = false`), como los productos. Así queda el historial de sus ventas y cuentas corrientes. Un cliente de baja no puede comprar a crédito (regla que se aplica cuando existan las cuentas corrientes).
- **d) DNI único (propuesta):** si se carga un DNI, no puede repetirse en otro cliente (dos personas no comparten DNI). Se guarda solo con dígitos (se aceptan puntos y espacios al escribirlo) y tiene 7 u 8 dígitos. **Esto deja afuera documentos de extranjeros o CUIT; confirmar con los propietarios si hacen falta.**
- **e) Nombre repetido permitido (propuesta):** puede haber dos clientes con el mismo nombre (homónimos); el DNI es lo que los distingue.
- **f) Teléfono libre con formato básico (propuesta):** solo dígitos, espacios, `+`, `-` y paréntesis, de 6 a 30 caracteres. No se normaliza a un formato único.
- **g) Búsqueda (propuesta):** el buscador del listado mira el nombre, el DNI y el teléfono.
- **Datos personales:** la ficha guarda datos personales (DNI, teléfono, dirección). Antes de usar datos reales hay que revisar la protección de datos personales aplicable (Ley 25.326 en Argentina) y los permisos del hosting (Render y Neon).

## D15 – Compras y proveedores quedan fuera de la app

- **Decisión (autor):** la compra a un proveedor "no debe estar en la app, eso se hace de otra manera", y la ficha de proveedores tampoco ("eso no va en la app"). Por lo tanto **no hay módulo de compras ni de proveedores**: no se registran compras, recepciones de mercadería ni proveedores.
- **Qué cambia:**
  - Se quitaron del `CLAUDE.md` el módulo 6 y la regla "confirmar la recepción de una compra aumenta stock". La numeración de los demás módulos no se modificó.
  - El stock entra solo por *stock inicial* y *ajustes manuales con motivo* (D12). El motivo de ajuste "devolución a proveedor" (D7) se mantiene: es una forma de restar stock, no un registro de proveedores.
  - Durante un momento existió una tabla `Supplier` (migración `20261104250000_suppliers`) que se eliminó con la migración `20261104260000_drop_suppliers`. No tenía relación con otras tablas y no se perdió información. Las migraciones ya aplicadas no se borran del historial; se agrega una nueva que deshace el cambio.
- **Consecuencia para la estimación:** los reportes futuros no pueden incluir costos de compra, porque no se guardan. Si más adelante hicieran falta, hay que volver a decidirlo.
