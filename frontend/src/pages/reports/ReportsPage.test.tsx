import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import ReportsPage from './ReportsPage'

const informe = (extra: object = {}) => ({
  from: '2026-10-06',
  to: '2026-11-04',
  totals: { count: 3, total: '4500.50', average: '1500.17' },
  byDay: [
    { date: '2026-11-02', count: 1, total: '1000.00' },
    { date: '2026-11-03', count: 0, total: '0.00' },
    { date: '2026-11-04', count: 2, total: '3500.50' },
  ],
  byPaymentMethod: [
    { method: 'CASH', count: 2, total: '2000.50' },
    { method: 'ON_CREDIT', count: 1, total: '2500.00' },
  ],
  topProducts: [
    { productId: 1, productName: 'Cuaderno A4', quantity: 5, total: '2500.00' },
    { productId: 2, productName: 'Lápiz negro', quantity: 1, total: '300.25' },
  ],
  ...extra,
})

const deuda = {
  totalBalance: '1500.00',
  totalPayable: '1550.00',
  accounts: [
    { accountId: 1, customer: { id: 5, name: 'María Gómez' }, balance: '1000.00', payable: '1050.00', dueDate: '2026-10-01T15:00:00.000Z', overdue: true, monthsOverdue: 1 },
    { accountId: 2, customer: { id: 6, name: 'Pedro Sosa' }, balance: '500.00', payable: '500.00', dueDate: '2026-12-01T15:00:00.000Z', overdue: false, monthsOverdue: 0 },
  ],
}

const producto = (id: number, name: string, stock: number, minStock: number) => ({
  id, name, categoryId: 1, category: { id: 1, name: 'Papelería' }, salePrice: '100.00', minStock, active: true, stock, lowStock: true,
})

const baseRoutes = {
  'GET /api/reports/sales': () => informe(),
  'GET /api/reports/debt': () => deuda,
  'GET /api/products': () => [producto(7, 'Goma', 1, 3), producto(8, 'Regla', 0, 2)],
}

