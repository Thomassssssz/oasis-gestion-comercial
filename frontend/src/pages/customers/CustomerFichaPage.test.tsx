import { render as baseRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi } from '@/test/mock-api'
import CustomerFichaPage from './CustomerFichaPage'

const maria = {
  id: 5,
  name: 'María Gómez',
  phone: '370 4123456',
  dni: '30123456',
  address: 'España 123',
  notes: 'Paga los viernes',
  creditAuthorized: true,
  active: true,
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
}

const lineas = [
  { productName: 'Cuaderno rayado', quantity: 3, unitPrice: '100.00', subtotal: '300.00' },
  { productName: 'Lapicera azul', quantity: 2, unitPrice: '25.00', subtotal: '50.00' },
]

const ficha = (id: number, extra: object = {}) => ({
  id,
  customer: { id: 5, name: 'María Gómez' },
  status: 'OPEN',
  openedAt: '2026-03-10T15:00:00.000Z',
  dueDate: '2026-04-10T15:00:00.000Z',
  closedAt: null,
  balance: '450.00',
  pendingSurchargesTotal: '0.00',
  payable: '450.00',
  overdue: false,
  monthsOverdue: 0,
  pendingSurcharges: [],
  surcharges: [],
  payments: [],
  sales: [
    { id: 1, status: 'CONFIRMED', createdAt: '2026-03-10T15:00:00.000Z', note: null, discount: '0.00', total: '350.00', items: lineas },
    {
      id: 2,
      status: 'CONFIRMED',
      createdAt: '2026-03-12T15:00:00.000Z',
      note: null,
      discount: '10.00',
      total: '100.00',
      items: [{ productName: 'Carpeta', quantity: 1, unitPrice: '110.00', subtotal: '110.00' }],
    },
  ],
  ...extra,
})

const vencida = (extra: object = {}) =>
  ficha(3, {
    balance: '1000.00',
    pendingSurchargesTotal: '50.00',
    payable: '1050.00',
    overdue: true,
    monthsOverdue: 1,
    pendingSurcharges: [{ monthNumber: 1, base: '1000.00', percent: '5.00', amount: '50.00', chargedOn: '2026-05-10T15:00:00.000Z' }],
    ...extra,
  })

const cancelada = (extra: object = {}) =>
  ficha(9, { status: 'CANCELLED', closedAt: '2026-03-20T10:00:00.000Z', balance: '0.00', payable: '0.00', ...extra })

const render = (path = '/clientes/5') =>
  baseRender(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/clientes" element={<p>Lista de clientes</p>} />
        <Route path="/clientes/:id" element={<CustomerFichaPage />} />
      </Routes>
    </MemoryRouter>,
  )

const api = (accounts: object[], extra: Record<string, () => unknown> = {}, cashSales: object[] = []) =>
  mockApi({
    'GET /api/customers/5': () => maria,
    'GET /api/accounts': () => accounts,
    'GET /api/sales': () => cashSales,
    ...extra,
  })

afterEach(() => vi.restoreAllMocks())

