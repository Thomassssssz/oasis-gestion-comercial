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

## D16 – Parámetros del sistema (configuración)

La regla confirmada es que el recargo por mora es del 5% por mes y es un **parámetro configurable**. El resto son propuestas de Claude que hay que revisar y poder defender.

- **a) Una sola fila de parámetros:** la tabla `Setting` tiene una única fila (la base lo exige con `id = 1`). Hoy tiene un solo parámetro, `lateFeePercent`, con valor inicial 5. Si más adelante hay más parámetros, se agregan como columnas de esa fila.
- **b) Rango (propuesta):** de 0 a 100, con hasta 2 decimales. 0 significa "sin recargo".
- **c) Se registra quién lo cambió (propuesta):** la fila guarda el último usuario que lo modificó y cuándo. Eso sale de la sesión, nunca del cuerpo del pedido.
- **d) Cambiar el porcentaje no reescribe el pasado:** los recargos que se registren van a guardar el porcentaje con el que se calcularon. Así no se recalcula nada en silencio.
- **e) Cualquier usuario puede cambiarlo (a confirmar):** todavía no hay roles de usuario (D4), así que los dos propietarios pueden modificarlo.
- **Cambio de contraseña:** la pantalla de Configuración también permite cambiar la propia contraseña (usa la API que ya existía, que cierra las demás sesiones).


## D17 – Venta completa y fichas de cuenta corriente

Lo confirmado por el comercio: venta rápida (productos, cantidades, total y medio de pago) y venta completa (además cliente, descuentos y casos especiales); solo los clientes autorizados compran a crédito; cada cliente tiene su ficha individual; el primer producto registrado en la ficha inicia el plazo de un mes de esa ficha, y cada cliente tiene su propio ciclo; las cuentas canceladas pasan a un historial separado. El resto son **propuestas de Claude, a confirmar con los propietarios**.

- **a) Una sola venta, con datos opcionales:** la venta rápida y la completa usan la misma tabla y el mismo endpoint. La rápida no lleva cliente, descuento ni nota; la completa sí (propuesta).
- **b) Cliente en una venta (propuesta):** tiene que existir y estar activo. Una venta de contado puede llevar cliente (para el historial) sin tocar ninguna ficha.
- **c) Descuento (propuesta):** es un **importe en pesos** (no un porcentaje) que se resta del subtotal de la venta, y tiene que ser menor al subtotal (no puede dejarla en cero ni en negativo). No se prorratea por ítem: el descuento es de toda la venta. El total sigue sin guardarse: `total = Σ(cantidad × precio) − descuento`.
- **d) Nota de "casos especiales" (propuesta):** texto libre opcional de hasta 500 caracteres. No tiene efecto en los cálculos; sirve para dejar constancia (pedido especial, acuerdo con el cliente, etc.).
- **e) Venta a crédito (propuesta):** se marca con `onCredit`, exige cliente activo **autorizado** a crédito (si no, 409) y **no lleva medio de pago**, porque se cobra después. Descuenta stock igual que cualquier venta.
- **f) Una ficha abierta por cliente (propuesta):** la primera venta a crédito de un cliente abre su ficha, con `openedAt` = momento de esa venta y `dueDate` = un mes después (**confirmado**: el primer producto inicia el plazo). Las ventas a crédito siguientes se suman a la misma ficha y **no mueven el vencimiento**. La base lo garantiza con un índice único parcial (una sola ficha `OPEN` por cliente).
- **g) Ciclo nuevo (propuesta):** cuando la ficha se cancela, la próxima compra a crédito del cliente abre una ficha nueva con su propio plazo. Qué pasa con "reabrir una ficha cancelada" sigue **a confirmar**; mientras tanto no se reabre: se abre otra.
- **h) Saldo no guardado:** el saldo de la ficha se calcula (ventas no anuladas menos descuentos, más recargos, menos pagos) para no tener datos derivados (3FN). El vencimiento sí se guarda: es una fecha histórica del ciclo, no se puede deducir después si cambia la regla del plazo.
- **i) Anular una venta a crédito (propuesta):** baja el saldo de la ficha. Si el saldo queda en cero, la ficha pasa al historial de canceladas. Si el cliente ya pagó más de lo que quedaría debiendo, no se puede anular (409).
- **j) Reloj de negocio:** las reglas de vencimiento usan un reloj propio (`businessNow`), separado del de las sesiones, para poder probar vencimientos sin vencer el login.
- **k) Las fichas no se editan ni se borran a mano:** nacen de una venta a crédito y cambian de estado por sus movimientos.


