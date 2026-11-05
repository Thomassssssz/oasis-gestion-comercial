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