describe('CustomerFichaPage: datos del cliente', () => {
  it('muestra los datos del cliente: en el remito su nombre y domicilio, y aparte DNI, teléfono, crédito y observaciones', async () => {
    api([])
    render()

    expect(await screen.findByRole('heading', { name: 'María Gómez' })).toBeInTheDocument()
    const remito = screen.getByTestId('remito')
    expect(within(remito).getByText('María Gómez')).toBeInTheDocument()
    expect(within(remito).getByText('España 123')).toBeInTheDocument()
    expect(screen.getByText('30123456')).toBeInTheDocument()
    expect(screen.getByText('370 4123456')).toBeInTheDocument()
    expect(screen.getByText('Autorizado a comprar a cuenta corriente')).toBeInTheDocument()
    expect(screen.getByText('Paga los viernes')).toBeInTheDocument()
  })

  it('un cliente sin crédito figura como "Solo contado", sin observaciones, y avisa que no puede tener ficha', async () => {
    mockApi({
      'GET /api/customers/5': () => ({ ...maria, creditAuthorized: false, dni: null, address: null, phone: null, notes: null }),
      'GET /api/accounts': () => [],
      'GET /api/sales': () => [],
    })
    render()

    await screen.findByRole('heading', { name: 'María Gómez' })
    expect(screen.getByText('Solo contado')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2) // DNI y teléfono
    expect(screen.queryByText('Observaciones:')).not.toBeInTheDocument()
    expect(screen.getByText(/no está autorizado a comprar a crédito/)).toBeInTheDocument()
  })

  it('pide el cliente, sus fichas y sus compras de contado confirmadas', async () => {
    const { calls } = api([])
    render()

    await screen.findByRole('heading', { name: 'María Gómez' })
    expect(calls.find((c) => c.path === '/api/accounts')!.query.get('customerId')).toBe('5')
    const ventas = calls.find((c) => c.path === '/api/sales')!.query
    expect([ventas.get('customerId'), ventas.get('onCredit'), ventas.get('status')]).toEqual(['5', 'false', 'CONFIRMED'])
  })

  it('un cliente que no existe muestra el mensaje de la API y el enlace para volver', async () => {
    mockApi({
      'GET /api/customers/99': () => Response.json({ error: 'El cliente no existe' }, { status: 404 }),
      'GET /api/accounts': () => [],
      'GET /api/sales': () => [],
    })
    render('/clientes/99')

    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente no existe')
    expect(screen.getByRole('link', { name: /Volver a Clientes/ })).toHaveAttribute('href', '/clientes')
  })

  it('"Volver a Clientes" lleva a la lista', async () => {
    api([])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('link', { name: /Volver a Clientes/ }))

    expect(screen.getByText('Lista de clientes')).toBeInTheDocument()
  })

  it('"Imprimir" abre la impresión del navegador', async () => {
    api([])
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Imprimir' }))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('"Editar datos" abre el formulario con los datos y al guardar recarga la ficha', async () => {
    let nombre = maria.name
    const { calls } = mockApi({
      'GET /api/customers/5': () => ({ ...maria, name: nombre }),
      'GET /api/accounts': () => [],
      'GET /api/sales': () => [],
      'PUT /api/customers/5': ({ body }) => {
        nombre = (body as { name: string }).name
        return { ...maria, name: nombre }
      },
    })
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Editar datos' }))
    expect(screen.getByRole('button', { name: 'Editar datos' })).toBeDisabled()
    const campo = screen.getByLabelText('Nombre')
    expect(campo).toHaveValue('María Gómez')
    await user.clear(campo)
    await user.type(campo, 'María Gómez de Pérez')
    await user.click(screen.getByRole('button', { name: /Guardar/ }))

    expect(await screen.findByRole('heading', { name: 'María Gómez de Pérez' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument() // el formulario se cierra
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/customers/5')).toHaveLength(2)
  })

  it('"Cancelar" cierra el formulario de edición', async () => {
    api([])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Editar datos' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar datos' })).toBeEnabled()
  })
})

