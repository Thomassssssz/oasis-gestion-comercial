import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import AuditPage from './AuditPage'

const anotacion = (id: number, extra: object = {}) => ({
  id,
  createdAt: '2026-11-04T15:30:00.000Z',
  userId: 1,
  userName: 'Ana Propietaria',
  action: 'SALE_ANNULLED',
  entityType: 'Sale',
  entityId: 12,
  summary: 'Anuló la venta #12. Motivo: Cargué mal',
  ...extra,
})

describe('AuditPage', () => {
  it('lista quién hizo qué, con la acción en español y el detalle', async () => {
    mockApi({ 'GET /api/audit': () => [anotacion(2), anotacion(1, { action: 'SETTING_CHANGED', userName: 'Beto', summary: 'Cambió el recargo por mora a 7.50%' })] })
    render(<AuditPage />)

    const fila = (await screen.findByText('Anuló la venta #12. Motivo: Cargué mal')).closest('tr')!
    expect(within(fila).getByText('Ana Propietaria')).toBeInTheDocument()
    expect(within(fila).getByText('Venta anulada')).toBeInTheDocument()
    expect(fila).toHaveTextContent(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
    const segunda = screen.getByText('Cambió el recargo por mora a 7.50%').closest('tr')!
    expect(within(segunda).getByText('Beto')).toBeInTheDocument()
    expect(within(segunda).getByText('Cambio de parámetros')).toBeInTheDocument()
  })

  it('pide la lista sin filtros al entrar', async () => {
    const { calls } = mockApi({ 'GET /api/audit': () => [anotacion(1)] })
    render(<AuditPage />)

    await screen.findByText('Venta anulada', { selector: 'td' })
    expect(calls[0]!.query.toString()).toBe('')
  })

  it('una acción que la pantalla no conoce se muestra con su clave', async () => {
    mockApi({ 'GET /api/audit': () => [anotacion(1, { action: 'NUEVA_ACCION', summary: 'Algo nuevo' })] })
    render(<AuditPage />)

    expect(await screen.findByText('NUEVA_ACCION')).toBeInTheDocument()
  })

  it('filtra por acción y por fechas, mandando solo lo que tiene valor', async () => {
    const { calls } = mockApi({ 'GET /api/audit': () => [anotacion(1)] })
    const user = userEvent.setup()
    render(<AuditPage />)
    await screen.findByText('Anuló la venta #12. Motivo: Cargué mal')

    await user.selectOptions(screen.getByLabelText('Acción'), 'Pago de cuenta corriente')
    await waitFor(() => expect(calls.at(-1)!.query.get('action')).toBe('ACCOUNT_PAYMENT_REGISTERED'))
    expect(calls.at(-1)!.query.has('from')).toBe(false)

    await user.type(screen.getByLabelText('Desde'), '2026-11-01')
    await user.type(screen.getByLabelText('Hasta'), '2026-11-30')
    await waitFor(() => {
      const last = calls.at(-1)!.query
      expect([last.get('action'), last.get('from'), last.get('to')]).toEqual(['ACCOUNT_PAYMENT_REGISTERED', '2026-11-01', '2026-11-30'])
    })
  })

  it('ofrece todas las acciones que audita la API como filtro', async () => {
    mockApi({ 'GET /api/audit': () => [] })
    render(<AuditPage />)

    const opciones = within(await screen.findByLabelText('Acción')).getAllByRole('option')
    expect(opciones[0]).toHaveTextContent('Todas')
    expect(opciones).toHaveLength(1 + 14)
  })

  it('"Limpiar filtros" aparece solo con filtros y vuelve a pedir todo', async () => {
    const { calls } = mockApi({ 'GET /api/audit': () => [anotacion(1)] })
    const user = userEvent.setup()
    render(<AuditPage />)
    await screen.findByText('Anuló la venta #12. Motivo: Cargué mal')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Acción'), 'Venta anulada')
    await user.click(await screen.findByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => expect(calls.at(-1)!.query.toString()).toBe(''))
    expect(screen.getByLabelText('Acción')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('un filtro de solo una fecha también muestra el botón de limpiar', async () => {
    mockApi({ 'GET /api/audit': () => [] })
    const user = userEvent.setup()
    render(<AuditPage />)
    await screen.findByText('No hay anotaciones con estos filtros.')

    await user.type(screen.getByLabelText('Hasta'), '2026-11-30')

    expect(await screen.findByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
  })

  it('sin resultados lo dice', async () => {
    mockApi({ 'GET /api/audit': () => [] })
    render(<AuditPage />)

    expect(await screen.findByText('No hay anotaciones con estos filtros.')).toBeInTheDocument()
  })

  it('con 100 anotaciones avisa que son las más nuevas y que hay que filtrar', async () => {
    mockApi({ 'GET /api/audit': () => Array.from({ length: 100 }, (_, i) => anotacion(i + 1, { summary: `Detalle ${i + 1}` })) })
    render(<AuditPage />)

    expect(await screen.findByText(/Se muestran las 100 anotaciones más nuevas/)).toBeInTheDocument()
  })

  it('con menos de 100 no muestra ese aviso', async () => {
    mockApi({ 'GET /api/audit': () => [anotacion(1)] })
    render(<AuditPage />)

    await screen.findByText('Anuló la venta #12. Motivo: Cargué mal')
    expect(screen.queryByText(/Se muestran las 100/)).not.toBeInTheDocument()
  })

  it('muestra el mensaje de la API si rechaza los filtros', async () => {
    mockApi({ 'GET /api/audit': () => Response.json({ error: 'Datos inválidos' }, { status: 400 }) })
    render(<AuditPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Datos inválidos')
  })
})