## D18 – Pagos, vencimientos y recargos por mora

**Confirmado por el comercio:** un pago parcial reduce el saldo pero **no reinicia ni modifica el vencimiento original**; el recargo es del 5% por mes de atraso y es un parámetro configurable (D16); los recargos se registran de forma trazable y no se recalcula el pasado en silencio; las cuentas canceladas pasan a un historial separado.

**La fórmula exacta NO está confirmada.** Lo siguiente son **propuestas de Claude, a confirmar con los propietarios** y con revisión profesional y legal antes del uso comercial real. Todo el cálculo está aislado en `backend/src/helpers/credit.ts`, así que cambiar la fórmula no toca el resto del sistema.

- **a) Cuándo corresponde un recargo (propuesta):** por cada **mes de atraso completo** después del vencimiento. El primer recargo corresponde cuando pasó un mes entero desde `dueDate`; el segundo, dos meses, etc. Una ficha vencida hace un día figura "vencida" pero todavía no tiene recargo.
- **b) Cuánto (propuesta):** `recargo del mes k = porcentaje × capital pendiente al inicio de ese mes`, redondeado a 2 decimales (hacia arriba en la mitad). **Sin capitalizar:** un recargo no genera recargo en el mes siguiente. El mes 1 toma el saldo pendiente al vencimiento (esto es lo que decía la propuesta original del CLAUDE.md).
- **c) Orden de imputación de un pago (propuesta):** un pago cubre **primero los recargos que ya correspondían** a esa fecha y **después el capital**. Es una de las preguntas pendientes con los propietarios.
- **d) Ventas agregadas después del vencimiento (propuesta):** entran en el capital pendiente recién a partir del mes cuyo inicio es posterior a la venta (no cambian la base de los meses anteriores). También es una pregunta pendiente (artículos agregados después del inicio del ciclo).
- **e) Pagos posteriores al vencimiento (propuesta):** no borran los recargos ya registrados; reducen el capital sobre el que se calculan los meses siguientes.
- **f) Registrar los recargos es una acción, no un cálculo silencioso:** la pantalla muestra los recargos que ya corresponden (`pendingSurcharges`) pero solo se guardan al **aplicarlos** (`POST /accounts/:id/surcharges`) o al **registrar un pago**, que primero registra los recargos pendientes para que el pago los cubra. Cada recargo guarda el mes, la base, el porcentaje usado, el monto, la fecha a la que corresponde y quién lo registró. Un mes no se puede cobrar dos veces (índice único).
- **g) Cambiar el porcentaje no reescribe el pasado (D16-d):** los recargos ya registrados conservan el porcentaje con el que se calcularon; los meses nuevos usan el vigente.
- **h) Un pago no puede superar el saldo (propuesta):** el saldo incluye los recargos que ya corresponden. Si lo supera, se rechaza (409) y no se guarda nada, ni siquiera los recargos que se iban a registrar (todo o nada). No hay saldo a favor.
- **i) Un pago es un renglón propio:** lleva importe, medio de pago (los cuatro confirmados), nota opcional, quién y cuándo. No se edita ni se borra: un error se corrige hablando con quien administra la base o, a futuro, con una operación de corrección (a definir).
- **j) Saldo en cero ⇒ ficha cancelada:** cuando un pago (o una anulación) deja el saldo en cero, la ficha pasa al historial y registra `closedAt`.
- **k) Anular una venta a crédito con pagos hechos:** se rechaza si el saldo quedaría negativo (el cliente ya pagó más de lo que quedaría debiendo). Los recargos ya registrados **no se borran** al anular una venta (no se recalcula el pasado).
- **l) Reabrir una ficha cancelada:** sigue sin definirse (a confirmar). Hoy no se reabre: una compra a crédito nueva abre otra ficha (D17-g).