describe('CustomerFichaPage: ficha de cuenta corriente', () => {
  it('sin ficha abierta lo dice', async () => {
    api([])
    render()

    expect(await screen.findByText(/No tiene una ficha abierta. Se abre con la primera venta a crédito./)).toBeInTheDocument()
  })

  it('el remito tilda "Cuenta Corriente" solo si hay una ficha abierta', async () => {
    api([ficha(3)])
    const { unmount } = render()
    expect(await screen.findByRole('img', { name: 'Cuenta Corriente: tildado' })).toBeInTheDocument()
    unmount()

    api([])
    render()
    expect(await screen.findByRole('img', { name: 'Cuenta Corriente: sin tildar' })).toBeInTheDocument()
  })

  it('sin ficha abierta igual muestra el remito con la grilla vacía, listo para imprimir en blanco', async () => {
    api([])
    render()

    const remito = await screen.findByTestId('remito')
    expect(within(remito).getAllByRole('row', { hidden: true })).toHaveLength(13)
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?0,00/)
  })

  it('muestra los artículos con cantidad, detalle, precio unitario y total de cada línea', async () => {
    api([ficha(3)])
    render()

    const fila = (await screen.findByText('Cuaderno rayado')).closest('tr')!
    expect(within(fila).getByText('3')).toBeInTheDocument()
    expect(fila).toHaveTextContent(/\$\s?100,00/)
    expect(fila).toHaveTextContent(/\$\s?300,00/)
    const otra = screen.getByText('Lapicera azul').closest('tr')!
    expect(otra).toHaveTextContent(/\$\s?25,00/)
    expect(otra).toHaveTextContent(/\$\s?50,00/)
  })

  it('el descuento va en su propia línea y el TOTAL del remito lo descuenta', async () => {
    api([ficha(3)])
    render()

    const descuento = (await screen.findByText('Descuento')).closest('tr')!
    expect(descuento).toHaveTextContent(/−\s*\$\s?10,00/)
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?450,00/) // 350 + 100
  })

  it('una venta anulada no figura en el remito ni suma al total, pero se avisa aparte', async () => {
    api([
      ficha(3, {
        sales: [
          { id: 1, status: 'CONFIRMED', createdAt: '2026-03-10T15:00:00.000Z', note: null, discount: '0.00', total: '350.00', items: lineas },
          { id: 2, status: 'ANNULLED', createdAt: '2026-03-12T15:00:00.000Z', note: null, discount: '0.00', total: '110.00', items: [{ productName: 'Carpeta', quantity: 1, unitPrice: '110.00', subtotal: '110.00' }] },
        ],
      }),
    ])
    render()

    await screen.findByText('Cuaderno rayado')
    expect(within(screen.getByTestId('remito')).queryByText('Carpeta')).not.toBeInTheDocument()
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?350,00/)
    expect(screen.getByText(/Ventas anuladas \(no figuran en el remito\)/)).toHaveTextContent(/#2 del 12\/3\/26 por \$\s?110,00/)
  })

  it('sin ventas anuladas no muestra ese aviso', async () => {
    api([ficha(3)])
    render()

    await screen.findByText('Cuaderno rayado')
    expect(screen.queryByText(/Ventas anuladas/)).not.toBeInTheDocument()
  })

  it('muestra desde cuándo, el vencimiento y "Al día"', async () => {
    api([ficha(3)])
    render()

    expect(await screen.findByText('Al día')).toBeInTheDocument()
    expect(screen.getByText(/Desde/)).toHaveTextContent('10/3/26')
    expect(screen.getByText(/Vence/)).toHaveTextContent('10/4/26')
  })

  it('marca la ficha vencida y cuenta los meses de atraso', async () => {
    api([vencida({ monthsOverdue: 2 })])
    render()

    expect(await screen.findByText('Vencida (2 meses)')).toBeInTheDocument()
  })

  it('con un mes de atraso dice "1 mes" y sin un mes completo dice solo "Vencida"', async () => {
    api([vencida({ monthsOverdue: 1 })])
    render()
    expect(await screen.findByText('Vencida (1 mes)')).toBeInTheDocument()
  })

  it('sin un mes completo de atraso dice solo "Vencida"', async () => {
    api([vencida({ monthsOverdue: 0 })])
    render()

    expect(await screen.findByText('Vencida')).toBeInTheDocument()
  })

  it('muestra el saldo, los recargos que ya corresponden y lo que hay que pagar hoy', async () => {
    api([vencida()])
    render()

    const saldo = (await screen.findByText('Saldo')).closest('dl')!
    expect(saldo).toHaveTextContent(/Saldo\s*\$\s?1\.000,00/)
    expect(saldo).toHaveTextContent(/Recargos que ya corresponden\s*\+\s*\$\s?50,00/)
    expect(saldo).toHaveTextContent(/A pagar hoy\s*\$\s?1\.050,00/)
  })

  it('sin recargos pendientes no hay línea de recargos en el resumen', async () => {
    api([ficha(3)])
    render()

    const saldo = (await screen.findByText('Saldo')).closest('dl')!
    expect(saldo).not.toHaveTextContent('Recargos que ya corresponden')
    expect(saldo).toHaveTextContent(/A pagar hoy\s*\$\s?450,00/)
  })

  it('muestra los pagos y los recargos registrados con su base y porcentaje', async () => {
    api([
      ficha(3, {
        payments: [{ id: 7, amount: '100.00', paymentMethod: 'TRANSFER', note: 'Seña', createdAt: '2026-03-15T15:00:00.000Z', userName: 'Ana Propietaria' }],
        surcharges: [{ monthNumber: 1, base: '450.00', percent: '5.00', amount: '22.50', chargedOn: '2026-05-10T15:00:00.000Z', registeredAt: '2026-05-11T15:00:00.000Z' }],
      }),
    ])
    render()

    const pago = await screen.findByText(/Transferencia/, { selector: 'li' })
    expect(pago).toHaveTextContent(/\$\s?100,00/)
    expect(pago).toHaveTextContent('Ana Propietaria')
    expect(pago).toHaveTextContent('Seña')
    const recargo = screen.getByText(/Mes 1 de atraso/).closest('li')!
    expect(recargo).toHaveTextContent(/\$\s?22,50 = 5% de \$\s?450,00/)
  })

  it('sin pagos dice que todavía no hay y sin recargos registrados no muestra esa sección', async () => {
    api([ficha(3)])
    render()

    expect(await screen.findByText('Todavía no hay pagos.')).toBeInTheDocument()
    expect(screen.queryByText('Recargos por mora registrados')).not.toBeInTheDocument()
  })
})

