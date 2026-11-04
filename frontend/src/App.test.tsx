import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

// Simula la respuesta del navegador a fetch(), sin llamar a un servidor real.
function mockFetch(response: Response | Error) {
  const fetchMock =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('App', () => {
  it('muestra el título del sistema', () => {
    mockFetch(Response.json({ status: 'ok' }))
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Oasis – Gestión Comercial' }),
    ).toBeInTheDocument()
  })

  it('muestra "Consultando" mientras espera la respuesta', () => {
    mockFetch(Response.json({ status: 'ok' }))
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Consultando la API…')
  })

  it('muestra "API conectada" cuando la API responde ok', async () => {
    const fetchMock = mockFetch(Response.json({ status: 'ok' }))
    render(<App />)

    expect(await screen.findByText('API conectada')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/health')
  })

  it('muestra "Sin conexión" cuando la API no responde', async () => {
    mockFetch(new Error('red caída'))
    render(<App />)

    expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument()
  })

  it('muestra "Sin conexión" cuando la API responde 200 pero con un estado distinto de ok', async () => {
    mockFetch(Response.json({ status: 'caido' }))
    render(<App />)

    expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument()
  })

  it('muestra "Sin conexión" cuando la API responde con un error', async () => {
    mockFetch(new Response('fallo', { status: 500 }))
    render(<App />)

    expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument()
  })
})