## D19 – Reportes y estadísticas

No hay reglas de negocio confirmadas sobre qué reportes quieren los propietarios: lo siguiente son **propuestas de Claude, a confirmar**. Los reportes son de solo lectura, se calculan al momento y **no agregan tablas** (3FN: no se guarda ningún dato derivado).

- **a) Qué reportes (propuesta):** ventas por día, ventas por medio de pago, productos más vendidos (top 10), productos con stock bajo y deuda de clientes. No hay reportes de costos ni de compras (D15).
- **b) Qué cuenta como venta (propuesta):** solo las ventas **confirmadas**; las anuladas no suman. Una venta a crédito cuenta el **día en que se hizo** (aparece como "A crédito" en el medio de pago); cuándo se cobra se ve en Cuentas corrientes. Los pagos de cuenta corriente no se suman como ventas para no contarlas dos veces.
- **c) Días en hora de Argentina (propuesta):** los días del reporte son días locales (UTC-3, sin horario de verano). Una venta a las 23:30 de Formosa cuenta para ese día aunque en UTC ya sea el siguiente. Si algún día el comercio cambiara de huso, hay una sola constante para cambiar (`helpers/report-dates.ts`).
- **d) Rango (propuesta):** desde y hasta inclusivos; por defecto, los últimos 30 días hasta hoy; máximo 366 días. Se muestran todos los días del rango, aunque no hayan tenido ventas.
- **e) Totales:** total vendido, cantidad de ventas y ticket promedio (total ÷ ventas, redondeado a 2 decimales).
- **f) Más vendidos (propuesta):** ordenados por unidades; si empatan, por importe y luego por nombre. El importe de un producto es cantidad × precio de lista **de esa venta, antes del descuento** (el descuento es de toda la venta y no se prorratea, D17-c), por eso la suma de los productos puede superar el total vendido.
- **g) Stock bajo:** reutiliza el filtro `lowStock` de productos (alerta de stock mínimo, D5).
- **h) Deuda de clientes (propuesta):** las fichas pendientes de mayor a menor monto **a pagar hoy** (saldo + recargos que ya corresponden). Los totales separan saldo registrado y monto a pagar.


## D20 – Auditoría

**Confirmado:** se registra quién realizó cada operación importante. **Pendiente de confirmar con los propietarios:** qué operaciones cuentan como "importantes" y cómo se manejan anulaciones, devoluciones y stock negativo. Lo siguiente son **propuestas de Claude**.

