import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import CategoriesPage from './CategoriesPage'

describe('CategoriesPage', () => {
  it('muestra las categorías que devuelve la API', async () => {
    mockApi({ 'GET /api/categories': () => [{ id: 1, name: 'Librería' }, { id: 2, name: 'Papelería' }] })
    render(<CategoriesPage />)

    expect(await screen.findByText('Librería')).toBeInTheDocument()
    expect(screen.getByText('Papelería')).toBeInTheDocument()
  })

  it('avisa cuando todavía no hay categorías', async () => {
    mockApi({ 'GET /api/categories': () => [] })
    render(<CategoriesPage />)

    expect(await screen.findByText('Todavía no hay categorías.')).toBeInTheDocument()
  })

  it('crea una categoría, limpia el campo y vuelve a cargar la lista', async () => {
    const lista = [{ id: 1, name: 'Papelería' }]
    const { calls } = mockApi({
      'GET /api/categories': () => lista,
      'POST /api/categories': ({ body }) => {
        lista.push({ id: 2, name: (body as { name: string }).name })
        return { id: 2, name: 'Útiles' }
      },
    })
    const user = userEvent.setup()
    render(<CategoriesPage />)
    await screen.findByText('Papelería')

    await user.type(screen.getByLabelText('Nombre de la nueva categoría'), 'Útiles')
    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    expect(await screen.findByText('Útiles')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Útiles' })
    expect(screen.getByLabelText('Nombre de la nueva categoría')).toHaveValue('')
  })

  it('muestra el mensaje de la API si el nombre ya existe', async () => {
    mockApi({
      'GET /api/categories': () => [{ id: 1, name: 'Papelería' }],
      'POST /api/categories': () => Response.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render(<CategoriesPage />)
    await screen.findByText('Papelería')

    await user.type(screen.getByLabelText('Nombre de la nueva categoría'), 'Papelería')
    await user.click(screen.getByRole('button', { name: 'Agregar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una categoría con ese nombre')
  })

  it('edita el nombre de una categoría', async () => {
    const { calls } = mockApi({
      'GET /api/categories': () => [{ id: 1, name: 'Papeleria' }],
      'PUT /api/categories/1': () => ({ id: 1, name: 'Papelería' }),
    })
    const user = userEvent.setup()
    render(<CategoriesPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Papeleria' }))
    const campo = screen.getByLabelText('Nuevo nombre de la categoría')
    await user.clear(campo)
    await user.type(campo, 'Papelería')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Editar Papeleria' }) // la lista se recargó
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ name: 'Papelería' })
  })

  it('borra una categoría', async () => {
    const { calls } = mockApi({
      'GET /api/categories': () => [{ id: 7, name: 'Papelería' }],
      'DELETE /api/categories/7': () => undefined,
    })
    const user = userEvent.setup()
    render(<CategoriesPage />)

    await user.click(await screen.findByRole('button', { name: 'Borrar Papelería' }))

    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/categories/7')).toBe(true)
  })

  it('muestra el motivo si no se puede borrar porque tiene productos', async () => {
    mockApi({
      'GET /api/categories': () => [{ id: 7, name: 'Papelería' }],
      'DELETE /api/categories/7': () =>
        Response.json({ error: 'No se puede borrar una categoría que tiene productos' }, { status: 409 }),
    })
    const user = userEvent.setup()
    render(<CategoriesPage />)

    await user.click(await screen.findByRole('button', { name: 'Borrar Papelería' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede borrar una categoría que tiene productos')
    expect(screen.getByText('Papelería')).toBeInTheDocument()
  })

  it('avisa si no hay conexión con el servidor', async () => {
    mockApi({ 'GET /api/categories': () => new Error('red caída') })
    render(<CategoriesPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })
})
