import { render as baseRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, type MockCall } from '@/test/mock-api'
import CustomerFichaPage from './CustomerFichaPage'

const maria = {
  id: 5,
  name: 'María Gómez',
  phone: '370 4123456',
  dni: '30123456',
  address: 'España 123',
  locality: null as string | null,
  taxCondition: null as string | null,
  cuit: null as string | null,
  notes: 'Paga los viernes',
  creditAuthorized: true,
  active: true,
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
}

const comercioVacio = {
  name: null,
  owner: null,
  address: null,
  taxCondition: null,
  cuit: null,
  grossIncome: null,
  activityStart: null,
  updatedAt: '2026-03-01T12:00:00.000Z',
  updatedBy: null,
}
const comercio = {
  ...comercioVacio,
  name: 'Comercio de prueba',
  owner: 'Titular de prueba',
  address: 'Calle 1',
  taxCondition: 'EXEMPT',
  cuit: '20111111111',
  grossIncome: '123-456',
  activityStart: '03/2011',
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
  number: null,
  remitoNumber: null,
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

const api = (accounts: object[], extra: Record<string, (call: MockCall) => unknown> = {}, customer: object = maria, business: object = comercio) =>
  mockApi({
    'GET /api/customers/5': () => customer,
    'GET /api/accounts': () => accounts,
    'GET /api/settings/business': () => business,
    ...extra,
  })

const puts = (calls: MockCall[], path: string) => calls.filter((c) => c.method === 'PUT' && c.path === path)
const barra = () => screen.queryByRole('group', { name: 'Cambios sin guardar' })
const escribir = async (user: ReturnType<typeof userEvent.setup>, label: string, texto: string) => {
  const campo = screen.getByLabelText(label)
  await user.clear(campo)
  if (texto) await user.type(campo, texto)
}

afterEach(() => vi.restoreAllMocks())

describe('CustomerFichaPage: solo el remito', () => {
  it('muestra el remito con el nombre y el domicilio del cliente y el encabezado del comercio', async () => {
    api([ficha(3)])
    render()

    expect(await screen.findByLabelText('Señor/es')).toHaveValue('María Gómez')
    expect(screen.getByLabelText('Domicilio')).toHaveValue('España 123')
    expect(screen.getByLabelText('Nombre del comercio')).toHaveValue('Comercio de prueba')
    expect(screen.getByLabelText('Titular')).toHaveValue('Titular de prueba')
    expect(screen.getByLabelText('C.U.I.T. del comercio')).toHaveValue('20-11111111-1')
    expect(screen.getByLabelText('Inicio de actividades')).toHaveValue('03/2011')
    expect(screen.getByTestId('remito')).toBeInTheDocument()
  })

  it('no muestra nada más que el remito: ni formulario, ni ficha de datos, ni estado de la cuenta, ni historiales', async () => {
    api([ficha(3), cancelada()])
    render()
    await screen.findByLabelText('Señor/es')

    for (const texto of [/Editar cliente/, /Editar datos/, 'DNI:', 'Teléfono:', 'Crédito:', 'Observaciones:', 'Estado de la cuenta', /Compras de contado/, /Historial de fichas canceladas/, 'Al día', 'Pagos']) {
      expect(screen.queryByText(texto)).not.toBeInTheDocument()
    }
    expect(screen.queryByText('30123456')).not.toBeInTheDocument()
    expect(screen.queryByText('Paga los viernes')).not.toBeInTheDocument()
  })

  it('pide el cliente, sus fichas y los datos del comercio (ya no pide compras de contado)', async () => {
    const { calls } = api([ficha(3)])
    render()
    await screen.findByLabelText('Señor/es')

    expect(calls.map((c) => `${c.method} ${c.path}`).sort()).toEqual(['GET /api/accounts', 'GET /api/customers/5', 'GET /api/settings/business'])
    expect(calls.find((c) => c.path === '/api/accounts')!.query.get('customerId')).toBe('5')
  })

  it('un cliente que no existe muestra el mensaje de la API y el enlace para volver', async () => {
    api([], { 'GET /api/customers/5': () => Response.json({ error: 'El cliente no existe' }, { status: 404 }) })
    render()

    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente no existe')
    expect(screen.getByRole('link', { name: /Volver a Clientes/ })).toBeInTheDocument()
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
})

describe('CustomerFichaPage: renglones y totales', () => {
  it('el remito tilda "Cuenta Corriente" solo si hay una ficha abierta', async () => {
    api([ficha(3)])
    const { unmount } = render()
    expect(await screen.findByRole('img', { name: 'Cuenta Corriente: tildado' })).toBeInTheDocument()
    unmount()

    api([])
    render()
    expect(await screen.findByRole('img', { name: 'Cuenta Corriente: sin tildar' })).toBeInTheDocument()
  })

  it('muestra los artículos con cantidad, detalle, precio unitario y total de cada línea', async () => {
    api([ficha(3)])
    render()

    const fila = (await screen.findByText('Cuaderno rayado')).closest('tr')!
    const celdas = within(fila).getAllByRole('cell')
    expect(celdas[0]).toHaveTextContent('3')
    expect(celdas[2]).toHaveTextContent(/\$\s?100,00/)
    expect(celdas[3]).toHaveTextContent(/\$\s?300,00/)
    expect(screen.getByText('Lapicera azul')).toBeInTheDocument()
    expect(screen.getByText('Carpeta')).toBeInTheDocument()
  })

  it('el descuento va en su propia línea y el TOTAL del remito lo descuenta', async () => {
    api([ficha(3)])
    render()

    expect((await screen.findByText('Descuento')).closest('tr')).toHaveTextContent(/−\s*\$\s?10,00/)
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?450,00/) // 350 + (110 − 10)
  })

  it('una venta anulada no figura en el remito ni suma al total, y no hay aviso aparte', async () => {
    const anulada = { id: 7, status: 'ANNULLED', createdAt: '2026-03-15T15:00:00.000Z', note: null, discount: '0.00', total: '999.00', items: [{ productName: 'Anulado', quantity: 1, unitPrice: '999.00', subtotal: '999.00' }] }
    api([ficha(3, { sales: [...ficha(3).sales, anulada] })])
    render()

    await screen.findByText('Cuaderno rayado')
    expect(screen.queryByText('Anulado')).not.toBeInTheDocument()
    expect(screen.queryByText(/Ventas anuladas/)).not.toBeInTheDocument()
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?450,00/)
  })

  it('los pagos y los recargos registrados son renglones del remito, y el pie dice TOTAL, PAGADO y SALDO', async () => {
    api([
      ficha(3, {
        balance: '420.00',
        surcharges: [{ monthNumber: 1, base: '450.00', percent: '5.00', amount: '22.50', chargedOn: '2026-05-10T15:00:00.000Z', registeredAt: '2026-05-10T15:00:00.000Z' }],
        payments: [{ id: 1, amount: '52.50', paymentMethod: 'CASH', note: null, createdAt: '2026-05-12T15:00:00.000Z', userName: 'Ana' }],
      }),
    ])
    render()

    expect((await screen.findByText(/Recargo por mora \(mes 1 de atraso, 5%\)/)).closest('tr')).toHaveTextContent(/\$\s?22,50/)
    expect(screen.getByText(/^Pago .* · Efectivo$/).closest('tr')).toHaveTextContent(/−\s*\$\s?52,50/)
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?472,50/)
    expect(screen.getByTestId('remito-paid')).toHaveTextContent(/\$\s?52,50/)
    expect(screen.getByTestId('remito-balance')).toHaveTextContent(/\$\s?420,00/)
  })

  it('muestra el vencimiento, y "VENCIDA" con los recargos que ya corresponden y lo que hay que pagar hoy', async () => {
    api([vencida()])
    render()

    expect(await screen.findByTestId('remito-due')).toHaveTextContent(/Vence 10\/4\/26.*VENCIDA \(1 mes\)/)
    expect(screen.getByTestId('remito-pending')).toHaveTextContent(/\$\s?50,00/)
    expect(screen.getByTestId('remito-payable')).toHaveTextContent(/\$\s?1\.050,00/)
  })

  it('una ficha al día no dice VENCIDA', async () => {
    api([ficha(3)])
    render()

    expect(await screen.findByTestId('remito-due')).not.toHaveTextContent('VENCIDA')
  })

  it('sin ficha abierta el remito queda con la grilla vacía y sin vencimiento; las canceladas no se muestran', async () => {
    api([cancelada()])
    render()

    await screen.findByLabelText('Señor/es')
    expect(screen.queryByText('Cuaderno rayado')).not.toBeInTheDocument()
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(1 + 12)
    expect(screen.queryByTestId('remito-due')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Número de ficha')).toBeDisabled()
  })
})

describe('CustomerFichaPage: editar y guardar', () => {
  it('al principio no hay barra de cambios', async () => {
    api([ficha(3)])
    render()
    await screen.findByLabelText('Señor/es')

    expect(barra()).not.toBeInTheDocument()
  })

  it('al cambiar un dato aparece la barra con la cantidad de cambios y el dato se resalta', async () => {
    api([ficha(3)])
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), 'Formosa')

    expect(within(barra()!).getByText('Tenés 1 cambio sin guardar')).toBeInTheDocument()
    expect(screen.getByLabelText('Localidad')).toHaveClass('bg-amber-100')

    await user.type(screen.getByLabelText('Domicilio'), ' Norte')
    expect(within(barra()!).getByText('Tenés 2 cambios sin guardar')).toBeInTheDocument()
  })

  it('si lo escrito vuelve a ser igual a lo guardado, ya no cuenta como cambio', async () => {
    api([ficha(3)])
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), 'F')
    expect(barra()).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Localidad'))

    expect(barra()).not.toBeInTheDocument()
  })

  it('los espacios de los costados no cuentan como cambio', async () => {
    api([ficha(3)])
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Domicilio'), '  ')

    expect(barra()).not.toBeInTheDocument()
  })

  it('el CUIT escrito con otros guiones pero con los mismos dígitos no cuenta como cambio', async () => {
    api([ficha(3)], {}, { ...maria, cuit: '27123456789' })
    const user = userEvent.setup()
    render()

    const cuit = await screen.findByLabelText('C.U.I.T. del cliente')
    expect(cuit).toHaveValue('27-12345678-9')
    await user.clear(cuit)
    await user.type(cuit, '27 12345678 9')

    expect(barra()).not.toBeInTheDocument()
  })

  it('cambiar la fecha no es un cambio para guardar', async () => {
    api([ficha(3)])
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.clear(screen.getByLabelText('Día'))
    await user.type(screen.getByLabelText('Día'), '1')

    expect(screen.getByLabelText('Día')).toHaveValue('1')
    expect(barra()).not.toBeInTheDocument()
  })

  it('"Guardar cambios" guarda al cliente enviando todos sus datos (no se borra ninguno), avisa y recarga', async () => {
    let guardado = maria
    const { calls } = api([ficha(3)], {
      'GET /api/customers/5': () => guardado,
      'PUT /api/customers/5': ({ body }) => (guardado = { ...maria, ...(body as object) }),
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), '  Formosa ')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados')
    expect(puts(calls, '/api/customers/5')).toHaveLength(1)
    expect(puts(calls, '/api/customers/5')[0]!.body).toEqual({
      name: 'María Gómez',
      phone: '370 4123456',
      dni: '30123456',
      address: 'España 123',
      locality: 'Formosa',
      taxCondition: null,
      cuit: '',
      notes: 'Paga los viernes',
      creditAuthorized: true,
      active: true,
    })
    expect(barra()).not.toBeInTheDocument()
    expect(screen.getByLabelText('Localidad')).toHaveValue('Formosa')
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/customers/5')).toHaveLength(2)
    expect(puts(calls, '/api/accounts/3/remito')).toHaveLength(0) // lo que no cambió no se manda
    expect(puts(calls, '/api/settings/business')).toHaveLength(0)
  })

  it('el CUIT se manda solo con dígitos y el nombre y el domicilio también se guardan', async () => {
    const { calls } = api([ficha(3)], { 'PUT /api/customers/5': () => maria })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await escribir(user, 'Señor/es', 'María del Carmen Gómez')
    await escribir(user, 'Domicilio', 'Belgrano 456')
    await user.type(screen.getByLabelText('C.U.I.T. del cliente'), '27-12345678-9')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(puts(calls, '/api/customers/5')).toHaveLength(1))
    expect(puts(calls, '/api/customers/5')[0]!.body).toMatchObject({ name: 'María del Carmen Gómez', address: 'Belgrano 456', cuit: '27123456789' })
  })

  it('la condición de IVA se tilda y se guarda; al tocar el tildado vuelve a sin dato', async () => {
    const { calls } = api([ficha(3)], { 'PUT /api/customers/5': () => maria })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.click(screen.getByRole('radio', { name: 'Resp. Inscripto' }))
    expect(screen.getByRole('radio', { name: 'Resp. Inscripto' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(puts(calls, '/api/customers/5')).toHaveLength(1))
    expect(puts(calls, '/api/customers/5')[0]!.body).toMatchObject({ taxCondition: 'REGISTERED' })
  })

  it('tocar el casillero tildado de un cliente que ya tenía condición lo deja sin dato al guardar', async () => {
    const { calls } = api([ficha(3)], { 'PUT /api/customers/5': () => maria }, { ...maria, taxCondition: 'MONOTAX' })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    expect(screen.getByRole('radio', { name: 'Monotributo' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('radio', { name: 'Monotributo' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(puts(calls, '/api/customers/5')).toHaveLength(1))
    expect(puts(calls, '/api/customers/5')[0]!.body).toMatchObject({ taxCondition: null })
  })

  it('los dos números del remito se guardan en la ficha, mandando los dos, y después ya no figuran como cambios', async () => {
    let guardada = ficha(3, { number: '10' })
    const { calls } = api([], {
      'GET /api/accounts': () => [guardada],
      'PUT /api/accounts/3/remito': ({ body }) => (guardada = ficha(3, body as object)),
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Remito Nº'), ' 0001-00004567 ')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(puts(calls, '/api/accounts/3/remito')).toHaveLength(1))
    expect(puts(calls, '/api/accounts/3/remito')[0]!.body).toEqual({ number: '10', remitoNumber: '0001-00004567' })
    expect(puts(calls, '/api/customers/5')).toHaveLength(0)
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
    expect(screen.getByLabelText('Remito Nº')).toHaveValue('0001-00004567')
    expect(screen.getByLabelText('Número de ficha')).toHaveValue('10')
  })

  it('si la ficha se cancela con un pago, lo escrito en sus números ya no cuenta como cambio', async () => {
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
    await screen.findByLabelText('Señor/es')
    await user.type(screen.getByLabelText('Remito Nº'), '77')
    expect(within(barra()!).getByText('Tenés 1 cambio sin guardar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))
    await user.type(screen.getByLabelText('Importe'), '450')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await screen.findByText('Pago registrado')
    await waitFor(() => expect(screen.getByLabelText('Remito Nº')).toBeDisabled())
    expect(barra()).not.toBeInTheDocument()
  })

  it('los datos del comercio se guardan en la base, todos juntos', async () => {
    const { calls } = api([ficha(3)], { 'PUT /api/settings/business': () => comercio })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await escribir(user, 'Nombre del comercio', 'Otro comercio')
    await user.selectOptions(screen.getByLabelText('Condición frente a ARCA del comercio'), 'MONOTAX')
    await escribir(user, 'C.U.I.T. del comercio', '30-71234567-8')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(puts(calls, '/api/settings/business')).toHaveLength(1))
    expect(puts(calls, '/api/settings/business')[0]!.body).toEqual({
      name: 'Otro comercio',
      owner: 'Titular de prueba',
      address: 'Calle 1',
      taxCondition: 'MONOTAX',
      cuit: '30712345678',
      grossIncome: '123-456',
      activityStart: '03/2011',
    })
  })

  it('con el encabezado vacío se completa una sola vez y se guarda', async () => {
    const { calls } = api([ficha(3)], { 'PUT /api/settings/business': () => comercio }, maria, comercioVacio)
    const user = userEvent.setup()
    render()

    expect(await screen.findByText(/El encabezado del comercio está vacío/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nombre del comercio'), 'Comercio')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(puts(calls, '/api/settings/business')).toHaveLength(1))
    expect(puts(calls, '/api/settings/business')[0]!.body).toEqual({
      name: 'Comercio',
      owner: '',
      address: '',
      taxCondition: null,
      cuit: '',
      grossIncome: '',
      activityStart: '',
    })
  })

  it('con el encabezado cargado no muestra el aviso de encabezado vacío', async () => {
    api([ficha(3)])
    render()
    await screen.findByLabelText('Señor/es')

    expect(screen.queryByText(/El encabezado del comercio está vacío/)).not.toBeInTheDocument()
  })

  it('con cambios en el cliente, la ficha y el comercio hace tres guardados, cada uno en su lugar', async () => {
    const { calls } = api([ficha(3)], {
      'PUT /api/customers/5': () => maria,
      'PUT /api/accounts/3/remito': () => ficha(3),
      'PUT /api/settings/business': () => comercio,
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), 'Formosa')
    await user.type(screen.getByLabelText('Número de ficha'), '5')
    await user.type(screen.getByLabelText('Ingresos Brutos'), '9')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cambios guardados'))
    expect(puts(calls, '/api/customers/5')).toHaveLength(1)
    expect(puts(calls, '/api/accounts/3/remito')).toHaveLength(1)
    expect(puts(calls, '/api/settings/business')).toHaveLength(1)
  })

  it('si un guardado falla muestra cuál, los otros igual se guardan y lo que falló sigue escrito', async () => {
    const { calls } = api([ficha(3)], {
      'PUT /api/customers/5': () => Response.json({ error: 'El nombre no puede estar vacío' }, { status: 400 }),
      'PUT /api/settings/business': () => comercio,
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await escribir(user, 'Señor/es', '')
    await user.type(screen.getByLabelText('Ingresos Brutos'), '9')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Datos del cliente: El nombre no puede estar vacío')
    expect(puts(calls, '/api/settings/business')).toHaveLength(1)
    expect(screen.getByLabelText('Señor/es')).toHaveValue('') // sigue escrito para corregirlo
    expect(within(barra()!).getByText('Tenés 1 cambio sin guardar')).toBeInTheDocument()
    expect(screen.queryByText('Cambios guardados')).not.toBeInTheDocument()
  })

  it('si fallan dos guardados muestra los dos mensajes', async () => {
    const { calls } = api([ficha(3)], {
      'PUT /api/customers/5': () => Response.json({ error: 'Error uno' }, { status: 400 }),
      'PUT /api/accounts/3/remito': () => Response.json({ error: 'Error dos' }, { status: 400 }),
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), 'F')
    await user.type(screen.getByLabelText('Número de ficha'), '1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Datos del cliente: Error uno')
    expect(alerta).toHaveTextContent('Números del remito: Error dos')
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/customers/5')).toHaveLength(1) // no se guardó nada: no recarga
  })

  it('"Descartar" borra lo escrito sin llamar a la API', async () => {
    const { calls } = api([ficha(3)])
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), 'Formosa')
    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.getByLabelText('Localidad')).toHaveValue('')
    expect(barra()).not.toBeInTheDocument()
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('"Descartar" también saca el mensaje de error de un guardado fallido', async () => {
    api([ficha(3)], { 'PUT /api/customers/5': () => Response.json({ error: 'Falló' }, { status: 400 }) })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), 'F')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin ficha abierta, un cambio en el cliente se guarda y no se intenta guardar números de remito', async () => {
    const { calls } = api([], { 'PUT /api/customers/5': () => maria })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')

    await user.type(screen.getByLabelText('Localidad'), 'Formosa')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(puts(calls, '/api/customers/5')).toHaveLength(1))
    expect(calls.some((c) => c.path.endsWith('/remito'))).toBe(false)
  })

  it('un cambio nuevo borra el aviso de "Cambios guardados"', async () => {
    api([ficha(3)], { 'PUT /api/customers/5': () => maria })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    await user.type(screen.getByLabelText('Localidad'), 'F')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('status')

    await user.type(screen.getByLabelText('Domicilio'), 'x')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('CustomerFichaPage: pagos desde el pie del remito', () => {
  it('el formulario de pago está cerrado hasta que se toca el pie', async () => {
    api([ficha(3)])
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    expect(screen.queryByLabelText('Importe')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))

    expect(screen.getByLabelText('Importe')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))
    expect(screen.queryByLabelText('Importe')).not.toBeInTheDocument()
  })

  it('sin ficha abierta no se puede registrar un pago', async () => {
    api([cancelada()])
    render()
    await screen.findByLabelText('Señor/es')

    expect(screen.queryByRole('button', { name: 'Registrar un pago' })).not.toBeInTheDocument()
  })

  it('registra un pago: manda importe con punto, medio de pago y nota; avisa, cierra el formulario y recarga', async () => {
    let pagado = false
    const { calls } = api([], {
      'GET /api/accounts': () => [pagado ? ficha(3, { balance: '299.50' }) : ficha(3)],
      'POST /api/accounts/3/payments': () => {
        pagado = true
        return ficha(3)
      },
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))

    await user.type(screen.getByLabelText('Importe'), '150,5')
    await user.selectOptions(screen.getByLabelText('Medio de pago'), 'Tarjeta')
    await user.type(screen.getByLabelText('Nota (opcional)'), '  Seña  ')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Pago registrado')
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ amount: '150.5', paymentMethod: 'CARD', note: 'Seña' })
    await waitFor(() => expect(screen.getByTestId('remito-balance')).toHaveTextContent(/\$\s?299,50/))
    expect(screen.queryByLabelText('Importe')).not.toBeInTheDocument()
  })

  it('un pago no borra lo que se estaba editando en el remito', async () => {
    api([ficha(3)], { 'POST /api/accounts/3/payments': () => ficha(3) })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    await user.type(screen.getByLabelText('Localidad'), 'Formosa')

    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))
    await user.type(screen.getByLabelText('Importe'), '10')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await screen.findByText('Pago registrado')

    expect(screen.getByLabelText('Localidad')).toHaveValue('Formosa')
    expect(within(barra()!).getByText('Tenés 1 cambio sin guardar')).toBeInTheDocument()
  })

  it('si la API rechaza el pago muestra su mensaje y conserva lo escrito', async () => {
    api([ficha(3)], {
      'POST /api/accounts/3/payments': () =>
        Response.json({ error: 'El pago no puede superar el saldo de la cuenta (saldo actual: 450.00)' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))

    await user.type(screen.getByLabelText('Importe'), '9999')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El pago no puede superar el saldo de la cuenta (saldo actual: 450.00)')
    expect(screen.getByLabelText('Importe')).toHaveValue('9999')
  })

  it('con recargos pendientes ofrece aplicarlos; los aplica avisando y recargando', async () => {
    let aplicado = false
    const { calls } = api([], {
      'GET /api/accounts': () => [aplicado ? ficha(3, { balance: '1050.00', payable: '1050.00', overdue: true }) : vencida()],
      'POST /api/accounts/3/surcharges': () => {
        aplicado = true
        return ficha(3)
      },
    })
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))

    expect(screen.getByText('Recargos que ya corresponden (todavía sin registrar)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aplicar recargos' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Recargos registrados')
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/accounts/3/surcharges')).toBe(true)
  })

  it('sin recargos pendientes no ofrece "Aplicar recargos"', async () => {
    api([ficha(3)])
    const user = userEvent.setup()
    render()
    await screen.findByLabelText('Señor/es')
    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))

    expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument()
  })

  it('después de un pago que cancela la ficha el remito pasa a estar vacío', async () => {
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
    await screen.findByLabelText('Señor/es')
    await user.click(screen.getByRole('button', { name: 'Registrar un pago' }))
    await user.type(screen.getByLabelText('Importe'), '450')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Pago registrado')
    await waitFor(() => expect(screen.queryByText('Cuaderno rayado')).not.toBeInTheDocument())
    expect(screen.getByRole('img', { name: 'Cuenta Corriente: sin tildar' })).toBeInTheDocument()
  })
})
