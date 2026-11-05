import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import SuppliersPage from './SuppliersPage'

const sur = {
  id: 1,
  name: 'Papelera Sur',
  phone: '370 4123456',
  email: 'ventas@sur.com',
  address: 'Av. 25 de Mayo 456',
  notes: 'Entrega los martes',
  active: true,
  createdAt: '2026-11-04T12:00:00.000Z',
  updatedAt: '2026-11-04T12:00:00.000Z',
}

const zeta = { ...sur, id: 2, name: 'Zeta Mayorista', phone: null, email: null, address: null, notes: null }

describe('SuppliersPage', () => {
  it('muestra los proveedores con email, teléfono y estado; lo que falta se ve como guion', async () => {
    mockApi({ 'GET /api/suppliers': () => [sur, zeta] })
    render(<SuppliersPage />)

    const filaSur = (await screen.findByText('Papelera Sur')).closest('tr')!
    const filaZeta = screen.getByText('Zeta Mayorista').closest('tr')!
    expect(filaSur).toHaveTextContent('ventas@sur.com')
    expect(filaSur).toHaveTextContent('370 4123456')
    expect(filaSur).toHaveTextContent('Av. 25 de Mayo 456')
    expect(filaSur).toHaveTextContent('Entrega los martes')
    expect(within(filaSur).getByText('Activo')).toBeInTheDocument()
    expect(within(filaZeta).getAllByText('—')).toHaveLength(2)
  })

  it('pide por defecto solo los proveedores activos', async () => {
    const { calls } = mockApi({ 'GET /api/suppliers': () => [] })
    render(<SuppliersPage />)

    await screen.findByText('No hay proveedores que coincidan.')
    const pedido = calls.find((c) => c.path === '/api/suppliers')!
    expect(pedido.query.get('active')).toBe('true')
    expect(pedido.query.has('search')).toBe(false)
  })

  it('manda la búsqueda (sin espacios sobrantes) y el filtro de estado a la API', async () => {
    const { calls } = mockApi({ 'GET /api/suppliers': () => [] })
    const user = userEvent.setup()
    render(<SuppliersPage />)
    await screen.findByText('No hay proveedores que coincidan.')

    await user.type(screen.getByLabelText('Buscar proveedor'), '  sur ')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Todos')

    let ultimo = calls.filter((c) => c.path === '/api/suppliers').at(-1)!
    expect(ultimo.query.get('search')).toBe('sur')
    expect(ultimo.query.has('active')).toBe(false)

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Dados de baja')

    ultimo = calls.filter((c) => c.path === '/api/suppliers').at(-1)!
    expect(ultimo.query.get('active')).toBe('false')
  })

  it('crea un proveedor con todos sus datos y vuelve a pedir la lista', async () => {
    let proveedores: object[] = []
    const { calls } = mockApi({
      'GET /api/suppliers': () => proveedores,
      'POST /api/suppliers': () => {
        proveedores = [sur]
        return sur
      },
    })
    const user = userEvent.setup()
    render(<SuppliersPage />)
    await screen.findByText('No hay proveedores que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    await user.type(screen.getByLabelText('Nombre'), 'Papelera Sur')
    await user.type(screen.getByLabelText('Teléfono'), '370 4123456')
    await user.type(screen.getByLabelText('Email'), 'ventas@sur.com')
    await user.type(screen.getByLabelText('Dirección'), 'Av. 25 de Mayo 456')
    await user.type(screen.getByLabelText('Observaciones'), 'Entrega los martes')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Papelera Sur')).toBeInTheDocument() // el formulario se cerró y la lista se recargó
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      name: 'Papelera Sur',
      phone: '370 4123456',
      email: 'ventas@sur.com',
      address: 'Av. 25 de Mayo 456',
      notes: 'Entrega los martes',
    })
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/suppliers')).toHaveLength(2)
  })

  it('solo el nombre es necesario: lo demás se manda vacío', async () => {
    const { calls } = mockApi({ 'GET /api/suppliers': () => [], 'POST /api/suppliers': () => zeta })
    const user = userEvent.setup()
    render(<SuppliersPage />)
    await screen.findByText('No hay proveedores que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    await user.type(screen.getByLabelText('Nombre'), 'Zeta Mayorista')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo proveedor' })
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      name: 'Zeta Mayorista',
      phone: '',
      email: '',
      address: '',
      notes: '',
    })
  })

  it('muestra el error de la API (nombre repetido) y deja el formulario abierto con lo escrito', async () => {
    mockApi({
      'GET /api/suppliers': () => [],
      'POST /api/suppliers': () => Response.json({ error: 'Ya existe un proveedor con ese nombre' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render(<SuppliersPage />)
    await screen.findByText('No hay proveedores que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    await user.type(screen.getByLabelText('Nombre'), 'Papelera Sur')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un proveedor con ese nombre')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Papelera Sur')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('muestra los errores de validación por campo que manda la API (email inválido)', async () => {
    mockApi({
      'GET /api/suppliers': () => [],
      'POST /api/suppliers': () =>
        Response.json(
          { error: 'Datos inválidos', details: [{ field: 'email', message: 'El email no es válido' }] },
          { status: 400 },
        ),
    })
    const user = userEvent.setup()
    render(<SuppliersPage />)
    await screen.findByText('No hay proveedores que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo proveedor' }))
    await user.type(screen.getByLabelText('Nombre'), 'Papelera')
    await user.type(screen.getByLabelText('Email'), 'sin-arroba')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El email no es válido')
  })

  it('edita un proveedor con sus datos cargados y mantiene su estado', async () => {
    const { calls } = mockApi({ 'GET /api/suppliers': () => [sur], 'PUT /api/suppliers/1': () => sur })
    const user = userEvent.setup()
    render(<SuppliersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Papelera Sur' }))
    expect(screen.getByLabelText('Email')).toHaveValue('ventas@sur.com')
    expect(screen.getByLabelText('Observaciones')).toHaveValue('Entrega los martes')
    await user.clear(screen.getByLabelText('Teléfono'))
    await user.type(screen.getByLabelText('Teléfono'), '370 4999999')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo proveedor' })
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Papelera Sur',
      phone: '370 4999999',
      email: 'ventas@sur.com',
      address: 'Av. 25 de Mayo 456',
      notes: 'Entrega los martes',
      active: true,
    })
  })

  it('editar a un proveedor dado de baja no lo reactiva', async () => {
    const { calls } = mockApi({
      'GET /api/suppliers': () => [{ ...sur, active: false }],
      'PUT /api/suppliers/1': () => sur,
    })
    const user = userEvent.setup()
    render(<SuppliersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Papelera Sur' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo proveedor' })
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ active: false })
  })

  it('cancelar cierra el formulario sin enviar nada', async () => {
    const { calls } = mockApi({ 'GET /api/suppliers': () => [sur] })
    const user = userEvent.setup()
    render(<SuppliersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Papelera Sur' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('heading', { name: 'Editar proveedor' })).not.toBeInTheDocument()
    expect(calls.some((c) => c.method !== 'GET')).toBe(false)
  })

  it('da de baja un proveedor conservando todos sus datos', async () => {
    const { calls } = mockApi({
      'GET /api/suppliers': () => [sur],
      'PUT /api/suppliers/1': () => ({ ...sur, active: false }),
    })
    const user = userEvent.setup()
    render(<SuppliersPage />)

    await user.click(await screen.findByRole('button', { name: 'Dar de baja a Papelera Sur' }))

    await waitFor(() => expect(calls.filter((c) => c.path === '/api/suppliers').length).toBeGreaterThan(1)) // recargó la lista
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Papelera Sur',
      phone: '370 4123456',
      email: 'ventas@sur.com',
      address: 'Av. 25 de Mayo 456',
      notes: 'Entrega los martes',
      active: false,
    })
  })

  it('reactiva un proveedor de baja; sus datos vacíos se mandan como texto vacío', async () => {
    const { calls } = mockApi({
      'GET /api/suppliers': () => [{ ...zeta, active: false }],
      'PUT /api/suppliers/2': () => zeta,
    })
    const user = userEvent.setup()
    render(<SuppliersPage />)

    expect(await screen.findByText('De baja')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivar a Zeta Mayorista' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true))
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ phone: '', email: '', active: true })
  })

  it('avisa si falla dar de baja', async () => {
    mockApi({
      'GET /api/suppliers': () => [sur],
      'PUT /api/suppliers/1': () => Response.json({ error: 'El proveedor no existe' }, { status: 404 }),
    })
    const user = userEvent.setup()
    render(<SuppliersPage />)

    await user.click(await screen.findByRole('button', { name: 'Dar de baja a Papelera Sur' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El proveedor no existe')
  })

  it('avisa si no hay conexión con el servidor', async () => {
    mockApi({ 'GET /api/suppliers': () => new Error('red caída') })
    render(<SuppliersPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })
})
