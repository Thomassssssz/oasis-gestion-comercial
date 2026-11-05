import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import InventoryPage from './InventoryPage'

const producto = (id: number, name: string, extra: object = {}) => ({
  id,
  name,
  categoryId: 1,
  category: { id: 1, name: 'Papelería' },
  salePrice: '100.00',
  minStock: 2,
  active: true,
  stock: 8,
  lowStock: false,
  ...extra,
})
const cuaderno = producto(10, 'Cuaderno A4')
const lapiz = producto(11, 'Lápiz negro', { stock: 0, lowStock: true, active: false })

const movimiento = (id: number, extra: object = {}) => ({
  id,
  productId: 10,
  productName: 'Cuaderno A4',
  type: 'INITIAL_STOCK',
  quantity: 10,
  reason: null,
  note: null,
  userId: 1,
  userName: 'Ana Propietaria',
  createdAt: '2026-11-04T15:30:00.000Z',
  ...extra,
})

const baseRoutes = {
  'GET /api/products': () => [cuaderno, lapiz],
  'GET /api/stock-movements': () => [],
}

describe('InventoryPage', () => {
  it('muestra el historial con tipo, cantidad con signo, motivo, nota y quién lo registró', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/stock-movements': () => [
        movimiento(2, { type: 'ADJUSTMENT', quantity: -3, reason: 'DAMAGE_OR_LOSS', note: 'Se mojaron' }),
        movimiento(1),
      ],
    })
    render(<InventoryPage />)

    const ajuste = (await screen.findByText('Rotura o pérdida')).closest('tr')!
    expect(within(ajuste).getByText('Ajuste')).toBeInTheDocument()
    expect(within(ajuste).getByText('-3')).toBeInTheDocument()
    expect(within(ajuste).getByText('Se mojaron')).toBeInTheDocument()
    expect(within(ajuste).getByText('Ana Propietaria')).toBeInTheDocument()

    const inicial = screen.getByText('Stock inicial').closest('tr')!
    expect(within(inicial).getByText('+10')).toBeInTheDocument()
    expect(inicial).toHaveTextContent('Cuaderno A4')
  })

  it('muestra un mensaje cuando todavía no hay movimientos', async () => {
    mockApi(baseRoutes)
    render(<InventoryPage />)

    expect(await screen.findByText('Todavía no hay movimientos de stock.')).toBeInTheDocument()
  })

  it('filtra el historial por producto', async () => {
    const { calls } = mockApi(baseRoutes)
    const user = userEvent.setup()
    render(<InventoryPage />)
    await screen.findByText('Todavía no hay movimientos de stock.')
    expect(calls.find((c) => c.path === '/api/stock-movements')?.query.has('productId')).toBe(false)

    await user.selectOptions(await screen.findByLabelText('Filtrar por producto'), 'Cuaderno A4')

    await waitFor(() =>
      expect(calls.filter((c) => c.path === '/api/stock-movements').at(-1)!.query.get('productId')).toBe('10'),
    )
  })

  it('muestra el error si no se puede cargar el historial', async () => {
    mockApi({ ...baseRoutes, 'GET /api/stock-movements': () => Response.json({ error: 'Falló la base' }, { status: 500 }) })
    render(<InventoryPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la base')
  })

  describe('formulario', () => {
    async function abrirFormulario() {
      const user = userEvent.setup()
      render(<InventoryPage />)
      await user.click(await screen.findByRole('button', { name: 'Nuevo movimiento' }))
      // Espera a que los productos estén cargados en el desplegable.
      await screen.findByRole('option', { name: 'Cuaderno A4 (stock 8)' })
      return user
    }

    it('lista los productos con su stock y marca los dados de baja', async () => {
      mockApi(baseRoutes)
      await abrirFormulario()

      expect(screen.getByRole('option', { name: 'Cuaderno A4 (stock 8)' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Lápiz negro (stock 0) – de baja' })).toBeInTheDocument()
    })

    it('registra el stock inicial: manda los datos correctos, cierra el formulario y recarga el historial', async () => {
      let historial: object[] = []
      const { calls } = mockApi({
        ...baseRoutes,
        'GET /api/stock-movements': () => historial,
        'POST /api/stock-movements': () => {
          historial = [movimiento(1)]
          return { ...movimiento(1), stock: 10 }
        },
      })
      const user = await abrirFormulario()

      expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument()
      await user.selectOptions(screen.getByLabelText('Producto'), 'Cuaderno A4 (stock 8)')
      await user.type(screen.getByLabelText(/^Cantidad/), '10')
      await user.click(screen.getByRole('button', { name: 'Registrar' }))

      expect(await screen.findByText('+10')).toBeInTheDocument()
      const envio = calls.find((c) => c.method === 'POST')!
      expect(envio.body).toEqual({ type: 'INITIAL_STOCK', productId: 10, quantity: 10 })
      expect(screen.queryByRole('heading', { name: 'Nuevo movimiento de stock' })).not.toBeInTheDocument()
    })

    it('registra un ajuste negativo con motivo y nota', async () => {
      const { calls } = mockApi({ ...baseRoutes, 'POST /api/stock-movements': () => ({ ...movimiento(5), stock: 5 }) })
      const user = await abrirFormulario()

      await user.selectOptions(screen.getByLabelText('Producto'), 'Cuaderno A4 (stock 8)')
      await user.selectOptions(screen.getByLabelText('Tipo de movimiento'), 'Ajuste')
      await user.type(screen.getByLabelText(/^Cantidad/), '-3')
      await user.selectOptions(screen.getByLabelText('Motivo'), 'Rotura o pérdida')
      await user.type(screen.getByLabelText(/^Nota/), '  Se mojaron  ')
      await user.click(screen.getByRole('button', { name: 'Registrar' }))

      await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
      expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
        type: 'ADJUSTMENT',
        productId: 10,
        quantity: -3,
        reason: 'DAMAGE_OR_LOSS',
        note: 'Se mojaron',
      })
    })

    it('ofrece los cuatro motivos de la lista fija y pide la nota con "Otro"', async () => {
      mockApi(baseRoutes)
      const user = await abrirFormulario()
      await user.selectOptions(screen.getByLabelText('Tipo de movimiento'), 'Ajuste')

      const motivos = within(screen.getByLabelText('Motivo')).getAllByRole('option').map((o) => o.textContent)
      expect(motivos).toEqual(['Conteo físico', 'Rotura o pérdida', 'Devolución a proveedor', 'Otro'])
      expect(screen.getByLabelText(/^Nota/)).toHaveAccessibleName(/opcional/)

      await user.selectOptions(screen.getByLabelText('Motivo'), 'Otro')

      expect(screen.getByLabelText(/^Nota/)).toHaveAccessibleName(/obligatoria/)
    })

    it('muestra el mensaje de la API si rechaza el movimiento y deja el formulario abierto', async () => {
      mockApi({
        ...baseRoutes,
        'POST /api/stock-movements': () =>
          Response.json({ error: 'El ajuste dejaría el stock en negativo (stock actual: 8)' }, { status: 409 }),
      })
      const user = await abrirFormulario()

      await user.selectOptions(screen.getByLabelText('Producto'), 'Cuaderno A4 (stock 8)')
      await user.selectOptions(screen.getByLabelText('Tipo de movimiento'), 'Ajuste')
      await user.type(screen.getByLabelText(/^Cantidad/), '-20')
      await user.click(screen.getByRole('button', { name: 'Registrar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('dejaría el stock en negativo (stock actual: 8)')
      expect(screen.getByRole('button', { name: 'Registrar' })).toBeEnabled()
      expect(screen.getByRole('heading', { name: 'Nuevo movimiento de stock' })).toBeInTheDocument()
    })

    it('muestra los errores de validación de la API', async () => {
      mockApi({
        ...baseRoutes,
        'POST /api/stock-movements': () =>
          Response.json({ error: 'Datos inválidos', details: [{ field: 'productId', message: 'El producto no es válido' }] }, { status: 400 }),
      })
      const user = await abrirFormulario()

      await user.type(screen.getByLabelText(/^Cantidad/), '5')
      await user.click(screen.getByRole('button', { name: 'Registrar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('El producto no es válido')
    })

    it('Cancelar cierra el formulario sin enviar nada', async () => {
      const { calls } = mockApi(baseRoutes)
      const user = await abrirFormulario()

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('heading', { name: 'Nuevo movimiento de stock' })).not.toBeInTheDocument()
      expect(calls.some((c) => c.method === 'POST')).toBe(false)
    })
  })
})
