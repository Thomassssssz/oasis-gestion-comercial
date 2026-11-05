import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'
import { mockApi } from './test/mock-api.ts'

// Rutas de las pantallas y de la sesión (usuario ya logueado), para que la app cargue mientras se prueba el estado de la API.
const screens = {
  'GET /api/auth/me': () => ({ id: 1, username: 'ana', fullName: 'Ana Propietaria' }),
  'GET /api/products': () => [],
  'GET /api/categories': () => [],
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('muestra el título del sistema', async () => {
    mockApi({ 'GET /api/health': () => ({ status: 'ok' }), ...screens })
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Oasis – Gestión Comercial', level: 1 })).toBeInTheDocument()
  })

  it('muestra "Consultando" mientras espera la respuesta', async () => {
    mockApi({ 'GET /api/health': () => ({ status: 'ok' }), ...screens })
    renderApp()

    expect(await screen.findByText('Consultando la API…')).toBeInTheDocument()
  })

  it('muestra "API conectada" cuando la API responde ok', async () => {
    const { calls } = mockApi({ 'GET /api/health': () => ({ status: 'ok' }), ...screens })
    renderApp()

    expect(await screen.findByText('API conectada')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/health')).toBe(true)
  })

  it('muestra "Sin conexión" cuando la API no responde', async () => {
    mockApi({ 'GET /api/health': () => new Error('red caída'), ...screens })
    renderApp()

    expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument()
  })

  it('muestra "Sin conexión" cuando la API responde 200 pero con un estado distinto de ok', async () => {
    mockApi({ 'GET /api/health': () => ({ status: 'caido' }), ...screens })
    renderApp()

    expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument()
  })

  it('muestra "Sin conexión" cuando la API responde con un error', async () => {
    mockApi({ 'GET /api/health': () => new Response('fallo', { status: 500 }), ...screens })
    renderApp()

    expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument()
  })

  it('no muestra el botón "Reintentar" cuando la API está conectada', async () => {
    mockApi({ 'GET /api/health': () => ({ status: 'ok' }), ...screens })
    renderApp()

    await screen.findByText('API conectada')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('vuelve a consultar y se conecta al tocar "Reintentar"', async () => {
    let healthCalls = 0
    mockApi({
      'GET /api/health': () => (++healthCalls === 1 ? new Error('red caída') : { status: 'ok' }),
      ...screens,
    })
    renderApp()

    await screen.findByText('Sin conexión con la API')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('API conectada')).toBeInTheDocument()
    expect(healthCalls).toBe(2)
  })

  it('empieza en Productos y permite pasar a Categorías', async () => {
    mockApi({ 'GET /api/health': () => ({ status: 'ok' }), ...screens })
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Categorías' }))

    expect(await screen.findByRole('heading', { name: 'Categorías' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Categorías' })).toHaveAttribute('aria-current', 'page')
  })
})