describe('ReportsPage – ventas del período', () => {
  it('pide el período por defecto (sin fechas) y muestra las fechas que eligió la API', async () => {
    const { calls } = mockApi(baseRoutes)
    render(<ReportsPage />)

    await screen.findByTestId('tile-total')
    expect(calls.find((c) => c.path === '/api/reports/sales')!.query.has('from')).toBe(false)
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-06')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-11-04')
    expect(screen.getByText(/del 06\/10\/2026 al 04\/11\/2026/)).toBeInTheDocument()
  })

  it('muestra total vendido, cantidad de ventas y ticket promedio', async () => {
    mockApi(baseRoutes)
    render(<ReportsPage />)

    expect(await screen.findByTestId('tile-total')).toHaveTextContent(/\$\s?4\.500,50/)
    expect(screen.getByTestId('tile-count')).toHaveTextContent('3')
    expect(screen.getByTestId('tile-average')).toHaveTextContent(/\$\s?1\.500,17/)
  })

  it('dibuja los gráficos con sus datos', async () => {
    mockApi(baseRoutes)
    const { container } = render(<ReportsPage />)
    await screen.findByTestId('tile-total')

    expect(screen.getByRole('img', { name: 'Gráfico de columnas: ventas por día' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gráfico de barras: ventas por medio de pago' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Gráfico de barras: productos más vendidos, por unidades' })).toBeInTheDocument()
    // 2 días con ventas (el de $0 no dibuja columna) + 2 medios de pago + 2 productos
    await waitFor(() => expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2 + 2 + 2))
  })

  it('los gráficos de barras rotulan cada barra: medio de pago en español y unidades vendidas', async () => {
    mockApi(baseRoutes)
    render(<ReportsPage />)
    await screen.findByTestId('tile-total')

    const medios = screen.getByRole('img', { name: 'Gráfico de barras: ventas por medio de pago' })
    await waitFor(() => expect(medios).toHaveTextContent('Efectivo'))
    expect(medios).toHaveTextContent('A crédito')
    expect(medios).toHaveTextContent(/\$\s?2\.500,00/)

    const productos = screen.getByRole('img', { name: 'Gráfico de barras: productos más vendidos, por unidades' })
    await waitFor(() => expect(productos).toHaveTextContent('5 unidades'))
    expect(productos).toHaveTextContent('1 unidad')
    expect(productos).not.toHaveTextContent('1 unidades')
    expect(productos).toHaveTextContent('Cuaderno A4')
  })

  it('"Ver tabla" muestra los mismos datos con importes exactos y "Ver gráfico" vuelve', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<ReportsPage />)
    await screen.findByTestId('tile-total')
    const tarjeta = screen.getByRole('heading', { name: 'Ventas por día' }).closest('section')!

    await user.click(within(tarjeta).getByRole('button', { name: 'Ver tabla' }))

    const fila = within(tarjeta).getByText('04/11/2026').closest('tr')!
    expect(fila).toHaveTextContent(/2.*\$\s?3\.500,50/)
    expect(within(tarjeta).queryByRole('img')).not.toBeInTheDocument()
    expect(within(tarjeta).getAllByRole('row')).toHaveLength(1 + 3) // encabezado + 3 días, también el que no tuvo ventas

    await user.click(within(tarjeta).getByRole('button', { name: 'Ver gráfico' }))
    expect(within(tarjeta).getByRole('img')).toBeInTheDocument()
  })

  it('la tabla de medios de pago usa los nombres en español, con "A crédito"', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<ReportsPage />)
    await screen.findByTestId('tile-total')
    const tarjeta = screen.getByRole('heading', { name: 'Ventas por medio de pago' }).closest('section')!

    await user.click(within(tarjeta).getByRole('button', { name: 'Ver tabla' }))

    expect(within(tarjeta).getByText('Efectivo').closest('tr')).toHaveTextContent(/2.*\$\s?2\.000,50/)
    expect(within(tarjeta).getByText('A crédito').closest('tr')).toHaveTextContent(/1.*\$\s?2\.500,00/)
  })

  it('la tabla de más vendidos muestra unidades e importe', async () => {
    mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<ReportsPage />)
    await screen.findByTestId('tile-total')
    const tarjeta = screen.getByRole('heading', { name: 'Productos más vendidos' }).closest('section')!

    await user.click(within(tarjeta).getByRole('button', { name: 'Ver tabla' }))

    expect(within(tarjeta).getByText('Cuaderno A4').closest('tr')).toHaveTextContent(/5.*\$\s?2\.500,00/)
  })

  it('al elegir otro período pide esas fechas', async () => {
    const { calls } = mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<ReportsPage />)
    await screen.findByTestId('tile-total')

    await user.clear(screen.getByLabelText('Desde'))
    await user.type(screen.getByLabelText('Desde'), '2026-10-01')
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2026-10-31')
    await user.click(screen.getByRole('button', { name: 'Ver período' }))

    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/api/reports/sales').at(-1)!
      expect([last.query.get('from'), last.query.get('to')]).toEqual(['2026-10-01', '2026-10-31'])
    })
  })

  it('"Ver período" está deshabilitado si falta una fecha, y "Últimos 30 días" vuelve al período por defecto', async () => {
    const { calls } = mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<ReportsPage />)
    await screen.findByTestId('tile-total')

    await user.clear(screen.getByLabelText('Hasta'))
    expect(screen.getByRole('button', { name: 'Ver período' })).toBeDisabled()

    await user.type(screen.getByLabelText('Hasta'), '2026-10-31')
    await user.click(screen.getByRole('button', { name: 'Ver período' }))
    await waitFor(() => expect(calls.filter((c) => c.path === '/api/reports/sales').at(-1)!.query.get('to')).toBe('2026-10-31'))

    await user.click(screen.getByRole('button', { name: 'Últimos 30 días' }))
    await waitFor(() => expect(calls.filter((c) => c.path === '/api/reports/sales').at(-1)!.query.has('from')).toBe(false))
  })

  it('no pide un período si falta una fecha, ni siquiera enviando el formulario con Enter', async () => {
    const { calls } = mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<ReportsPage />)
    await screen.findByTestId('tile-total')
    await user.clear(screen.getByLabelText('Hasta'))
    const pedidos = calls.filter((c) => c.path === '/api/reports/sales').length

    fireEvent.submit(screen.getByRole('button', { name: 'Ver período' }).closest('form')!)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls.filter((c) => c.path === '/api/reports/sales')).toHaveLength(pedidos)
  })

  it('sin ventas en el período avisa y no dibuja los gráficos', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/reports/sales': () =>
        informe({ totals: { count: 0, total: '0.00', average: '0.00' }, byDay: [{ date: '2026-11-04', count: 0, total: '0.00' }], byPaymentMethod: [], topProducts: [] }),
    })
    render(<ReportsPage />)

    expect(await screen.findByText('No hay ventas en este período.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('tile-count')).toHaveTextContent('0')
  })

  it('si la API rechaza el período muestra su mensaje', async () => {
    mockApi({ ...baseRoutes, 'GET /api/reports/sales': () => Response.json({ error: 'El rango no puede superar 366 días' }, { status: 400 }) })
    render(<ReportsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('El rango no puede superar 366 días')
  })
})