- **a) Qué se audita (propuesta):** todas las operaciones que **cambian datos**: ventas (registro y anulación), movimientos de stock (stock inicial y ajustes), pagos y recargos de cuentas corrientes, cambio del recargo por mora, altas y cambios de clientes (incluye el crédito autorizado) y de productos (incluye el precio), categorías, y el cambio de contraseña. **No** se audita: consultas (GET), reportes, inicio y cierre de sesión (queda como mejora si se quiere saber quién entró y cuándo).
- **b) Qué se guarda:** quién (usuario de la **sesión**, nunca del cuerpo del pedido), cuándo, una clave de acción (por ejemplo `SALE_ANNULLED`), el tipo y el número de la entidad afectada y un **texto resumen** en español ("Anuló la venta #12. Motivo: …"). No se guardan contraseñas ni datos innecesarios.
- **c) Solo se agrega:** la base de datos rechaza modificar o borrar una anotación (disparador en PostgreSQL). Tampoco existe un endpoint para hacerlo.
- **d) Cómo se escribe:** un middleware anota después de que la operación salió bien (código menor a 400) y **antes** de enviar la respuesta. Las operaciones que fallan no se anotan. La tabla de "qué ruta genera qué anotación" está en un solo archivo (`helpers/audit-rules.ts`).
- **e) Limitación conocida:** la anotación **no está en la misma transacción** que la operación. Si la base falla justo al anotar, la operación queda hecha y el error se escribe en el log del servidor; la respuesta no se convierte en un error para el usuario, porque la operación sí se hizo. Si se quisiera atomicidad total, hay que mover la anotación dentro de cada servicio (cambio más grande, a decidir).
- **f) Redundancia útil:** ventas, anulaciones, movimientos de stock, pagos, recargos y cambios de parámetros ya guardan su propio usuario y fecha en sus tablas (auditoría por tabla); el registro de auditoría suma una línea de tiempo única y cubre lo que no tenía (productos, clientes, categorías, contraseña).
- **g) Consulta:** `GET /api/audit` con filtros por usuario, acción, entidad y días (hora de Argentina); más nuevas primero; 100 por defecto, máximo 500. Cualquier usuario con sesión puede consultarla (no hay roles, D4): **a confirmar**.
- **h) Anulaciones, devoluciones y stock negativo (a confirmar):** hoy una venta no se borra, se anula con motivo y devuelve el stock (D13); un ajuste no puede dejar stock negativo (D12); las devoluciones no existen como operación aparte.


## D21 – Datos de prueba (seed)

**Origen:** pedido del autor para probar todo con volumen. Los números (1.000 productos y 50 clientes) son los de dimensionamiento de `CLAUDE.md`; el autor eligió 50 clientes (había pedido 150 por error de tipeo). **Todo lo que genera es inventado**: no es el inventario ni la cartera real de la librería.

- **a) Cómo se carga:** `npm run db:seed -- <usuario>`. Pasa por los **mismos servicios** que usa la API (productos, clientes, ventas, cuentas corrientes), no escribe las tablas a mano: así se cumplen las reglas de negocio (stock, fichas, vencimiento, recargos) y los datos quedan coherentes. Solo el stock inicial y la fecha de los movimientos de stock de cada venta se escriben directo, porque la API los fecha con la hora actual.
- **b) Actividad simulada:** unos 75 días hacia atrás, día por día, con un reloj que avanza (horario comercial de 9 a 20 hs de Argentina). Más ventas los días hábiles y menos los domingos; unos productos se venden mucho más que otros; ventas con cliente y descuento; ventas a crédito; pagos parciales y totales; clientes "que se atrasan" para que haya fichas vencidas; recargos registrados en parte de ellas; algunas ventas anuladas; unos productos y clientes dados de baja. Las operaciones que las reglas rechazan (por ejemplo, sin stock) se saltean.
- **c) Repetible:** usa un generador de números al azar con semilla, así que dos personas obtienen los mismos datos.
- **d) Protecciones:** se niega a correr si la base ya tiene productos, clientes, categorías o ventas (no mezcla datos de prueba con datos cargados por alguien), y no corre con `NODE_ENV=production`.
- **e) Datos ficticios:** los DNI empiezan con 98 y los clientes llevan la nota "Dato de prueba (seed)". Los precios son inventados, redondeados a múltiplos de 50 pesos. Los teléfonos tienen formato de Formosa pero son al azar: podrían coincidir con uno real, no se deben usar para contactar a nadie.
- **f) Auditoría:** no genera anotaciones, porque no pasa por la API (el middleware de D20 vive en las rutas). La pantalla Auditoría arranca vacía hasta que se haga una operación desde la app.


## D22 – La ficha del cliente reemplaza a Cuentas corrientes y a la pantalla de Auditoría

