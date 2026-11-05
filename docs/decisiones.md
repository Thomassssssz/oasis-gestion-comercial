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

- **a) Cómo se carga:** `npm run db:seed -- <usuario>`. Pasa por los **mismos servicios** que usa la API (productos, clientes, ventas, cuentas corrientes), no escribe las tablas a mano: así se cumplen las reglas de negocio (stock, descuento, fichas, vencimiento, recargos) y los datos quedan coherentes. Solo el stock inicial y la fecha de los movimientos de stock de cada venta se escriben directo, porque la API los fecha con la hora actual.
- **b) Actividad simulada:** unos 75 días hacia atrás, día por día, con un reloj que avanza (horario comercial de 9 a 20 hs de Argentina). Más ventas los días hábiles y menos los domingos; unos productos se venden mucho más que otros; ventas con cliente y descuento; ventas a crédito; pagos parciales y totales; clientes "que se atrasan" para que haya fichas vencidas; recargos registrados en parte de ellas; algunas ventas anuladas; unos productos y clientes dados de baja. Las operaciones que las reglas rechazan (por ejemplo, sin stock) se saltean.
- **c) Repetible:** usa un generador de números al azar con semilla, así que dos personas obtienen los mismos datos.
- **d) Protecciones:** se niega a correr si la base ya tiene productos, clientes, categorías o ventas (no mezcla datos de prueba con datos cargados por alguien), y no corre con `NODE_ENV=production`.
- **e) Datos ficticios:** los DNI empiezan con 98 y los clientes llevan la nota "Dato de prueba (seed)". Los precios son inventados, redondeados a múltiplos de 50 pesos. Los teléfonos tienen formato de Formosa pero son al azar: podrían coincidir con uno real, no se deben usar para contactar a nadie.
- **f) Auditoría:** no genera anotaciones, porque no pasa por la API (el middleware de D20 vive en las rutas). La pantalla Auditoría arranca vacía hasta que se haga una operación desde la app.

