import { describe, expect, it } from 'vitest'
import { ApiError } from '@/services/api/client'
import { describeError } from './errors'

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
