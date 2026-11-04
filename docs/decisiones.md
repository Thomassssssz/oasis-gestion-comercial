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
