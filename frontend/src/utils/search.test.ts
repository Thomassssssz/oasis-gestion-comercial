import { describe, expect, it } from 'vitest'
import { filterByName, matchesName, normalizeText } from './search'

describe('normalizeText', () => {
  it('saca tildes, mayúsculas y espacios de los costados', () => {
    expect(normalizeText('  LÁPIZ Ñandú ')).toBe('lapiz nandu')
  })
})

describe('matchesName', () => {
  it('encuentra por parte del nombre, sin importar mayúsculas ni tildes', () => {
    expect(matchesName('Lápiz negro HB', 'lapiz')).toBe(true)
    expect(matchesName('Lápiz negro HB', 'LÁP')).toBe(true)
    expect(matchesName('Lápiz negro HB', 'hb')).toBe(true)
  })

  it('pide todas las palabras, en cualquier orden', () => {
    expect(matchesName('Goma Eva con brillo', 'eva goma')).toBe(true)
    expect(matchesName('Goma Eva con brillo', 'goma tijera')).toBe(false)
  })

  it('no confunde un nombre con otro', () => {
    expect(matchesName('Cuaderno rayado', 'carpeta')).toBe(false)
  })

  it('con la búsqueda vacía o de solo espacios encuentra todo', () => {
    expect(matchesName('Cuaderno', '')).toBe(true)
    expect(matchesName('Cuaderno', '   ')).toBe(true)
  })
})

describe('filterByName', () => {
  const items = [
    { id: 1, name: 'Cuaderno rayado' },
    { id: 2, name: 'Lápiz negro' },
    { id: 3, name: 'Lapicera azul' },
  ]

  it('deja los que coinciden', () => {
    expect(filterByName(items, 'lapi').map((i) => i.id)).toEqual([2, 3])
    expect(filterByName(items, 'lapiz').map((i) => i.id)).toEqual([2])
  })

  it('sin búsqueda devuelve la misma lista', () => {
    expect(filterByName(items, '')).toBe(items)
    expect(filterByName(items, '  ')).toBe(items)
  })

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filterByName(items, 'zzz')).toEqual([])
  })
})