**Origen:** pedido del autor, con las fotos de las fichas en papel del comercio (el remito "X" y la solicitud de crédito): la app resultaba tediosa para sus padres, así que las cuentas corrientes pasan a verse dentro de cada cliente y se saca la auditoría de la vista. **Decisiones del autor:** se usa **solo la ficha formal (la del remito)**; la solicitud de crédito no se replica. **Propuestas de Claude, a confirmar:**

- **a) Ficha del cliente (`/clientes/:id`):** al tocar el nombre en la lista de Clientes se abre su ficha, que es **el remito "X" del talonario, armado igual que la hoja de papel** (el autor pidió que se vea "literal" como el remito): encabezado del emisor con la X, fecha en tres casilleros, "Documento no válido como factura", señor/es, domicilio, localidad, condición de IVA, condiciones de venta (se tilda *Cuenta Corriente* si hay ficha abierta), CUIT y Remito Nº, grilla de **12 renglones** (cantidad, detalle, precio unitario y total; si hay más artículos la grilla crece), TOTAL $, "Recibí conforme", la barra REMITO y "Original para el cliente / Duplicado para el emisor". Los artículos son los de la ficha de cuenta corriente abierta; las ventas anuladas no figuran (se avisan aparte, en pantalla). *(Reemplazado por D23: la ficha muestra solo el remito, sin estado de la cuenta, historial de canceladas ni compras de contado; los pagos y el saldo van dentro del remito.)*
- **b) Acciones en la ficha:** registrar un pago y aplicar los recargos que ya corresponden se hacen desde la ficha del cliente, con las mismas reglas de D18 (nada cambió en el backend salvo que el detalle de la cuenta ahora trae los artículos de cada venta).
- **c) Lista de Clientes:** columna "Debe" (saldo más recargos que ya corresponden, con el aviso "Vencida") y filtro "Con deuda". Reportes sigue mostrando la deuda total (D19).
- **d) Impresión:** botón **Imprimir** que usa la impresión del navegador. En papel salen el remito y, debajo, el estado de la cuenta (pagos y saldo); no salen el menú, los botones ni los formularios. Los fondos negros del remito (la X y la barra REMITO) se fuerzan a imprimirse. El sistema no factura (fuera de alcance): el remito dice "Documento no válido como factura", igual que el papel.
- **e) Datos del emisor y lo que queda en blanco** *(reemplazado por D23: el encabezado ya no está en el código sino en la base y se edita en el propio remito)*: el nombre, titular, domicilio, condición frente a ARCA, CUIT, Ingresos Brutos e inicio de actividades del encabezado **están copiados de la foto del remito en papel** (información relevada, a pedido del autor) y viven en **un solo archivo del código** (`frontend/src/utils/business.ts`). Ojo: si el repositorio es público, esos datos del titular quedan en GitHub; si molesta, se pueden pasar a la pantalla Configuración (guardados en la base, no en el código). **Quedan en blanco para completar a mano**, como en el papel, lo que el sistema no guarda: *Nº* del remito (el número impreso del talonario no se imita), *Localidad*, *condición de IVA* del cliente, *CUIT* del cliente y *Remito Nº*. El logo se reemplazó por el nombre en texto. No se imprime el pie del talonario (datos de la imprenta).
- **f) Solicitud de crédito:** campos como cónyuge, lugar de trabajo, sueldo, codeudor y plan de mensualidades **no están** en el sistema. El plan de pago en cuotas de ese formulario choca con la regla confirmada (plazo de un mes y recargo por mora, D17 y D18): no se tocó. Si los propietarios quieren cuotas o codeudor, es una decisión de negocio nueva.
- **g) Auditoría:** se sacó **solo la pantalla y el menú**. El sistema **sigue registrando** quién hizo cada operación (regla confirmada, D20) y la API `GET /api/audit` sigue existiendo, para volver a mostrarla si hace falta. Mientras no haya pantalla, la consulta se haría directo en la base.
- **h) Cuentas corrientes:** se sacó la pantalla y el menú; la API `/api/accounts` sigue (la usan la ficha, la lista de Clientes y Reportes). Una dirección vieja como `/cuentas` ahora muestra "Página no encontrada".



