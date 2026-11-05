import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import SalesPage from './SalesPage'

const producto = (id: number, name: string, salePrice: string, stock: number) => ({
  id,
  name,
  categoryId: 1,
  category: { id: 1, name: 'Papelería' },
  salePrice,
  minStock: 2,
  active: true,
  stock,
  lowStock: false,
})
const cuaderno = producto(10, 'Cuaderno A4', '1500.50', 8)
const lapiz = producto(11, 'Lápiz negro', '300.25', 20)
const agotado = producto(12, 'Goma', '100.00', 0)

const venta = (id: number, extra: object = {}) => ({
  id,
  status: 'CONFIRMED',
  paymentMethod: 'CASH',
  onCredit: false,
  customer: null,
  accountId: null,
  subtotal: '3001.00',
  discount: '0.00',
  total: '3001.00',
  note: null,
  userId: 1,
  userName: 'Ana Propietaria',
  createdAt: '2026-11-04T15:30:00.000Z',
  annulment: null,
  items: [{ productId: 10, productName: 'Cuaderno A4', quantity: 2, unitPrice: '1500.50', subtotal: '3001.00' }],
  ...extra,
})

const maria = { id: 5, name: 'María Gómez', creditAuthorized: true }
const pedro = { id: 6, name: 'Pedro Sosa', creditAuthorized: false }

const baseRoutes = {
  'GET /api/products': () => [cuaderno, lapiz, agotado],
  'GET /api/customers': () => [maria, pedro],
  'GET /api/sales': () => [],
}

// Agrega un producto al carrito eligiéndolo del desplegable (por su id).
async function agregar(user: ReturnType<typeof userEvent.setup>, id: number) {
  await user.selectOptions(await screen.findByLabelText('Agregar producto'), String(id))
}

describe('SalesPage – historial', () => {
  it('muestra las ventas con productos, medio de pago, total, estado y quién las registró', async () => {
    mockApi({ ...baseRoutes, 'GET /api/sales': () => [venta(7, { paymentMethod: 'TRANSFER' })] })
    render(<SalesPage />)

    const fila = (await screen.findByText('#7')).closest('tr')!
    expect(within(fila).getByText('2 × Cuaderno A4')).toBeInTheDocument()
    expect(within(fila).getByText('Transferencia')).toBeInTheDocument()
    expect(fila).toHaveTextContent(/\$\s?3\.001,00/)
    expect(within(fila).getByText('Confirmada')).toBeInTheDocument()
    expect(within(fila).getByText('Ana Propietaria')).toBeInTheDocument()
  })

  it('una venta anulada muestra "Anulada" con el motivo y quién la anuló, y no tiene botón Anular', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/sales': () => [
        venta(8, {
          status: 'ANNULLED',
          annulment: { at: '2026-11-04T16:00:00.000Z', byId: 1, byName: 'Ana Propietaria', reason: 'Cargué mal el producto' },
        }),
      ],
    })
    render(<SalesPage />)

    const fila = (await screen.findByText('#8')).closest('tr')!
    expect(within(fila).getByText('Anulada')).toBeInTheDocument()
    expect(fila).toHaveTextContent('Cargué mal el producto')
    expect(fila).toHaveTextContent('Ana Propietaria')
    expect(within(fila).queryByRole('button', { name: /Anular venta/ })).not.toBeInTheDocument()
  })

  it('muestra un mensaje si todavía no hay ventas', async () => {
    mockApi(baseRoutes)
    render(<SalesPage />)

    expect(await screen.findByText('Todavía no hay ventas.')).toBeInTheDocument()
  })

  it('muestra el error si no se puede cargar el historial', async () => {
    mockApi({ ...baseRoutes, 'GET /api/sales': () => Response.json({ error: 'Falló la base' }, { status: 500 }) })
    render(<SalesPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la base')
  })

  it('filtra el historial por estado', async () => {
    const { calls } = mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await screen.findByText('Todavía no hay ventas.')
    expect(calls.find((c) => c.path === '/api/sales')?.query.has('status')).toBe(false)

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Anuladas')

    await waitFor(() => expect(calls.filter((c) => c.path === '/api/sales').at(-1)!.query.get('status')).toBe('ANNULLED'))
  })
})

