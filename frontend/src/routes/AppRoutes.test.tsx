import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { mockApi } from '@/test/mock-api'

const ana = { id: 1, username: 'ana', fullName: 'Ana Propietaria' }
const unauthorized = () => Response.json({ error: 'No hay una sesión abierta' }, { status: 401 })

// Rutas que necesita la app una vez dentro del sistema.
const screens = {
  'GET /api/health': () => ({ status: 'ok' }),
  'GET /api/products': () => [],
  'GET /api/categories': () => [],
  'GET /api/customers': () => [],
  'GET /api/accounts': () => [],
  'GET /api/audit': () => [],
  'GET /api/reports/debt': () => ({ totalBalance: '0.00', totalPayable: '0.00', accounts: [] }),
  'GET /api/reports/sales': () => ({
    from: '2026-10-06',
    to: '2026-11-04',
    totals: { count: 0, total: '0.00', average: '0.00' },
    byDay: [],
    byPaymentMethod: [],
    topProducts: [],
  }),
  'GET /api/settings': () => ({ lateFeePercent: '5.00', updatedAt: '2026-11-04T12:00:00.000Z', updatedBy: null }),
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function fillLogin(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: username } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('rutas y sesión', () => {
  it('muestra "Cargando" mientras pregunta si hay una sesión abierta', () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/productos')

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
  })

  it('sin sesión, una pantalla protegida manda al login', async () => {
    mockApi({ 'GET /api/auth/me': unauthorized, ...screens })
    renderAt('/productos')

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Productos' })).not.toBeInTheDocument()
  })

  it('con sesión abierta, entra directo y muestra el nombre del usuario', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/productos')

    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument()
    expect(screen.getByText('Ana Propietaria')).toBeInTheDocument()
  })

  it('con sesión abierta, el login redirige al sistema', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument()
  })

  it('la raíz lleva a Productos', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument()
  })

  it('la sección Clientes está en el menú y lleva a su pantalla', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/productos')

    fireEvent.click(await screen.findByRole('link', { name: 'Clientes' }))

    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
  })

  it('sin sesión, /clientes manda al login', async () => {
    mockApi({ 'GET /api/auth/me': unauthorized, ...screens })
    renderAt('/clientes')

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('la sección Configuración está en el menú y lleva a su pantalla', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/productos')

    fireEvent.click(await screen.findByRole('link', { name: 'Configuración' }))

    expect(await screen.findByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
  })

  it('la sección Cuentas corrientes está en el menú y lleva a su pantalla', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/productos')

    fireEvent.click(await screen.findByRole('link', { name: 'Cuentas corrientes' }))

    expect(await screen.findByRole('heading', { name: 'Cuentas corrientes' })).toBeInTheDocument()
  })

  it('la sección Reportes está en el menú y lleva a su pantalla', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/productos')

    fireEvent.click(await screen.findByRole('link', { name: 'Reportes' }))

    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument()
  })

  it('la sección Auditoría está en el menú y lleva a su pantalla', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/productos')

    fireEvent.click(await screen.findByRole('link', { name: 'Auditoría' }))

    expect(await screen.findByRole('heading', { name: 'Auditoría' })).toBeInTheDocument()
  })

  it('una dirección que no existe muestra "Página no encontrada"', async () => {
    mockApi({ 'GET /api/auth/me': () => ana, ...screens })
    renderAt('/no-existe')

    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })

  it('al ingresar con datos correctos manda usuario y contraseña y entra al sistema', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': unauthorized,
      'POST /api/auth/login': () => ana,
      ...screens,
    })
    renderAt('/productos')

    await screen.findByRole('button', { name: 'Ingresar' })
    fillLogin('  ana ', 'clave-larga-123')

    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument()
    const loginCall = calls.find((call) => call.path === '/api/auth/login')
    expect(loginCall?.body).toEqual({ username: 'ana', password: 'clave-larga-123' })
  })

  it('con credenciales incorrectas muestra el mensaje de la API y se queda en el login', async () => {
    mockApi({
      'GET /api/auth/me': unauthorized,
      'POST /api/auth/login': () => Response.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 }),
      ...screens,
    })
    renderAt('/login')

    await screen.findByRole('button', { name: 'Ingresar' })
    fillLogin('ana', 'mala')

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos')
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled()
  })

  it('con demasiados intentos muestra el aviso de la API', async () => {
    mockApi({
      'GET /api/auth/me': unauthorized,
      'POST /api/auth/login': () => Response.json({ error: 'Demasiados intentos. Probá más tarde.' }, { status: 429 }),
      ...screens,
    })
    renderAt('/login')

    await screen.findByRole('button', { name: 'Ingresar' })
    fillLogin('ana', 'mala')

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos')
  })

  it('si no hay conexión con la API muestra un mensaje general', async () => {
    mockApi({
      'GET /api/auth/me': unauthorized,
      'POST /api/auth/login': () => new Error('red caída'),
      ...screens,
    })
    renderAt('/login')

    await screen.findByRole('button', { name: 'Ingresar' })
    fillLogin('ana', 'clave-larga-123')

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar sesión')
  })

  it('al tocar "Salir" cierra la sesión en la API y vuelve al login', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': () => ana,
      'POST /api/auth/logout': () => undefined,
      ...screens,
    })
    renderAt('/productos')

    await screen.findByRole('heading', { name: 'Productos' })
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/auth/logout')).toBe(true)
  })

  it('si falla el pedido de logout, igual vuelve al login', async () => {
    mockApi({
      'GET /api/auth/me': () => ana,
      'POST /api/auth/logout': () => new Error('red caída'),
      ...screens,
    })
    renderAt('/productos')

    await screen.findByRole('heading', { name: 'Productos' })
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('si la sesión vence mientras se usa el sistema, vuelve al login', async () => {
    let expired = false
    mockApi({
      'GET /api/auth/me': () => ana,
      'GET /api/health': () => ({ status: 'ok' }),
      'GET /api/products': () => (expired ? unauthorized() : []),
      'GET /api/categories': () => (expired ? unauthorized() : []),
    })
    renderAt('/productos')

    await screen.findByRole('heading', { name: 'Productos' })
    expired = true
    fireEvent.click(screen.getByRole('link', { name: 'Categorías' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument())
  })
})