## D23 – El remito es editable y se guarda en la base

**Origen:** pedido del autor, tras ver la ficha de D22: la pantalla debe mostrar **solo el remito**, y cada sección del remito se puede tocar y editar ("por ejemplo todo donde dice LOCALIDAD"), con una forma de guardar lo editado. **Decisiones del autor:** los renglones no se editan (vienen de las ventas); los pagos y el saldo van dentro del remito, como renglones; DNI, teléfono, observaciones, crédito autorizado y baja se editan solo desde la lista de Clientes; el encabezado del comercio es editable y se guarda en la base, no en el código. **Propuestas de Claude, a confirmar:**

- **a) Qué se ve:** la ficha del cliente muestra únicamente el remito. Se sacaron el formulario "Editar datos", la tarjeta con DNI/teléfono/crédito/estado/observaciones, el "Estado de la cuenta", las compras de contado, el historial de fichas canceladas y el aviso de ventas anuladas. Quedan el enlace para volver, el botón Imprimir y la barra de cambios. Las ventas anuladas siguen sin figurar en el remito.
- **b) Cómo se edita:** cada dato se toca y se escribe ahí mismo (señor/es, domicilio, localidad, condición de IVA —casilleros: tocar el tildado lo destilda—, CUIT, Nº, Remito Nº y el encabezado del comercio). Lo cambiado y sin guardar se resalta en pantalla (no en papel) y aparece una barra "Tenés N cambios sin guardar" con **Guardar cambios** y **Descartar**. Un dato cuenta como cambiado solo si es distinto de lo guardado (no cuentan espacios sobrantes ni los guiones del CUIT). Nada se guarda solo al escribir.
- **c) Dónde se guarda cada cosa:** el cliente (nombre, domicilio, localidad, IVA, CUIT) en `Customer`; el "Nº" y el "Remito Nº" en la ficha de cuenta (`CreditAccount`), por eso solo se completan si hay una ficha abierta; los datos del comercio en `Setting` (una sola fila), compartidos por todos los remitos. Guardar manda cada grupo a su ruta (`PUT /customers/:id`, `PUT /accounts/:id/remito`, `PUT /settings/business`); si uno falla, los otros igual se guardan y el mensaje dice cuál no se pudo; lo que falló sigue escrito para corregirlo. Cambiar el nombre del cliente cambia su nombre en todo el sistema (no es solo del remito).
- **d) Editar desde la lista no borra lo del remito:** la edición de un cliente reemplaza todos sus datos (D14); por eso el formulario de la lista reenvía también la localidad, el IVA y el CUIT que se cargaron en el remito.
- **e) Condiciones de venta y fecha:** "Contado" / "Cuenta Corriente" no se tocan: se tilda Cuenta Corriente si hay ficha abierta (la decide el sistema). La **fecha** del remito arranca en la de hoy y se puede cambiar, pero **no se guarda** (la hoja de papel la lleva a mano). *(Cambiado por D25-b: con ficha, la fecha es la de apertura de la ficha.)*
- **f) Pagos y saldo dentro del remito:** debajo de los artículos van los recargos por mora ya registrados (suman) y los pagos (restan, en cursiva); el pie muestra TOTAL (ventas − descuentos + recargos registrados), PAGADO y SALDO (el que calcula el servidor), más los recargos que ya corresponden y "A pagar hoy" si los hay, y el vencimiento con "VENCIDA" y los meses de atraso. **Tocar el pie** abre el formulario de pago y los recargos pendientes (D18, sin cambios en las reglas); no sale en papel.
- **g) Encabezado del comercio:** nombre, titular, domicilio (varias líneas), condición frente a ARCA, CUIT, Ingresos Brutos e inicio de actividades. **Quedan guardados en la base** (antes estaban copiados de la foto en `frontend/src/utils/business.ts`, archivo que se eliminó) y se cambian tocando el encabezado. Por pedido del autor, la migración `20261105110000_remito_header_defaults` carga el encabezado original del papel: nombre ("Ediciones Oasis"), titular, domicilio, condición (monotributo) e inicio de actividades (03/2011), que son información relevada. **El CUIT (`20-12345678-9`) y los Ingresos Brutos (`01-20-12345678-9`) son de ejemplo, no los reales**: hay que reemplazarlos tocándolos en el remito antes de imprimir uno de verdad. La migración solo rellena si el encabezado está vacío y nunca pisa lo que alguien ya cargó. El inicio de actividades es texto libre (`03/2011`) porque el papel solo trae mes y año. Ojo: el CUIT y el domicilio que se copiaron antes siguen en el historial de git de `develop` (commit `be6a284`).
- **h) Auditoría:** las dos rutas nuevas se anotan (`ACCOUNT_REMITO_UPDATED`, `BUSINESS_DATA_CHANGED`); guardar al cliente ya se anotaba como `CUSTOMER_UPDATED` (D20).
- **i) Pendiente de confirmar:** que el CUIT no se valide con el dígito verificador (hoy solo se exigen 11 dígitos); que cualquier usuario pueda cambiar los datos del comercio (no hay roles, D4); y qué pasa con el "Nº" y el "Remito Nº" cuando la ficha se cancela y se abre otra (hoy cada ficha guarda los suyos).
- **j) Cuenta pagada por completo (PAGADO):** decisión del autor: cuando el saldo llega a cero la ficha se cancela (D17) y **el cliente sigue activo** (puede volver a comprar; no se lo da de baja). Su ficha queda guardada y, al entrar al cliente, si no tiene una ficha pendiente se ve **la última ficha pagada**: el remito completo, con todo el detalle de la compra, los recargos y los pagos, y un **sello PAGADO grande cruzado por la mitad** (no tapa ni bloquea los campos; sale impreso). El pie dice "Cancelada el …" en lugar del vencimiento y ya no ofrece registrar pagos. Si el cliente tiene más de una ficha (una pendiente y otras pagadas, o varias pagadas), aparece un selector **Ficha** para elegir cuál ver; la pendiente es la que se muestra primero. Los números "Nº" y "Remito Nº" también se pueden completar en una ficha pagada.


