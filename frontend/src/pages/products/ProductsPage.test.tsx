import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import ProductsPage from './ProductsPage'

const categorias = [
  { id: 1, name: 'Librería' },
  { id: 2, name: 'Papelería' },
]

const cuaderno = {
  id: 10,
  name: 'Cuaderno A4',
  categoryId: 2,
  category: { id: 2, name: 'Papelería' },
  salePrice: '1500.50',
  minStock: 5,
  active: true,
}

describe('ProductsPage', () => {
  it('muestra los productos con su categoría, precio en pesos y estado', async () => {
    mockApi({ 'GET /api/categories': () => categorias, 'GET /api/products': () => [cuaderno] })
    render(<ProductsPage />)

    const fila = (await screen.findByText('Cuaderno A4')).closest('tr')!
    expect(within(fila).getByText('Papelería')).toBeInTheDocument()
    expect(fila).toHaveTextContent(/\$\s?1\.500,50/)
    expect(within(fila).getByText('Activo')).toBeInTheDocument()
  })

  it('pide por defecto solo los productos activos', async () => {
    const { calls } = mockApi({ 'GET /api/categories': () => categorias, 'GET /api/products': () => [] })
    render(<ProductsPage />)

    await screen.findByText('No hay productos que coincidan.')
    expect(calls.find((c) => c.path === '/api/products')?.query.get('active')).toBe('true')
  })

  it('manda los filtros de búsqueda, categoría y estado a la API', async () => {
    const { calls } = mockApi({ 'GET /api/categories': () => categorias, 'GET /api/products': () => [] })
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByText('No hay productos que coincidan.')

    await user.type(screen.getByLabelText('Buscar producto'), 'lapi')
    await user.selectOptions(screen.getByLabelText('Filtrar por categoría'), 'Papelería')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'Todos')

    const ultimo = calls.filter((c) => c.path === '/api/products').at(-1)!
    expect(ultimo.query.get('search')).toBe('lapi')
    expect(ultimo.query.get('categoryId')).toBe('2')
    expect(ultimo.query.has('active')).toBe(false)
  })

  it('crea un producto: acepta coma decimal y manda los datos correctos', async () => {
    const { calls } = mockApi({
      'GET /api/categories': () => categorias,
      'GET /api/products': () => [],
      'POST /api/products': () => cuaderno,
    })
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByText('No hay productos que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre'), 'Cuaderno A4')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'Papelería')
    await user.type(screen.getByLabelText('Precio de venta'), '1500,50')
    await user.clear(screen.getByLabelText('Stock mínimo'))
    await user.type(screen.getByLabelText('Stock mínimo'), '5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo producto' }) // el formulario se cerró
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      name: 'Cuaderno A4',
      categoryId: 2,
      salePrice: '1500.50',
      minStock: 5,
    })
  })

  it('muestra los errores de validación que manda la API y deja el formulario abierto', async () => {
    mockApi({
      'GET /api/categories': () => categorias,
      'GET /api/products': () => [],
      'POST /api/products': () =>
        Response.json(
          { error: 'Datos inválidos', details: [{ field: 'salePrice', message: 'El precio debe ser mayor que cero' }] },
          { status: 400 },
        ),
    })
    const user = userEvent.setup()
    render(<ProductsPage />)
    await screen.findByText('No hay productos que coincidan.')

    await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    await user.type(screen.getByLabelText('Nombre'), 'Goma')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El precio debe ser mayor que cero')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Goma')
  })

  it('edita un producto manteniendo su estado activo', async () => {
    const { calls } = mockApi({
      'GET /api/categories': () => categorias,
      'GET /api/products': () => [cuaderno],
      'PUT /api/products/10': () => cuaderno,
    })
    const user = userEvent.setup()
    render(<ProductsPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar Cuaderno A4' }))
    expect(screen.getByLabelText('Precio de venta')).toHaveValue('1500.50')
    await user.clear(screen.getByLabelText('Precio de venta'))
    await user.type(screen.getByLabelText('Precio de venta'), '1800')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('button', { name: 'Nuevo producto' })
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Cuaderno A4',
      categoryId: 2,
      salePrice: '1800',
      minStock: 5,
      active: true,
    })
  })

  it('da de baja un producto con "Dar de baja"', async () => {
    const { calls } = mockApi({
      'GET /api/categories': () => categorias,
      'GET /api/products': () => [cuaderno],
      'PUT /api/products/10': () => ({ ...cuaderno, active: false }),
    })
    const user = userEvent.setup()
    render(<ProductsPage />)

    await user.click(await screen.findByRole('button', { name: 'Dar de baja' }))

    await screen.findByRole('button', { name: 'Dar de baja' })
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ active: false, salePrice: '1500.50' })
  })

  it('ofrece "Reactivar" para un producto dado de baja', async () => {
    mockApi({
      'GET /api/categories': () => categorias,
      'GET /api/products': () => [{ ...cuaderno, active: false }],
    })
    render(<ProductsPage />)

    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument()
    expect(screen.getByText('De baja')).toBeInTheDocument()
  })

  it('avisa si no hay conexión con el servidor', async () => {
    mockApi({ 'GET /api/categories': () => new Error('red caída'), 'GET /api/products': () => new Error('red caída') })
    render(<ProductsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })
})