describe('ReportsPage – stock bajo y deuda', () => {
  it('lista los productos con stock bajo pidiendo solo los activos en alerta', async () => {
    const { calls } = mockApi(baseRoutes)
    render(<ReportsPage />)

    const fila = (await screen.findByText('Goma')).closest('tr')!
    expect(within(fila).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Goma', '1', '3'])
    expect(screen.getByText('Regla').closest('tr')).toHaveTextContent('0')
    const pedido = calls.find((c) => c.path === '/api/products')!
    expect(pedido.query.get('lowStock')).toBe('true')
    expect(pedido.query.get('active')).toBe('true')
  })

  it('sin productos con stock bajo lo dice', async () => {
    mockApi({ ...baseRoutes, 'GET /api/products': () => [] })
    render(<ReportsPage />)

    expect(await screen.findByText('No hay productos con stock bajo.')).toBeInTheDocument()
  })

  it('muestra la deuda de cada cliente, con vencidas marcadas, y el total a pagar con su desglose', async () => {
    mockApi(baseRoutes)
    render(<ReportsPage />)

    const maria = (await screen.findByText('María Gómez')).closest('tr')!
    expect(maria).toHaveTextContent(/\$\s?1\.050,00/)
    expect(within(maria).getByText('Vencida')).toBeInTheDocument()
    expect(screen.getByText('Pedro Sosa').closest('tr')).toHaveTextContent('Al día')
    expect(screen.getByTestId('debt-total')).toHaveTextContent(/\$\s?1\.550,00/)
    expect(screen.getByText(/saldo \$\s?1\.500,00 \+ recargos que ya corresponden/)).toBeInTheDocument()
  })

  it('sin recargos pendientes no repite el desglose', async () => {
    mockApi({ ...baseRoutes, 'GET /api/reports/debt': () => ({ ...deuda, totalPayable: '1500.00' }) })
    render(<ReportsPage />)

    await screen.findByTestId('debt-total')
    expect(screen.queryByText(/recargos que ya corresponden/)).not.toBeInTheDocument()
  })

  it('sin cuentas pendientes lo dice', async () => {
    mockApi({ ...baseRoutes, 'GET /api/reports/debt': () => ({ totalBalance: '0.00', totalPayable: '0.00', accounts: [] }) })
    render(<ReportsPage />)

    expect(await screen.findByText('No hay cuentas pendientes.')).toBeInTheDocument()
  })
})