## D24 – Estilo de librería

**Origen:** pedido del autor: que la app "tome vida" como librería, con colores y cosas de papelería (cuadernos, lápices), y que el cartel del remito en papel ("Ediciones Oasis" con su emblema) se rehaga más lindo para usarlo en el login. Es solo apariencia: no cambia reglas de negocio ni la API.

- **a) Colores:** salen de la foto del frente del local: azul de la pared, naranja de las persianas, marrón del cartel y amarillo del cartel chico. Viven como variables en `frontend/src/index.css` (una sola parte para cambiar la paleta). El naranja oscuro y el azul se eligieron para que el texto blanco encima tenga buen contraste (mayor a 5:1); el amarillo se usa de adorno o con texto oscuro.
- **b) Letras:** *Atkinson Hyperlegible Next* para todo el texto (está pensada para leerse fácil, con números claros) y *Yellowtail* solo para el nombre "Ediciones Oasis", como la letra cursiva del cartel. Se instalan como paquetes (`@fontsource/...`), así no dependen de Internet ni de Google Fonts.
- **c) Logo y dibujos:** el emblema (palmera, sol y libro abierto) y los dibujos de papelería (lápices, cuaderno, regla, clip) son SVG hechos a mano en `frontend/src/components/brand/`. **Son una recreación mía a partir de la foto, no el logo original**: si los propietarios tienen el archivo del logo, se reemplaza `OasisEmblem`.
- **d) Pantallas:** menú lateral azul tinta con el logo, íconos de papelería sobre cuadraditos de color y una tira de lápices al pie; fondo de hoja rayada con margen rojo (no se imprime); los títulos de sección llevan resaltador amarillo; encabezado con línea punteada; botón naranja para confirmar la venta e ingresar. El login es el frente del local (pared azul, cartel marrón con el nombre, persianas naranjas, útiles) junto a una hoja de cuaderno con espiral donde se escribe usuario y contraseña; en celular se apila.
- **e) Lo que no se toca:** el remito conserva su aspecto en blanco y negro (en pantalla y en papel), y el modo angosto del menú sigue funcionando igual.


