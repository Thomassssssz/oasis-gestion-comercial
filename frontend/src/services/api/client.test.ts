import { describe, expect, it } from 'vitest'
import { mockApi } from '@/test/mock-api'
import { ApiError, apiRequest } from './client'

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