describe('CustomerFichaPage: pagos y recargos', () => {
  it('muestra los recargos pendientes y los aplica con el botón, avisando y recargando', async () => {
    let aplicado = false
    const { calls } = mockApi({
      'GET /api/customers/5': () => maria,
      'GET /api/accounts': () => [aplicado ? ficha(3, { balance: '1050.00', payable: '1050.00', overdue: true }) : vencida()],
      'GET /api/sales': () => [],
      'POST /api/accounts/3/surcharges': () => {
        aplicado = true
        return ficha(3)
      },
    })
    const user = userEvent.setup()
    render()

    expect(await screen.findByText('Recargos que ya corresponden (todavía sin registrar)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aplicar recargos' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Recargos registrados')
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/accounts/3/surcharges')).toBe(true)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument())
  })

  it('sin recargos pendientes no ofrece "Aplicar recargos"', async () => {
    api([ficha(3)])
    render()

    await screen.findByText('Al día')
    expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument()
  })

  it('registra un pago: manda importe con punto, medio de pago y nota; avisa y recarga', async () => {
    const { calls } = api([ficha(3)], { 'POST /api/accounts/3/payments': () => ficha(3) })
    const user = userEvent.setup()
    render()
    await screen.findByText('Al día')

    await user.type(screen.getByLabelText('Importe'), '150,5')
    await user.selectOptions(screen.getByLabelText('Medio de pago'), 'Tarjeta')
    await user.type(screen.getByLabelText('Nota (opcional)'), '  Seña  ')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Pago registrado')
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ amount: '150.5', paymentMethod: 'CARD', note: 'Seña' })
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/accounts')).toHaveLength(2))
    expect(screen.getByLabelText('Importe')).toHaveValue('')
  })

  it('"Registrar pago" está deshabilitado sin importe y no manda la nota si está vacía', async () => {
    const { calls } = api([ficha(3)], { 'POST /api/accounts/3/payments': () => ficha(3) })
    const user = userEvent.setup()
    render()
    await screen.findByText('Al día')
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()

    await user.type(screen.getByLabelText('Importe'), '10')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await screen.findByRole('status')
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ amount: '10', paymentMethod: 'CASH' })
  })

  it('informa lo que hay que pagar hoy, con recargos, y avisa que un pago parcial no cambia el vencimiento', async () => {
    api([vencida()])
    render()

    const texto = await screen.findByText(/Saldo a pagar hoy/)
    expect(texto).toHaveTextContent(/\$\s?1\.050,00/)
    expect(texto).toHaveTextContent('incluye los recargos que ya corresponden')
    expect(texto).toHaveTextContent('Un pago parcial no cambia el vencimiento')
  })

  it('si la API rechaza el pago muestra su mensaje y conserva lo escrito', async () => {
    api([ficha(3)], {
      'POST /api/accounts/3/payments': () =>
        Response.json({ error: 'El pago no puede superar el saldo de la cuenta (saldo actual: 450.00)' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render()
    await screen.findByText('Al día')

    await user.type(screen.getByLabelText('Importe'), '9999')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El pago no puede superar el saldo de la cuenta (saldo actual: 450.00)')
    expect(screen.getByLabelText('Importe')).toHaveValue('9999')
    expect(screen.queryByText('Pago registrado')).not.toBeInTheDocument()
  })

  it('después de un pago que cancela la ficha, el aviso sigue visible y la ficha pasa al historial', async () => {
    let pagado = false
    api([], {
      'GET /api/accounts': () => (pagado ? [cancelada()] : [ficha(3)]),
      'POST /api/accounts/3/payments': () => {
        pagado = true
        return cancelada()
      },
    })
    const user = userEvent.setup()
    render()
    await screen.findByText('Al día')
    await user.type(screen.getByLabelText('Importe'), '450')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText(/No tiene una ficha abierta/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pago registrado')
    expect(screen.getByText('Historial de fichas canceladas')).toBeInTheDocument()
  })
})

describe('CustomerFichaPage: historial y compras de contado', () => {
  it('las fichas canceladas van al historial, con sus artículos y sin acciones', async () => {
    api([cancelada()])
    const user = userEvent.setup()
    render()

    const resumen = await screen.findByText(/Ficha del 10\/3\/26 al 20\/3\/26/)
    await user.click(resumen)

    const detalle = resumen.closest('details')!
    expect(within(detalle).getByText('Cuaderno rayado')).toBeInTheDocument()
    expect(within(detalle).getByText(/Cancelada el/)).toHaveTextContent('20/3/26')
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument()
    expect(screen.queryByText(/A pagar hoy/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument()
  })

  it('una ficha cancelada nunca ofrece aplicar recargos, aunque la respuesta traiga pendientes', async () => {
    api([vencida({ status: 'CANCELLED', closedAt: '2026-03-20T10:00:00.000Z' })])
    render()

    await screen.findByText('Historial de fichas canceladas')
    expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Saldo a pagar hoy/)).not.toBeInTheDocument()
  })

  it('con una ficha abierta y una cancelada muestra cada una en su lugar', async () => {
    api([ficha(3), cancelada()])
    render()

    expect(await screen.findByText('Al día')).toBeInTheDocument()
    expect(screen.getByText('Historial de fichas canceladas')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Registrar pago' })).toHaveLength(1)
  })

  it('sin fichas canceladas no muestra el historial', async () => {
    api([ficha(3)])
    render()

    await screen.findByText('Al día')
    expect(screen.queryByText('Historial de fichas canceladas')).not.toBeInTheDocument()
  })

  it('las compras de contado se muestran aparte, con sus artículos y su total', async () => {
    const venta = {
      id: 40,
      status: 'CONFIRMED',
      createdAt: '2026-03-14T15:00:00.000Z',
      discount: '0.00',
      total: '75.00',
      items: [{ productName: 'Goma', quantity: 3, unitPrice: '25.00', subtotal: '75.00' }],
    }
    api([], {}, [venta])
    const user = userEvent.setup()
    render()

    const resumen = await screen.findByText('Compras de contado (1)')
    await user.click(resumen)

    const detalle = resumen.closest('details')!
    expect(within(detalle).getByText('Goma')).toBeInTheDocument()
    expect(within(detalle).getByText('Total de las compras de contado').closest('tr')).toHaveTextContent(/\$\s?75,00/)
  })

  it('sin compras de contado no muestra esa sección', async () => {
    api([ficha(3)])
    render()

    await screen.findByText('Al día')
    expect(screen.queryByText(/Compras de contado/)).not.toBeInTheDocument()
  })
})