describe('SalesPage – nueva venta', () => {
  it('ofrece los productos activos con su precio y stock, y no deja elegir los que no tienen stock', async () => {
    const { calls } = mockApi(baseRoutes)
    render(<SalesPage />)

    const opcion = await screen.findByRole('option', { name: /Cuaderno A4 .* \(stock 8\)/ })
    expect(opcion).toHaveTextContent(/\$\s?1\.500,50/)
    expect(screen.getByRole('option', { name: /Goma .* \(stock 0\)/ })).toBeDisabled()
    expect(calls.find((c) => c.path === '/api/products')?.query.get('active')).toBe('true')
  })

  it('arranca sin productos y con "Confirmar venta" deshabilitado', async () => {
    mockApi(baseRoutes)
    render(<SalesPage />)

    expect(await screen.findByText('Todavía no agregaste productos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
  })

  it('al agregar productos arma el carrito con subtotales y el total exacto', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)

    await agregar(user, 10)
    await agregar(user, 11)
    await user.clear(screen.getByLabelText('Cantidad de Cuaderno A4'))
    await user.type(screen.getByLabelText('Cantidad de Cuaderno A4'), '3')
    await user.clear(screen.getByLabelText('Cantidad de Lápiz negro'))
    await user.type(screen.getByLabelText('Cantidad de Lápiz negro'), '3')

    // 3 × 1500,50 + 3 × 300,25 = 4501,50 + 900,75 = 5402,25
    expect(screen.getByTestId('cart-total')).toHaveTextContent(/\$\s?5\.402,25/)
    expect(screen.getByLabelText('Cantidad de Cuaderno A4').closest('tr')).toHaveTextContent(/\$\s?4\.501,50/)
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled()
  })

  it('agregar el mismo producto otra vez suma una unidad en lugar de repetir la fila', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)

    await agregar(user, 10)
    await agregar(user, 10)

    expect(screen.getByLabelText('Cantidad de Cuaderno A4')).toHaveValue(2)
    expect(screen.getAllByLabelText(/Cantidad de/)).toHaveLength(1)
  })

  it('se puede quitar un producto del carrito', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)

    await user.click(screen.getByRole('button', { name: 'Quitar Cuaderno A4' }))

    expect(screen.getByText('Todavía no agregaste productos.')).toBeInTheDocument()
    expect(screen.getByTestId('cart-total')).toHaveTextContent(/\$\s?0,00/)
  })

  it('confirma la venta: manda medio de pago y cantidades (nunca el precio), vacía el carrito y recarga todo', async () => {
    let ventas: object[] = []
    const { calls } = mockApi({
      'GET /api/products': () => [cuaderno, lapiz],
      'GET /api/customers': () => [],
      'GET /api/sales': () => ventas,
      'POST /api/sales': () => {
        ventas = [venta(21)]
        return venta(21)
      },
    })
    const user = userEvent.setup()
    render(<SalesPage />)

    await agregar(user, 10)
    await user.clear(screen.getByLabelText('Cantidad de Cuaderno A4'))
    await user.type(screen.getByLabelText('Cantidad de Cuaderno A4'), '2')
    await user.selectOptions(screen.getByLabelText('Medio de pago'), 'Tarjeta')
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }))

    expect(await screen.findByText(/Venta #21 registrada por/)).toHaveTextContent(/\$\s?3\.001,00/)
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      paymentMethod: 'CARD',
      items: [{ productId: 10, quantity: 2 }],
    })
    expect(screen.getByText('Todavía no agregaste productos.')).toBeInTheDocument()
    expect(await screen.findByText('#21')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/api/products')).toHaveLength(2)
  })

  it('el medio de pago por defecto es efectivo y se ofrecen los cuatro', async () => {
    mockApi(baseRoutes)
    render(<SalesPage />)

    const pago = await screen.findByLabelText('Medio de pago')
    expect(pago).toHaveValue('CASH')
    expect(within(pago).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Efectivo',
      'Transferencia',
      'Tarjeta',
      'Billetera virtual',
    ])
  })

  it('si la API rechaza la venta (sin stock) muestra su mensaje y conserva el carrito', async () => {
    mockApi({
      ...baseRoutes,
      'POST /api/sales': () =>
        Response.json({ error: 'No hay stock suficiente de "Cuaderno A4" (stock actual: 1)' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)

    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('stock actual: 1')
    expect(screen.getByLabelText('Cantidad de Cuaderno A4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeEnabled()
  })
})

describe('SalesPage – buscar producto por nombre', () => {
  const opciones = () => within(screen.getByLabelText('Agregar producto')).getAllByRole('option').map((o) => o.textContent)

  it('tiene un buscador con lupa además del desplegable, que sigue funcionando', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)

    expect(await screen.findByRole('searchbox', { name: 'Buscar producto por nombre' })).toBeInTheDocument()
    await agregar(user, 10)

    expect(screen.getByRole('button', { name: 'Quitar Cuaderno A4' })).toBeInTheDocument()
  })

  it('al escribir deja en el desplegable solo los productos que coinciden, sin importar tildes ni mayúsculas', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await screen.findByRole('option', { name: /Lápiz negro/ })

    await user.type(screen.getByRole('searchbox', { name: 'Buscar producto por nombre' }), 'LAPIZ')

    expect(opciones()).toEqual(['Agregar producto…', expect.stringContaining('Lápiz negro')])
  })

  it('borrar lo escrito vuelve a mostrar todos', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    const buscador = await screen.findByRole('searchbox', { name: 'Buscar producto por nombre' })

    await user.type(buscador, 'lap')
    await user.clear(buscador)

    expect(opciones()).toHaveLength(1 + 3)
  })

  it('sin coincidencias lo dice en el desplegable', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)

    await user.type(await screen.findByRole('searchbox', { name: 'Buscar producto por nombre' }), 'zzz')

    expect(opciones()).toEqual(['Ningún producto coincide'])
  })

  it('sin productos cargados y sin escribir nada el desplegable sigue pidiendo agregar un producto', async () => {
    mockApi({ ...baseRoutes, 'GET /api/products': () => [] })
    render(<SalesPage />)

    expect(await screen.findByRole('option', { name: 'Agregar producto…' })).toBeInTheDocument()
  })

  it('Enter agrega el único producto que queda, limpia la búsqueda y no envía la venta', async () => {
    const { calls } = mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    const buscador = await screen.findByRole('searchbox', { name: 'Buscar producto por nombre' })
    await screen.findByRole('option', { name: /Lápiz negro/ })

    await user.type(buscador, 'lapiz{Enter}')

    expect(screen.getByRole('button', { name: 'Quitar Lápiz negro' })).toBeInTheDocument()
    expect(buscador).toHaveValue('')
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('Enter en el buscador no confirma la venta aunque el carrito ya tenga productos', async () => {
    const { calls } = mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)

    await user.type(screen.getByRole('searchbox', { name: 'Buscar producto por nombre' }), 'zzz{Enter}')

    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('Enter con varios resultados no agrega nada', async () => {
    mockApi({ ...baseRoutes, 'GET /api/products': () => [cuaderno, producto(13, 'Cuaderno A5', '900.00', 4)] })
    const user = userEvent.setup()
    render(<SalesPage />)
    await screen.findByRole('option', { name: /Cuaderno A5/ })

    await user.type(screen.getByRole('searchbox', { name: 'Buscar producto por nombre' }), 'cuaderno{Enter}')

    expect(screen.queryByRole('button', { name: /^Quitar/ })).not.toBeInTheDocument()
  })

  it('Enter no agrega un producto sin stock', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await screen.findByRole('option', { name: /Goma/ })

    await user.type(screen.getByRole('searchbox', { name: 'Buscar producto por nombre' }), 'goma{Enter}')

    expect(screen.queryByRole('button', { name: /^Quitar/ })).not.toBeInTheDocument()
  })

  it('agregar el mismo producto otra vez suma una unidad', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    const buscador = await screen.findByRole('searchbox', { name: 'Buscar producto por nombre' })
    await screen.findByRole('option', { name: /Lápiz negro/ })

    await user.type(buscador, 'lapiz{Enter}')
    await user.type(buscador, 'lapiz{Enter}')

    expect(screen.getByLabelText('Cantidad de Lápiz negro')).toHaveValue(2)
  })
})

