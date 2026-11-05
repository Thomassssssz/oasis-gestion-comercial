import { render as baseRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { mockApi as baseMockApi } from '@/test/mock-api'
import CustomersPage from './CustomersPage'

const ana = {
  id: 1,
  name: 'Ana Pérez',
  phone: '370 4123456',
  dni: '30123456',
  address: 'España 123',
  locality: 'Formosa',
  taxCondition: 'MONOTAX',
  cuit: '27123456789',
  notes: 'Paga los viernes',
  creditAuthorized: true,
  active: true,
  createdAt: '2026-11-04T12:00:00.000Z',
  updatedAt: '2026-11-04T12:00:00.000Z',
}

// La lista pide también las fichas pendientes (de ahí sale lo que debe cada cliente); por defecto, ninguna.
const mockApi = (routes: Parameters<typeof baseMockApi>[0]) => baseMockApi({ 'GET /api/accounts': () => [], ...routes })
const render = (ui: React.ReactElement) => baseRender(<MemoryRouter>{ui}</MemoryRouter>)

// Ficha pendiente de un cliente, como la devuelve la API.
const ficha = (customerId: number, extra: object = {}) => ({
  id: 30 + customerId,
  customer: { id: customerId, name: 'x' },
  status: 'OPEN',
  balance: '450.00',
  pendingSurchargesTotal: '0.00',
  payable: '450.00',
  overdue: false,
  monthsOverdue: 0,
  ...extra,
})

const beto = { ...ana, id: 2, name: 'Beto Díaz', phone: null, dni: null, address: null, locality: null, taxCondition: null, cuit: null, notes: null, creditAuthorized: false }

describe('CustomersPage', () => {
  it('el nombre del cliente lleva a su ficha', async () => {
    mockApi({ 'GET /api/customers': () => [ana] })
    render(<CustomersPage />)

    expect(await screen.findByRole('link', { name: 'Ana Pérez' })).toHaveAttribute('href', '/clientes/1')
  })

  it('muestra cuánto debe cada cliente hoy (con recargos) y un guion si no debe nada', async () => {
    mockApi({
      'GET /api/customers': () => [ana, beto],
      'GET /api/accounts': () => [ficha(1, { balance: '1000.00', payable: '1050.00' })],
    })
    render(<CustomersPage />)

    const filaAna = (await screen.findByText('Ana Pérez')).closest('tr')!
    const filaBeto = screen.getByText('Beto Díaz').closest('tr')!
    expect(filaAna).toHaveTextContent(/\$\s?1\.050,00/)
    expect(within(filaAna).queryByText('Vencida')).not.toBeInTheDocument()
    expect(within(filaBeto).getAllByText('—').length).toBeGreaterThanOrEqual(3) // DNI, teléfono y deuda
    expect(filaBeto).not.toHaveTextContent('$')
  })

  it('avisa "Vencida" junto a la deuda cuando la ficha pasó su vencimiento', async () => {
    mockApi({
      'GET /api/customers': () => [ana, beto],
      'GET /api/accounts': () => [ficha(1, { overdue: true })],
    })
    render(<CustomersPage />)

    const filaAna = (await screen.findByText('Ana Pérez')).closest('tr')!
    expect(within(filaAna).getByText('Vencida')).toBeInTheDocument()
    expect(within(screen.getByText('Beto Díaz').closest('tr')!).queryByText('Vencida')).not.toBeInTheDocument()
  })

  it('pide las fichas pendientes', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [ana] })
    render(<CustomersPage />)

    await screen.findByText('Ana Pérez')
    expect(calls.find((c) => c.path === '/api/accounts')!.query.get('status')).toBe('OPEN')
  })

  it('el filtro "Con deuda" deja solo a los clientes con ficha pendiente y se puede quitar', async () => {
    mockApi({
      'GET /api/customers': () => [ana, beto],
      'GET /api/accounts': () => [ficha(2)],
    })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('Ana Pérez')

    await user.selectOptions(screen.getByLabelText('Filtrar por deuda'), 'Con deuda')

    await waitFor(() => expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument())
    expect(screen.getByText('Beto Díaz')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filtrar por deuda'), 'Con o sin deuda')
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
  })

  it('con "Con deuda" y nadie debiendo, lo dice', async () => {
    mockApi({ 'GET /api/customers': () => [ana] })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('Ana Pérez')

    await user.selectOptions(screen.getByLabelText('Filtrar por deuda'), 'Con deuda')

    expect(screen.getByText('No hay clientes que coincidan.')).toBeInTheDocument()
  })

  it('muestra el error si fallan las fichas pendientes', async () => {
    mockApi({ 'GET /api/customers': () => [ana], 'GET /api/accounts': () => Response.json({ error: 'Falló' }, { status: 500 }) })
    render(<CustomersPage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('muestra los clientes con DNI, teléfono, crédito y estado; lo que falta se ve como guion', async () => {
    mockApi({ 'GET /api/customers': () => [ana, beto] })
    render(<CustomersPage />)

    const filaAna = (await screen.findByText('Ana Pérez')).closest('tr')!
    const filaBeto = screen.getByText('Beto Díaz').closest('tr')!
    expect(filaAna).toHaveTextContent('30123456')
    expect(filaAna).toHaveTextContent('370 4123456')
    expect(filaAna).toHaveTextContent('Paga los viernes')
    expect(within(filaAna).getByText('Autorizado')).toBeInTheDocument()
    expect(within(filaAna).getByText('Activo')).toBeInTheDocument()
    expect(within(filaBeto).getByText('No')).toBeInTheDocument()
    expect(within(filaBeto).getAllByText('—')).toHaveLength(3) // DNI, teléfono y deuda
  })

  it('pide por defecto solo los clientes activos, sin filtro de crédito', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [] })
    render(<CustomersPage />)

    await screen.findByText('No hay clientes que coincidan.')
    const pedido = calls.find((c) => c.path === '/api/customers')!
    expect(pedido.query.get('active')).toBe('true')
    expect(pedido.query.has('creditAuthorized')).toBe(false)
    expect(pedido.query.has('search')).toBe(false)
  })

  it('manda la búsqueda y los filtros de estado y crédito a la API', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [] })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('No hay clientes que coincidan.')

    await user.type(screen.getByLabelText('Buscar cliente'), '3012')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Todos')
    await user.selectOptions(screen.getByLabelText('Filtrar por crédito'), 'Con crédito autorizado')

    let ultimo = calls.filter((c) => c.path === '/api/customers').at(-1)!
    expect(ultimo.query.get('search')).toBe('3012')
    expect(ultimo.query.has('active')).toBe(false)
    expect(ultimo.query.get('creditAuthorized')).toBe('true')

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Dados de baja')
    await user.selectOptions(screen.getByLabelText('Filtrar por crédito'), 'Sin crédito')

    ultimo = calls.filter((c) => c.path === '/api/customers').at(-1)!
    expect(ultimo.query.get('active')).toBe('false')
    expect(ultimo.query.get('creditAuthorized')).toBe('false')
  })

  it('la búsqueda se manda sin espacios sobrantes', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [] })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('No hay clientes que coincidan.')

    await user.type(screen.getByLabelText('Buscar cliente'), '  ana ')

    expect(calls.filter((c) => c.path === '/api/customers').at(-1)!.query.get('search')).toBe('ana')
  })

  it('después de guardar, vuelve a pedir la lista y muestra al cliente nuevo', async () => {
    let clientes: object[] = []
    const { calls } = mockApi({
      'GET /api/customers': () => clientes,
      'POST /api/customers': () => {
        clientes = [ana]
        return ana
      },
    })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('No hay clientes que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/customers')).toHaveLength(2)
  })

  it('editar a un cliente dado de baja no lo reactiva', async () => {
    const { calls } = mockApi({
      'GET /api/customers': () => [{ ...ana, active: false }],
      'PUT /api/customers/1': () => ana,
    })
    const user = userEvent.setup()
    render(<CustomersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Ana Pérez' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo cliente' })
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ active: false })
  })

  it('crea un cliente con todos sus datos', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [], 'POST /api/customers': () => ana })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('No hay clientes que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    await user.type(screen.getByLabelText('Nombre'), 'Ana Pérez')
    await user.type(screen.getByLabelText('Teléfono'), '370 4123456')
    await user.type(screen.getByLabelText('DNI'), '30.123.456')
    await user.type(screen.getByLabelText('Dirección'), 'España 123')
    await user.type(screen.getByLabelText('Observaciones'), 'Paga los viernes')
    await user.click(screen.getByLabelText('Autorizado a comprar a crédito'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo cliente' }) // el formulario se cerró
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      name: 'Ana Pérez',
      phone: '370 4123456',
      dni: '30.123.456',
      address: 'España 123',
      notes: 'Paga los viernes',
      creditAuthorized: true,
    })
  })

  it('un cliente nuevo no tiene crédito autorizado por defecto y solo el nombre es necesario', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [], 'POST /api/customers': () => beto })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('No hay clientes que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    expect(screen.getByLabelText('Autorizado a comprar a crédito')).not.toBeChecked()
    await user.type(screen.getByLabelText('Nombre'), 'Beto Díaz')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo cliente' })
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      name: 'Beto Díaz',
      phone: '',
      dni: '',
      address: '',
      notes: '',
      creditAuthorized: false,
    })
  })

  it('muestra el error de la API (DNI repetido) y deja el formulario abierto con lo escrito', async () => {
    mockApi({
      'GET /api/customers': () => [],
      'POST /api/customers': () => Response.json({ error: 'Ya existe un cliente con ese DNI' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('No hay clientes que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    await user.type(screen.getByLabelText('Nombre'), 'Otra Ana')
    await user.type(screen.getByLabelText('DNI'), '30123456')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un cliente con ese DNI')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Otra Ana')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('muestra los errores de validación por campo que manda la API', async () => {
    mockApi({
      'GET /api/customers': () => [],
      'POST /api/customers': () =>
        Response.json(
          { error: 'Datos inválidos', details: [{ field: 'dni', message: 'El DNI debe tener 7 u 8 dígitos' }] },
          { status: 400 },
        ),
    })
    const user = userEvent.setup()
    render(<CustomersPage />)
    await screen.findByText('No hay clientes que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    await user.type(screen.getByLabelText('Nombre'), 'Ana')
    await user.type(screen.getByLabelText('DNI'), '123')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El DNI debe tener 7 u 8 dígitos')
  })

  it('edita un cliente con sus datos cargados y mantiene su estado', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [ana], 'PUT /api/customers/1': () => ana })
    const user = userEvent.setup()
    render(<CustomersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Ana Pérez' }))
    expect(screen.getByLabelText('DNI')).toHaveValue('30123456')
    expect(screen.getByLabelText('Observaciones')).toHaveValue('Paga los viernes')
    expect(screen.getByLabelText('Autorizado a comprar a crédito')).toBeChecked()
    await user.clear(screen.getByLabelText('Teléfono'))
    await user.type(screen.getByLabelText('Teléfono'), '370 4999999')
    await user.click(screen.getByLabelText('Autorizado a comprar a crédito'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo cliente' })
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Ana Pérez',
      phone: '370 4999999',
      dni: '30123456',
      address: 'España 123',
      locality: 'Formosa', // lo que se edita en el remito no se borra al editar desde la lista
      taxCondition: 'MONOTAX',
      cuit: '27123456789',
      notes: 'Paga los viernes',
      creditAuthorized: false,
      active: true,
    })
  })

  it('al editar un cliente sin datos opcionales, el formulario los muestra vacíos', async () => {
    mockApi({ 'GET /api/customers': () => [beto] })
    const user = userEvent.setup()
    render(<CustomersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Beto Díaz' }))

    expect(screen.getByLabelText('Teléfono')).toHaveValue('')
    expect(screen.getByLabelText('DNI')).toHaveValue('')
    expect(screen.getByLabelText('Autorizado a comprar a crédito')).not.toBeChecked()
  })

  it('cancelar cierra el formulario sin enviar nada', async () => {
    const { calls } = mockApi({ 'GET /api/customers': () => [ana] })
    const user = userEvent.setup()
    render(<CustomersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Ana Pérez' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('heading', { name: 'Editar cliente' })).not.toBeInTheDocument()
    expect(calls.some((c) => c.method !== 'GET')).toBe(false)
  })

  it('da de baja un cliente conservando todos sus datos', async () => {
    const { calls } = mockApi({
      'GET /api/customers': () => [ana],
      'PUT /api/customers/1': () => ({ ...ana, active: false }),
    })
    const user = userEvent.setup()
    render(<CustomersPage />)

    await user.click(await screen.findByRole('button', { name: 'Dar de baja a Ana Pérez' }))

    await waitFor(() => expect(calls.filter((c) => c.path === '/api/customers').length).toBeGreaterThan(1)) // recargó la lista
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Ana Pérez',
      phone: '370 4123456',
      dni: '30123456',
      address: 'España 123',
      locality: 'Formosa',
      taxCondition: 'MONOTAX',
      cuit: '27123456789',
      notes: 'Paga los viernes',
      creditAuthorized: true,
      active: false,
    })
  })

  it('reactiva un cliente de baja; sus datos vacíos se mandan como texto vacío', async () => {
    const { calls } = mockApi({
      'GET /api/customers': () => [{ ...beto, active: false }],
      'PUT /api/customers/2': () => beto,
    })
    const user = userEvent.setup()
    render(<CustomersPage />)

    expect(await screen.findByText('De baja')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivar a Beto Díaz' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ phone: '', dni: '', locality: '', taxCondition: null, cuit: '', active: true })
  })

  it('avisa si falla dar de baja', async () => {
    mockApi({
      'GET /api/customers': () => [ana],
      'PUT /api/customers/1': () => Response.json({ error: 'El cliente no existe' }, { status: 404 }),
    })
    const user = userEvent.setup()
    render(<CustomersPage />)

    await user.click(await screen.findByRole('button', { name: 'Dar de baja a Ana Pérez' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente no existe')
  })

  it('avisa si no hay conexión con el servidor', async () => {
    mockApi({ 'GET /api/customers': () => new Error('red caída') })
    render(<CustomersPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })
})