## D25 – Sin descuentos en la venta, y la fecha del remito es la de apertura de la ficha

**Origen:** correcciones del autor al revisar las pantallas con el estilo nuevo (D24).

- **a) Se sacan los descuentos de la pantalla de Ventas:** el comercio ya no hace descuentos. En lugar del campo "Descuento en pesos" hay una **lupa para buscar al cliente por nombre** (sin distinguir mayúsculas ni tildes), igual que la de los productos; filtra la lista "Cliente" y no hace desaparecer al cliente ya elegido. El total de la venta es la suma de los productos. **Qué no se tocó:** la API sigue aceptando un descuento (campo opcional) y las ventas viejas que lo tuvieron lo siguen mostrando (historial de Ventas y renglón "Descuento" del remito), para no cambiar cuentas ya registradas. Si más adelante quieren que el sistema también lo rechace, es un cambio de backend aparte (decisión del autor).
- **b) Fecha del remito:** el casillero FECHA muestra el **día en que se abrió la ficha** (el del primer producto que se llevó el cliente, que es de donde sale el plazo de un mes). Por eso siempre queda antes del vencimiento del pie. Cada ficha (pendiente o pagada) lleva su propia fecha. Con ficha **no se escribe a mano** (casilleros de solo lectura); un cliente sin ficha ve la fecha de hoy, que sí se puede cambiar (no se guarda).
- **c) Los buscadores muestran las coincidencias debajo (corrección del autor):** en Ventas (productos y clientes) y en Inventario (filtro del historial y formulario de movimiento), al escribir en la lupa aparece **una lista debajo con todo lo que coincide** (por ejemplo, todas las "Ana"); se toca una y queda elegida (el producto se agrega al carrito, el cliente o producto se selecciona) y la búsqueda se limpia. Escape o borrar lo escrito cierra la lista; si nada coincide lo dice; un producto sin stock se ve pero no se puede agregar. **El desplegable ya no se filtra**: siempre trae todos. El orden en pantalla es **desplegable a la izquierda y lupa a la derecha**. Enter en el buscador de productos de Ventas sigue agregando el único producto con stock que queda. Los buscadores de las listas de Productos y de Clientes siguen filtrando la tabla directamente.
- **d) Ojito en el login:** al lado de la contraseña hay un botón para mostrarla u ocultarla (por defecto está oculta). No envía el formulario ni cambia lo escrito.
- **e) El remito y el historial no muestran descuentos (corrección del autor):** se sacó la línea "Descuento" del remito y el "desc." del historial de Ventas. El TOTAL del remito sigue siendo el que calcula el servidor. **El seed ya no crea ventas con descuento** (antes el 30% de las ventas con cliente lo llevaban, y por eso aparecía en los remitos de prueba). Para ver los datos de prueba sin descuentos hay que **vaciar la base de desarrollo y volver a cargar el seed**: si solo se ocultara la línea, las fichas viejas con descuento mostrarían un TOTAL menor a la suma de sus artículos. La API sigue aceptando el campo `discount` (opcional, por defecto 0) y la base conserva la columna; si se quiere eliminarlos del todo es un cambio de backend aparte, con su migración y decisión del autor.
