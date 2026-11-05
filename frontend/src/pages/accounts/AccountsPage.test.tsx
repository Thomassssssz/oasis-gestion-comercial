import { render, screen, within } from '@testing-library/react'
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
  overdue: false,
  monthsOverdue: 0,
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

  it('"Ver ventas" despliega las ventas de la ficha (las anuladas tachadas) y "Ocultar" las esconde', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3)] })
    const user = userEvent.setup()
    render(<AccountsPage />)

    await user.click(await screen.findByRole('button', { name: 'Ver ventas de María Gómez' }))

    const primera = screen.getByText(/Venta #1/)
    expect(primera).toHaveTextContent('Pedido escolar')
    expect(primera).toHaveTextContent(/\$\s?250,00/)
    expect(screen.getByText(/Venta #2/)).toHaveTextContent('(anulada)')

    await user.click(screen.getByRole('button', { name: 'Ocultar ventas de María Gómez' }))
    expect(screen.queryByText(/Venta #1/)).not.toBeInTheDocument()
  })

  it('al cambiar de pestaña se cierra el detalle desplegado', async () => {
    mockApi({ 'GET /api/accounts': () => [ficha(3)] }) // la misma ficha en ambas pestañas, solo para comprobar el cierre
    const user = userEvent.setup()
    render(<AccountsPage />)
    await user.click(await screen.findByRole('button', { name: 'Ver ventas de María Gómez' }))
    expect(screen.getByText(/Venta #1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Historial de canceladas' }))

    await screen.findByRole('button', { name: 'Ver ventas de María Gómez' })
    expect(screen.queryByText(/Venta #1/)).not.toBeInTheDocument()
  })

  it('muestra el error de la API', async () => {
    mockApi({ 'GET /api/accounts': () => Response.json({ error: 'Falló la base' }, { status: 500 }) })
    render(<AccountsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la base')
  })
})
