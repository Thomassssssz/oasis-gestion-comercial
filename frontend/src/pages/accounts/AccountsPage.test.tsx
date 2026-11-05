import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import AccountsPage from './AccountsPage'

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
    { id: 1, status: 'CONFIRMED', createdAt: '2026-03-10T15:00:00.000Z', note: 'Pedido escolar', total: '250.00' },
    { id: 2, status: 'ANNULLED', createdAt: '2026-03-11T15:00:00.000Z', note: null, total: '100.00' },
  ],
  ...extra,
})

describe('AccountsPage', () => {
  it('muestra por defecto las cuentas pendientes con cliente, vencimiento y saldo', async () => {
    const { calls } = mockApi({ 'GET /api/accounts': () => [ficha(3)] })
    render(<AccountsPage />)

    const fila = (await screen.findByText('María Gómez')).closest('tr')!
    expect(fila).toHaveTextContent(/\$\s?450,00/)
    expect(within(fila).getByText('Al día')).toBeInTheDocument()
    expect(calls[0]!.query.get('status')).toBe('OPEN')
    expect(screen.getByRole('button', { name: 'Pendientes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('marca como vencida la cuenta con atraso y cuenta los meses', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3, { overdue: true, monthsOverdue: 2 }), ficha(4, { overdue: true, monthsOverdue: 1 }), ficha(5, { overdue: true })] })
    render(<AccountsPage />)

    expect(await screen.findByText('Vencida (2 meses)')).toBeInTheDocument()
    expect(screen.getByText('Vencida (1 mes)')).toBeInTheDocument()
    expect(screen.getByText('Vencida')).toBeInTheDocument() // vencida pero sin un mes completo de atraso
  })

  it('el historial pide las canceladas y muestra "Cancelada" con su fecha de cierre', async () => {
    const { calls } = mockApi({
      'GET /api/accounts': ({ query }) =>
        query.get('status') === 'CANCELLED'
          ? [ficha(9, { status: 'CANCELLED', closedAt: '2026-03-20T10:00:00.000Z', balance: '0.00' })]
          : [],
    })
    const user = userEvent.setup()
    render(<AccountsPage />)
    expect(await screen.findByText('No hay cuentas pendientes.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Historial de canceladas' }))

    const fila = (await screen.findByText('María Gómez')).closest('tr')!
    expect(within(fila).getByText('Cancelada')).toBeInTheDocument()
    expect(fila).toHaveTextContent('20/3/26') // fecha de cierre, no de vencimiento
    expect(calls.at(-1)!.query.get('status')).toBe('CANCELLED')
    expect(screen.getByRole('button', { name: 'Historial de canceladas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('muestra un mensaje cuando el historial está vacío', async () => {
    mockApi({ 'GET /api/accounts': () => [] })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await screen.findByText('No hay cuentas pendientes.')

    await user.click(screen.getByRole('button', { name: 'Historial de canceladas' }))

    expect(await screen.findByText('Todavía no hay cuentas canceladas.')).toBeInTheDocument()
  })

  it('"Ver detalle" despliega las ventas de la ficha (las anuladas tachadas) y "Ocultar" las esconde', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3)] })
    const user = userEvent.setup()
    render(<AccountsPage />)

    await user.click(await screen.findByRole('button', { name: 'Ver detalle de María Gómez' }))

    const primera = screen.getByText(/Venta #1/)
    expect(primera).toHaveTextContent('Pedido escolar')
    expect(primera).toHaveTextContent(/\$\s?250,00/)
    expect(screen.getByText(/Venta #2/)).toHaveTextContent('(anulada)')

    await user.click(screen.getByRole('button', { name: 'Ocultar detalle de María Gómez' }))
    expect(screen.queryByText(/Venta #1/)).not.toBeInTheDocument()
  })

  it('al cambiar de pestaña se cierra el detalle desplegado', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3)] }) // la misma ficha en ambas pestañas, solo para comprobar el cierre
    const user = userEvent.setup()
    render(<AccountsPage />)
    await user.click(await screen.findByRole('button', { name: 'Ver detalle de María Gómez' }))
    expect(screen.getByText(/Venta #1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Historial de canceladas' }))

    await screen.findByRole('button', { name: 'Ver detalle de María Gómez' })
    expect(screen.queryByText(/Venta #1/)).not.toBeInTheDocument()
  })

  it('muestra el error de la API', async () => {
    mockApi({ 'GET /api/accounts': () => Response.json({ error: 'Falló la base' }, { status: 500 }) })
    render(<AccountsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la base')
  })
})

const pendiente = { monthNumber: 1, base: '1000.00', percent: '5.00', amount: '50.00', chargedOn: '2026-05-10T15:00:00.000Z' }
const vencida = (extra: object = {}) =>
  ficha(3, {
    overdue: true,
    monthsOverdue: 1,
    balance: '1000.00',
    pendingSurchargesTotal: '50.00',
    payable: '1050.00',
    pendingSurcharges: [pendiente],
    ...extra,
  })

async function abrirDetalle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Ver detalle de María Gómez' }))
}

describe('AccountsPage – pagos y recargos', () => {
  it('muestra los pagos y los recargos registrados con su base y porcentaje', async () => {
    mockApi({
      'GET /api/accounts': () => [
        ficha(3, {
          payments: [{ id: 1, amount: '200.00', paymentMethod: 'TRANSFER', note: 'Seña', createdAt: '2026-03-15T12:00:00.000Z', userName: 'Ana Propietaria' }],
          surcharges: [{ ...pendiente, registeredAt: '2026-05-11T10:00:00.000Z' }],
        }),
      ],
    })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)

    expect(screen.getByText(/Transferencia · Ana Propietaria · Seña/)).toHaveTextContent(/\$\s?200,00/)
    expect(screen.getByText(/Mes 1 de atraso \(/)).toHaveTextContent(/\$\s?50,00 = 5% de \$\s?1\.000,00/)
  })

  it('sin pagos dice que todavía no hay', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3)] })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)

    expect(screen.getByText('Todavía no hay pagos.')).toBeInTheDocument()
  })

  it('en la tabla muestra el saldo y aparte los recargos que ya corresponden', async () => {
    mockApi({ 'GET /api/accounts': () => [vencida()] })
    render(<AccountsPage />)

    const fila = (await screen.findByText('María Gómez')).closest('tr')!
    expect(fila).toHaveTextContent(/\$\s?1\.000,00/)
    expect(fila).toHaveTextContent(/\+ \$\s?50,00 de recargos/)
  })

  it('muestra los recargos pendientes y los aplica con el botón, avisando y recargando', async () => {
    let aplicado = false
    const { calls } = mockApi({
      'GET /api/accounts': () => [aplicado ? ficha(3, { balance: '1050.00', payable: '1050.00', overdue: true }) : vencida()],
      'POST /api/accounts/3/surcharges': () => {
        aplicado = true
        return ficha(3)
      },
    })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)

    expect(screen.getByText('Recargos que ya corresponden (todavía sin registrar)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aplicar recargos' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Recargos registrados')
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/accounts/3/surcharges')).toBe(true)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument())
  })

  it('la tabla no muestra "recargos" cuando no hay ninguno pendiente', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3)] })
    render(<AccountsPage />)

    const fila = (await screen.findByText('María Gómez')).closest('tr')!
    expect(fila).not.toHaveTextContent('de recargos')
  })

  it('una ficha cancelada nunca ofrece aplicar recargos, aunque la respuesta traiga pendientes', async () => {
    mockApi({ 'GET /api/accounts': () => [vencida({ status: 'CANCELLED', closedAt: '2026-03-20T10:00:00.000Z' })] })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await user.click(screen.getByRole('button', { name: 'Historial de canceladas' }))
    await abrirDetalle(user)

    expect(screen.queryByText('Recargos que ya corresponden (todavía sin registrar)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument()
  })

  it('sin recargos pendientes no ofrece "Aplicar recargos"', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3)] })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)

    expect(screen.queryByRole('button', { name: 'Aplicar recargos' })).not.toBeInTheDocument()
  })

  it('registra un pago: manda importe con punto, medio de pago y nota; avisa y recarga', async () => {
    const { calls } = mockApi({
      'GET /api/accounts': () => [ficha(3)],
      'POST /api/accounts/3/payments': () => ficha(3),
    })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)

    await user.type(screen.getByLabelText('Importe'), '150,5')
    await user.selectOptions(screen.getByLabelText('Medio de pago'), 'Tarjeta')
    await user.type(screen.getByLabelText('Nota (opcional)'), '  Seña  ')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Pago registrado')
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ amount: '150.5', paymentMethod: 'CARD', note: 'Seña' })
    expect(calls.filter((c) => c.method === 'GET').length).toBe(2) // recargó la lista
    expect(screen.getByLabelText('Importe')).toHaveValue('') // el formulario se limpia
  })

  it('"Registrar pago" está deshabilitado sin importe y no manda la nota si está vacía', async () => {
    const { calls } = mockApi({ 'GET /api/accounts': () => [ficha(3)], 'POST /api/accounts/3/payments': () => ficha(3) })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeDisabled()

    await user.type(screen.getByLabelText('Importe'), '10')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await screen.findByRole('status')
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ amount: '10', paymentMethod: 'CASH' })
  })

  it('informa lo que hay que pagar hoy, con recargos, y avisa que un pago parcial no cambia el vencimiento', async () => {
    mockApi({ 'GET /api/accounts': () => [vencida()] })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)

    const texto = screen.getByText(/Saldo a pagar hoy/)
    expect(texto).toHaveTextContent(/\$\s?1\.050,00/)
    expect(texto).toHaveTextContent('incluye los recargos que ya corresponden')
    expect(texto).toHaveTextContent('Un pago parcial no cambia el vencimiento')
  })

  it('si la API rechaza el pago muestra su mensaje y conserva lo escrito', async () => {
    mockApi({
      'GET /api/accounts': () => [ficha(3)],
      'POST /api/accounts/3/payments': () =>
        Response.json({ error: 'El pago no puede superar el saldo de la cuenta (saldo actual: 450.00)' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)

    await user.type(screen.getByLabelText('Importe'), '9999')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El pago no puede superar el saldo de la cuenta (saldo actual: 450.00)')
    expect(screen.getByLabelText('Importe')).toHaveValue('9999')
    expect(screen.queryByText('Pago registrado')).not.toBeInTheDocument()
  })

  it('una ficha cancelada no ofrece registrar pagos', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(9, { status: 'CANCELLED', closedAt: '2026-03-20T10:00:00.000Z', balance: '0.00', payable: '0.00' })] })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await user.click(screen.getByRole('button', { name: 'Historial de canceladas' }))
    await abrirDetalle(user)

    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Saldo a pagar hoy/)).not.toBeInTheDocument()
  })

  it('el aviso de pago sigue visible aunque la ficha cancelada desaparezca de pendientes, y se borra al cambiar de pestaña', async () => {
    let pagado = false
    mockApi({
      'GET /api/accounts': ({ query }) => (query.get('status') === 'OPEN' && !pagado ? [ficha(3)] : []),
      'POST /api/accounts/3/payments': () => {
        pagado = true
        return ficha(3)
      },
    })
    const user = userEvent.setup()
    render(<AccountsPage />)
    await abrirDetalle(user)
    await user.type(screen.getByLabelText('Importe'), '450')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText('No hay cuentas pendientes.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pago registrado')

    await user.click(screen.getByRole('button', { name: 'Historial de canceladas' }))
    expect(screen.queryByText('Pago registrado')).not.toBeInTheDocument()
  })
})
