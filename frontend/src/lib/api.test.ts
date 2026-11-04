import { describe, expect, it } from 'vitest'
import { ApiError, apiRequest, describeError } from './api.ts'
import { mockApi } from '../test/mock-api.ts'

describe('apiRequest', () => {
  it('antepone /api a la ruta y devuelve el JSON', async () => {
    const { calls } = mockApi({ 'GET /api/cosas': () => [{ id: 1 }] })

    expect(await apiRequest('/cosas')).toEqual([{ id: 1 }])
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/api/cosas' })
  })

  it('envía el cuerpo como JSON', async () => {
    const { calls } = mockApi({ 'POST /api/cosas': () => ({ id: 1 }) })

    await apiRequest('/cosas', { method: 'POST', body: { name: 'A' } })

    expect(calls[0].body).toEqual({ name: 'A' })
  })

  it('devuelve undefined con una respuesta 204', async () => {
    mockApi({ 'DELETE /api/cosas/1': () => undefined })

    expect(await apiRequest('/cosas/1', { method: 'DELETE' })).toBeUndefined()
  })

  it('lanza ApiError con el mensaje y el estado que mandó la API', async () => {
    mockApi({ 'GET /api/cosas': () => Response.json({ error: 'No existe' }, { status: 404 }) })

    const error = await apiRequest('/cosas').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'No existe', details: [] })
  })

  it('lanza ApiError con un mensaje genérico si la respuesta de error no es JSON', async () => {
    mockApi({ 'GET /api/cosas': () => new Response('boom', { status: 502 }) })

    await expect(apiRequest('/cosas')).rejects.toMatchObject({
      status: 502,
      message: 'La API respondió con el estado 502',
    })
  })
})

describe('describeError', () => {
  it('junta los mensajes por campo si los hay', () => {
    const error = new ApiError(400, 'Datos inválidos', [
      { field: 'name', message: 'El nombre es obligatorio' },
      { field: 'salePrice', message: 'El precio es obligatorio' },
    ])

    expect(describeError(error)).toBe('El nombre es obligatorio. El precio es obligatorio')
  })

  it('usa el mensaje del error de la API', () => {
    expect(describeError(new ApiError(409, 'Ya existe una categoría con ese nombre'))).toBe(
      'Ya existe una categoría con ese nombre',
    )
  })

  it('avisa que no hay conexión ante cualquier otro error', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toBe('No se pudo conectar con el servidor')
  })
})