describe('SalesPage – anular', () => {
  const unaVenta = { ...baseRoutes, 'GET /api/sales': () => [venta(7)] }

  async function abrirAnulacion() {
    const user = userEvent.setup()
    render(<SalesPage />)
    await user.click(await screen.findByRole('button', { name: 'Anular venta 7' }))
    return user
  }

  it('pide un motivo, anula la venta y recarga el historial y el stock', async () => {
    let anulada = false
    const { calls } = mockApi({
      'GET /api/products': () => [cuaderno],
      'GET /api/customers': () => [],
      'GET /api/sales': () =>
        anulada
          ? [venta(7, { status: 'ANNULLED', annulment: { at: '2026-11-04T16:00:00.000Z', byId: 1, byName: 'Ana Propietaria', reason: 'Error de carga' } })]
          : [venta(7)],
      'POST /api/sales/7/annul': () => {
        anulada = true
        return venta(7)
      },
    })
    const user = userEvent.setup()
    render(<SalesPage />)
    await user.click(await screen.findByRole('button', { name: 'Anular venta 7' }))

    await user.type(screen.getByLabelText('Motivo de la anulación'), 'Error de carga')
    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(await screen.findByText('Anulada')).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/api/sales/7/annul')!.body).toEqual({ reason: 'Error de carga' })
    expect(calls.filter((c) => c.path === '/api/products')).toHaveLength(2)
  })

  it('muestra el error de la API (por ejemplo, sin motivo) y deja el campo abierto', async () => {
    mockApi({
      ...unaVenta,
      'POST /api/sales/7/annul': () => Response.json({ error: 'El motivo de la anulación es obligatorio' }, { status: 400 }),
    })
    const user = await abrirAnulacion()

    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El motivo de la anulación es obligatorio')
    expect(screen.getByLabelText('Motivo de la anulación')).toBeInTheDocument()
  })

  it('"Cancelar" cierra el campo sin anular nada', async () => {
    const { calls } = mockApi(unaVenta)
    const user = await abrirAnulacion()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Motivo de la anulación')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anular venta 7' })).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })
})

