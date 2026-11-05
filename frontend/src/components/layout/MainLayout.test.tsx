import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { mockApi } from '@/test/mock-api'

const ana = { id: 1, username: 'ana', fullName: 'Ana Propietaria' }
const KEY = 'oasis.sidebar.collapsed'

const api = {
  'GET /api/auth/me': () => ana,
  'GET /api/health': () => ({ status: 'ok' }),
  'GET /api/products': () => [],
  'GET /api/categories': () => [],
  'GET /api/customers': () => [],
}

async function renderAt(path = '/productos') {
  mockApi(api)
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('navigation', { name: 'Secciones' })
}

const sidebar = () => document.getElementById('sidebar')!

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('barra lateral', () => {
  it('muestra las seis secciones, cada una con su ícono y su dirección', async () => {
    await renderAt()

    const links = within(screen.getByRole('navigation', { name: 'Secciones' })).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Productos', 'Categorías', 'Inventario', 'Ventas', 'Clientes', 'Configuración'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/productos',
      '/categorias',
      '/inventario',
      '/ventas',
      '/clientes',
      '/configuracion',
    ])
    links.forEach((link) => expect(link.querySelector('svg')).not.toBeNull())
  })

  it('no ofrece Proveedores ni Compras: no van en la app', async () => {
    await renderAt()

    expect(screen.queryByRole('link', { name: /proveedor|compra/i })).not.toBeInTheDocument()
  })

  it('marca la sección donde estás', async () => {
    await renderAt('/clientes')

    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Productos' })).not.toHaveAttribute('aria-current')
  })

  it('al tocar una sección, cambia de pantalla', async () => {
    await renderAt()

    fireEvent.click(screen.getByRole('link', { name: 'Clientes' }))

    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('barra lateral: achicar y expandir (pantallas grandes)', () => {
  it('arranca expandida y se achica con el botón, sin perder los nombres para los lectores de pantalla', async () => {
    const user = userEvent.setup()
    await renderAt()
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Ventas' })).not.toHaveAttribute('title')

    await user.click(screen.getByRole('button', { name: 'Contraer menú' }))

    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Ventas' })).toHaveAttribute('title', 'Ventas') // globito al pasar el mouse
    expect(screen.getByText('Ventas')).toHaveClass('md:sr-only')
    expect(sidebar()).toHaveClass('md:w-16')
  })

  it('vuelve a expandirse con el mismo botón', async () => {
    const user = userEvent.setup()
    await renderAt()

    await user.click(screen.getByRole('button', { name: 'Contraer menú' }))
    await user.click(screen.getByRole('button', { name: 'Expandir menú' }))

    expect(screen.getByRole('button', { name: 'Contraer menú' })).toBeInTheDocument()
    expect(screen.getByText('Ventas')).not.toHaveClass('md:sr-only')
    expect(sidebar()).not.toHaveClass('md:w-16')
  })

  it('recuerda la preferencia en el navegador', async () => {
    const user = userEvent.setup()
    await renderAt()

    await user.click(screen.getByRole('button', { name: 'Contraer menú' }))
    expect(localStorage.getItem(KEY)).toBe('true')

    await user.click(screen.getByRole('button', { name: 'Expandir menú' }))
    expect(localStorage.getItem(KEY)).toBe('false')
  })

  it('si quedó angosta la última vez, arranca angosta', async () => {
    localStorage.setItem(KEY, 'true')

    await renderAt()

    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument()
    expect(sidebar()).toHaveClass('md:w-16')
  })

  it('si el navegador no deja guardar la preferencia, la barra funciona igual', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const user = userEvent.setup()
    await renderAt()
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Contraer menú' }))

    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument()
  })
})

describe('barra lateral: pantallas chicas', () => {
  it('arranca cerrada y se abre con el botón Menú', async () => {
    const user = userEvent.setup()
    await renderAt()
    expect(sidebar()).toHaveAttribute('data-state', 'closed')
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(sidebar()).toHaveAttribute('data-state', 'open')
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('se cierra con el botón de cerrar', async () => {
    const user = userEvent.setup()
    await renderAt()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }))

    expect(sidebar()).toHaveAttribute('data-state', 'closed')
  })

  it('se cierra con la tecla Escape', async () => {
    const user = userEvent.setup()
    await renderAt()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    await user.keyboard('{Escape}')

    expect(sidebar()).toHaveAttribute('data-state', 'closed')
  })

  it('se cierra al tocar el fondo oscuro', async () => {
    const user = userEvent.setup()
    await renderAt()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    await user.click(document.querySelector('.bg-black\\/30')!)

    expect(sidebar()).toHaveAttribute('data-state', 'closed')
    expect(document.querySelector('.bg-black\\/30')).toBeNull()
  })

  it('al elegir una sección, se cierra sola y muestra esa pantalla', async () => {
    const user = userEvent.setup()
    await renderAt()
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    await user.click(screen.getByRole('link', { name: 'Categorías' }))

    expect(await screen.findByRole('heading', { name: 'Categorías' })).toBeInTheDocument()
    expect(sidebar()).toHaveAttribute('data-state', 'closed')
  })

  it('achicar la barra en pantalla grande no la abre en la chica', async () => {
    const user = userEvent.setup()
    await renderAt()

    await user.click(screen.getByRole('button', { name: 'Contraer menú' }))

    expect(sidebar()).toHaveAttribute('data-state', 'closed')
  })
})
