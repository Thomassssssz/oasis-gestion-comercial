import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import SettingsPage from './SettingsPage'

const porDefecto = { lateFeePercent: '5.00', updatedAt: '2026-11-04T12:00:00.000Z', updatedBy: null }
const cambiado = {
  lateFeePercent: '7.50',
  updatedAt: '2026-11-04T15:30:00.000Z',
  updatedBy: { id: 1, fullName: 'Ana Propietaria' },
}

describe('SettingsPage: recargo por mora', () => {
  it('muestra el porcentaje con coma decimal y avisa que es el valor inicial', async () => {
    mockApi({ 'GET /api/settings': () => porDefecto })
    render(<SettingsPage />)

    expect(await screen.findByLabelText('Porcentaje por mes (%)')).toHaveValue('5,00')
    expect(screen.getByText(/Valor inicial del sistema/)).toBeInTheDocument()
  })

  it('si alguien lo cambió, muestra quién y cuándo', async () => {
    mockApi({ 'GET /api/settings': () => cambiado })
    render(<SettingsPage />)

    expect(await screen.findByLabelText('Porcentaje por mes (%)')).toHaveValue('7,50')
    expect(screen.getByText(/Última modificación: .* por Ana Propietaria/)).toBeInTheDocument()
  })

  it('guarda el porcentaje con punto decimal y lo confirma', async () => {
    const { calls } = mockApi({ 'GET /api/settings': () => porDefecto, 'PUT /api/settings': () => cambiado })
    const user = userEvent.setup()
    render(<SettingsPage />)

    const campo = await screen.findByLabelText('Porcentaje por mes (%)')
    await user.clear(campo)
    await user.type(campo, '7,5')
    await user.click(screen.getByRole('button', { name: 'Guardar porcentaje' }))

    expect(await screen.findByText('Porcentaje guardado.')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ lateFeePercent: '7.5' })
    expect(screen.getByLabelText('Porcentaje por mes (%)')).toHaveValue('7,50')
    expect(screen.getByText(/por Ana Propietaria/)).toBeInTheDocument() // la pantalla muestra el dato nuevo
  })

  it('muestra el error de la API y no dice que guardó', async () => {
    mockApi({
      'GET /api/settings': () => porDefecto,
      'PUT /api/settings': () =>
        Response.json(
          { error: 'Datos inválidos', details: [{ field: 'lateFeePercent', message: 'El porcentaje no puede ser mayor que 100' }] },
          { status: 400 },
        ),
    })
    const user = userEvent.setup()
    render(<SettingsPage />)

    const campo = await screen.findByLabelText('Porcentaje por mes (%)')
    await user.clear(campo)
    await user.type(campo, '150')
    await user.click(screen.getByRole('button', { name: 'Guardar porcentaje' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El porcentaje no puede ser mayor que 100')
    expect(screen.queryByText('Porcentaje guardado.')).not.toBeInTheDocument()
  })

  it('al volver a guardar, desaparece el aviso de éxito anterior', async () => {
    let intento = 0
    mockApi({
      'GET /api/settings': () => porDefecto,
      'PUT /api/settings': () => (++intento === 1 ? cambiado : Response.json({ error: 'Datos inválidos' }, { status: 400 })),
    })
    const user = userEvent.setup()
    render(<SettingsPage />)
    await user.click(await screen.findByRole('button', { name: 'Guardar porcentaje' }))
    await screen.findByText('Porcentaje guardado.')

    await user.click(screen.getByRole('button', { name: 'Guardar porcentaje' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Porcentaje guardado.')).not.toBeInTheDocument()
  })

  it('después de un error, un guardado correcto borra el aviso de error', async () => {
    let intento = 0
    mockApi({
      'GET /api/settings': () => porDefecto,
      'PUT /api/settings': () => (++intento === 1 ? Response.json({ error: 'Datos inválidos' }, { status: 400 }) : cambiado),
    })
    const user = userEvent.setup()
    render(<SettingsPage />)
    await user.click(await screen.findByRole('button', { name: 'Guardar porcentaje' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Guardar porcentaje' }))

    expect(await screen.findByText('Porcentaje guardado.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mientras guarda, el botón queda deshabilitado para no duplicar el pedido', async () => {
    const { fetchMock } = mockApi({ 'GET /api/settings': () => porDefecto })
    let terminar: (r: Response) => void = () => {}
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) =>
      init?.method === 'PUT' ? new Promise<Response>((resolve) => (terminar = resolve)) : original(input, init),
    )
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(await screen.findByRole('button', { name: 'Guardar porcentaje' }))
    expect(screen.getByRole('button', { name: 'Guardar porcentaje' })).toBeDisabled()

    terminar(Response.json(cambiado))
    await screen.findByText('Porcentaje guardado.')
    expect(screen.getByRole('button', { name: 'Guardar porcentaje' })).toBeEnabled()
  })

  it('avisa si no hay conexión con el servidor', async () => {
    mockApi({ 'GET /api/settings': () => new Error('red caída') })
    render(<SettingsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
  })
})

describe('SettingsPage: cambiar mi contraseña', () => {
  async function abrir(routes: Parameters<typeof mockApi>[0] = {}) {
    const mock = mockApi({ 'GET /api/settings': () => porDefecto, ...routes })
    const user = userEvent.setup()
    render(<SettingsPage />)
    await screen.findByLabelText('Porcentaje por mes (%)')
    return { ...mock, user }
  }

  async function completar(user: ReturnType<typeof userEvent.setup>, actual: string, nueva: string, repetida: string) {
    await user.type(screen.getByLabelText('Contraseña actual'), actual)
    await user.type(screen.getByLabelText('Contraseña nueva'), nueva)
    await user.type(screen.getByLabelText('Repetir contraseña nueva'), repetida)
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
  }

  it('manda la contraseña actual y la nueva, confirma y vacía los campos', async () => {
    const { calls, user } = await abrir({ 'POST /api/auth/change-password': () => undefined })

    await completar(user, 'ClaveVieja123', 'ClaveNueva4567', 'ClaveNueva4567')

    expect(await screen.findByText(/Contraseña cambiada/)).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/api/auth/change-password')?.body).toEqual({
      currentPassword: 'ClaveVieja123',
      newPassword: 'ClaveNueva4567',
    })
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('')
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('')
    expect(screen.getByLabelText('Repetir contraseña nueva')).toHaveValue('')
  })

  it('si la nueva no coincide con la repetida, avisa y no manda nada', async () => {
    const { calls, user } = await abrir()

    await completar(user, 'ClaveVieja123', 'ClaveNueva4567', 'ClaveNueva0000')

    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas nuevas no coinciden')
    expect(calls.some((c) => c.path === '/api/auth/change-password')).toBe(false)
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('ClaveNueva4567') // no pierde lo escrito
  })

  it('muestra el error de la API (contraseña actual incorrecta) y no dice que cambió', async () => {
    const { user } = await abrir({
      'POST /api/auth/change-password': () => Response.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 }),
    })

    await completar(user, 'mala', 'ClaveNueva4567', 'ClaveNueva4567')

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual es incorrecta')
    expect(screen.queryByText(/Contraseña cambiada/)).not.toBeInTheDocument()
  })

  it('al volver a intentar, desaparece el aviso de éxito anterior', async () => {
    const { user } = await abrir({ 'POST /api/auth/change-password': () => undefined })
    await completar(user, 'ClaveVieja123', 'ClaveNueva4567', 'ClaveNueva4567')
    await screen.findByText(/Contraseña cambiada/)

    await user.type(screen.getByLabelText('Contraseña nueva'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))

    expect(screen.queryByText(/Contraseña cambiada/)).not.toBeInTheDocument()
  })
})