describe('SalesPage – venta completa', () => {
  it('ofrece solo los clientes activos que trae la API y marca los autorizados a crédito', async () => {
    const { calls } = mockApi(baseRoutes)
    render(<SalesPage />)

    expect(await screen.findByRole('option', { name: 'María Gómez (crédito autorizado)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pedro Sosa' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Sin cliente' })).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/api/customers')?.query.get('active')).toBe('true')
  })

  it('ya no hay campo de descuento: el total es la suma de los productos', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)

    expect(screen.queryByLabelText(/Descuento/)).not.toBeInTheDocument()
    expect(screen.getByTestId('cart-total')).toHaveTextContent(/\$\s?1\.500,50/)
  })

  it('la lupa filtra la lista de clientes por nombre (sin tildes ni mayúsculas) y conserva el elegido', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await screen.findByRole('option', { name: 'Pedro Sosa' })

    await user.type(screen.getByLabelText('Buscar cliente por nombre'), 'GOMEZ')
    expect(screen.getByRole('option', { name: 'María Gómez (crédito autorizado)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Pedro Sosa' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'María Gómez (crédito autorizado)')
    await user.clear(screen.getByLabelText('Buscar cliente por nombre'))
    await user.type(screen.getByLabelText('Buscar cliente por nombre'), 'pedro')
    expect(screen.getByLabelText('Cliente (opcional)')).toHaveValue('5') // el elegido no desaparece
    expect(screen.getByRole('option', { name: 'Pedro Sosa' })).toBeInTheDocument()
  })

  it('si ningún cliente coincide lo avisa en la lista', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    await screen.findByRole('option', { name: 'Pedro Sosa' })

    await user.type(screen.getByLabelText('Buscar cliente por nombre'), 'zzz')

    expect(screen.getByRole('option', { name: 'Ningún cliente coincide' })).toBeInTheDocument()
  })

  it('manda cliente y nota; no manda lo que quedó vacío', async () => {
    const { calls } = mockApi({ ...baseRoutes, 'POST /api/sales': () => venta(30) })
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)

    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'María Gómez (crédito autorizado)')
    await user.type(screen.getByLabelText('Nota (opcional)'), '  Pedido especial  ')
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }))

    await screen.findByText(/Venta #30 registrada/)
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      paymentMethod: 'CASH',
      customerId: 5,
      note: 'Pedido especial',
      items: [{ productId: 10, quantity: 1 }],
    })
  })

  it('después de registrar la venta limpia cliente, búsqueda, nota y crédito para la siguiente', async () => {
    mockApi({ ...baseRoutes, 'POST /api/sales': () => venta(33) })
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)
    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'María Gómez (crédito autorizado)')
    await user.type(screen.getByLabelText('Buscar cliente por nombre'), 'gomez')
    await user.type(screen.getByLabelText('Nota (opcional)'), 'Algo')
    await user.click(screen.getByLabelText(/Venta a crédito/))
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    await screen.findByText(/Venta #33 registrada/)

    expect(screen.getByLabelText('Cliente (opcional)')).toHaveValue('')
    expect(screen.getByLabelText('Buscar cliente por nombre')).toHaveValue('')
    expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('')
    expect(screen.getByLabelText(/Venta a crédito/)).not.toBeChecked()
    expect(screen.getByLabelText('Medio de pago')).toBeInTheDocument()
  })

  it('la venta rápida no manda cliente ni nota', async () => {
    const { calls } = mockApi({ ...baseRoutes, 'POST /api/sales': () => venta(31) })
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }))

    await screen.findByText(/Venta #31 registrada/)
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ paymentMethod: 'CASH', items: [{ productId: 10, quantity: 1 }] })
  })

  it('"a crédito" solo se habilita con un cliente autorizado', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<SalesPage />)
    const credito = await screen.findByLabelText(/Venta a crédito/)
    expect(credito).toBeDisabled() // sin cliente

    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'Pedro Sosa')
    expect(credito).toBeDisabled() // cliente sin crédito

    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'María Gómez (crédito autorizado)')
    expect(credito).toBeEnabled()
  })

  it('a crédito oculta el medio de pago y no lo manda; al cambiar a un cliente sin crédito se destilda', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      'POST /api/sales': () => venta(32, { paymentMethod: null, onCredit: true, accountId: 3, customer: { id: 5, name: 'María Gómez' } }),
    })
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)
    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'María Gómez (crédito autorizado)')

    await user.click(screen.getByLabelText(/Venta a crédito/))
    expect(screen.queryByLabelText('Medio de pago')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'Pedro Sosa')
    expect(screen.getByLabelText(/Venta a crédito/)).not.toBeChecked()
    expect(screen.getByLabelText('Medio de pago')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'María Gómez (crédito autorizado)')
    await user.click(screen.getByLabelText(/Venta a crédito/))
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }))

    expect(await screen.findByText(/a crédito, suma a la cuenta corriente/)).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      onCredit: true,
      customerId: 5,
      items: [{ productId: 10, quantity: 1 }],
    })
  })

  it('si la API rechaza la venta muestra su mensaje y conserva cliente, nota y productos', async () => {
    mockApi({
      ...baseRoutes,
      'POST /api/sales': () => Response.json({ error: 'No hay stock suficiente de Cuaderno A4' }, { status: 400 }),
    })
    const user = userEvent.setup()
    render(<SalesPage />)
    await agregar(user, 10)
    await user.selectOptions(screen.getByLabelText('Cliente (opcional)'), 'Pedro Sosa')
    await user.type(screen.getByLabelText('Nota (opcional)'), 'Pedido especial')
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay stock suficiente de Cuaderno A4')
    expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('Pedido especial')
    expect(screen.getByLabelText('Cliente (opcional)')).toHaveValue('6')
    expect(screen.getByLabelText('Cantidad de Cuaderno A4')).toBeInTheDocument()
  })

  it('el historial muestra cliente, nota, descuento y "A crédito" cuando no hay medio de pago', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/sales': () => [
        venta(40, {
          paymentMethod: null,
          onCredit: true,
          accountId: 3,
          customer: { id: 5, name: 'María Gómez' },
          note: 'Pedido escolar',
          discount: '500.00',
          total: '2501.00',
        }),
        venta(41),
      ],
    })
    render(<SalesPage />)

    const credito = (await screen.findByText('#40')).closest('tr')!
    expect(within(credito).getByText('María Gómez')).toBeInTheDocument()
    expect(within(credito).getByText('A crédito')).toBeInTheDocument()
    expect(within(credito).getByText('Nota: Pedido escolar')).toBeInTheDocument()
    expect(credito).toHaveTextContent(/desc\. \$\s?500,00/)
    expect(credito).toHaveTextContent(/\$\s?2\.501,00/)

    const comun = screen.getByText('#41').closest('tr')!
    expect(within(comun).getByText('—')).toBeInTheDocument()
    expect(comun).not.toHaveTextContent('desc.')
    expect(comun).not.toHaveTextContent('Nota:')
  })
})
