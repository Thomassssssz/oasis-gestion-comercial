import { describe, expect, it } from 'vitest'
import type { CreditAccount } from '@/types/account.types'
import type { Customer } from '@/types/customer.types'
import type { BusinessSettings } from '@/types/setting.types'
import { buildRemito, formatCuit, isTaxCondition, normalizeValue, serverValues } from './remito'

const cuenta = (extra: Partial<CreditAccount> = {}): CreditAccount => ({
  id: 3,
  customer: { id: 5, name: 'María Gómez' },
  status: 'OPEN',
  openedAt: '2026-03-10T15:00:00.000Z',
  dueDate: '2026-04-10T15:00:00.000Z',
  closedAt: null,
  number: null,
  remitoNumber: null,
  balance: '350.00',
  pendingSurchargesTotal: '0.00',
  payable: '350.00',
  overdue: false,
  monthsOverdue: 0,
  pendingSurcharges: [],
  surcharges: [],
  payments: [],
  sales: [
    {
      id: 1,
      status: 'CONFIRMED',
      createdAt: '2026-03-10T15:00:00.000Z',
      note: null,
      discount: '0.00',
      total: '350.00',
      items: [
        { productName: 'Cuaderno rayado', quantity: 3, unitPrice: '100.00', subtotal: '300.00' },
        { productName: 'Lapicera azul', quantity: 2, unitPrice: '25.00', subtotal: '50.00' },
      ],
    },
  ],
  ...extra,
})

describe('formatCuit', () => {
  it('pone los guiones a 11 dígitos', () => expect(formatCuit('20302555398')).toBe('20-30255539-8'))
  it('deja como está lo que no son 11 dígitos', () => {
    expect(formatCuit('1234')).toBe('1234')
    expect(formatCuit('1234567890')).toBe('1234567890') // 10 dígitos
    expect(formatCuit('123456789012')).toBe('123456789012')
  })
  it('sin dato queda vacío', () => {
    expect(formatCuit(null)).toBe('')
    expect(formatCuit('')).toBe('')
  })
})

describe('normalizeValue', () => {
  it('recorta los espacios de los costados', () => expect(normalizeValue('locality', '  Formosa ')).toBe('Formosa'))
  it('en los CUIT saca guiones, puntos y espacios', () => {
    expect(normalizeValue('cuit', '20-30255539-8')).toBe('20302555398')
    expect(normalizeValue('bizCuit', ' 20.30255539 8 ')).toBe('20302555398')
  })
  it('en los demás campos conserva guiones y puntos', () => expect(normalizeValue('bizGrossIncome', '01-20-30255539-8')).toBe('01-20-30255539-8'))
})

describe('isTaxCondition', () => {
  it('reconoce las cuatro condiciones y nada más', () => {
    for (const ok of ['CONSUMER', 'EXEMPT', 'REGISTERED', 'MONOTAX']) expect(isTaxCondition(ok)).toBe(true)
    for (const bad of ['', 'OTRA', 'toString', 'constructor']) expect(isTaxCondition(bad)).toBe(false)
  })
})

describe('serverValues', () => {
  const cliente: Customer = {
    id: 5,
    name: 'María Gómez',
    phone: null,
    dni: null,
    address: 'España 123',
    locality: 'Formosa',
    taxCondition: 'MONOTAX',
    cuit: '27123456789',
    notes: null,
    creditAuthorized: true,
    active: true,
    createdAt: '',
    updatedAt: '',
  }
  const comercio: BusinessSettings = {
    name: 'Comercio',
    owner: 'Titular',
    address: 'Calle 1\nFormosa',
    taxCondition: 'EXEMPT',
    cuit: '20111111111',
    grossIncome: '123',
    activityStart: '03/2011',
    updatedAt: '',
    updatedBy: null,
  }

  it('arma los textos que se muestran en el remito', () => {
    expect(serverValues(cliente, cuenta({ number: '7', remitoNumber: '0001-8' }), comercio)).toEqual({
      customerName: 'María Gómez',
      address: 'España 123',
      locality: 'Formosa',
      taxCondition: 'MONOTAX',
      cuit: '27-12345678-9',
      number: '7',
      remitoNumber: '0001-8',
      bizName: 'Comercio',
      bizOwner: 'Titular',
      bizAddress: 'Calle 1\nFormosa',
      bizTaxCondition: 'EXEMPT',
      bizCuit: '20-11111111-1',
      bizGrossIncome: '123',
      bizActivityStart: '03/2011',
    })
  })

  it('lo que no tiene dato queda vacío, y sin ficha los números del remito también', () => {
    const vacio: BusinessSettings = { ...comercio, name: null, owner: null, address: null, taxCondition: null, cuit: null, grossIncome: null, activityStart: null }
    const values = serverValues({ ...cliente, address: null, locality: null, taxCondition: null, cuit: null }, null, vacio)

    expect(Object.values(values).filter((v) => v !== '')).toEqual(['María Gómez'])
  })
})

describe('buildRemito', () => {
  it('sin ficha no hay renglones y todo está en cero', () => {
    expect(buildRemito(null)).toEqual({ lines: [], totalCents: 0, paidCents: 0, balanceCents: 0, pendingCents: 0, payableCents: 0 })
  })

  it('cada artículo es un renglón con cantidad, detalle, precio unitario y total', () => {
    const { lines, totalCents, balanceCents } = buildRemito(cuenta())

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ kind: 'item', quantity: '3', detail: 'Cuaderno rayado' })
    expect(lines[0]!.unitPrice).toMatch(/\$\s?100,00/)
    expect(lines[0]!.total).toMatch(/\$\s?300,00/)
    expect(totalCents).toBe(35000)
    expect(balanceCents).toBe(35000)
  })

  it('no hay renglón de descuento: el comercio ya no hace descuentos (D25); el total es el que calcula el servidor', () => {
    const { lines, totalCents } = buildRemito(cuenta({ sales: [{ ...cuenta().sales[0]!, discount: '50.00', total: '300.00' }], balance: '300.00' }))

    expect(lines.map((l) => l.kind)).toEqual(['item', 'item']) // solo los dos artículos
    expect(lines.some((l) => l.detail === 'Descuento')).toBe(false)
    expect(totalCents).toBe(30000)
  })

  it('las ventas anuladas no figuran ni suman', () => {
    const anulada = { ...cuenta().sales[0]!, id: 2, status: 'ANNULLED' as const, total: '999.00', items: [{ productName: 'Anulado', quantity: 1, unitPrice: '999.00', subtotal: '999.00' }] }
    const { lines, totalCents } = buildRemito(cuenta({ sales: [...cuenta().sales, anulada] }))

    expect(lines.some((l) => l.detail === 'Anulado')).toBe(false)
    expect(totalCents).toBe(35000)
  })

  it('los recargos registrados suman y los pagos restan, al final de los artículos', () => {
    const remito = buildRemito(
      cuenta({
        balance: '320.00',
        surcharges: [{ monthNumber: 1, base: '350.00', percent: '5.00', amount: '17.50', chargedOn: '2026-05-10T15:00:00.000Z' }],
        payments: [{ id: 1, amount: '47.50', paymentMethod: 'TRANSFER', note: null, createdAt: '2026-05-12T15:00:00.000Z', userName: 'Ana' }],
      }),
    )

    expect(remito.lines.map((l) => l.kind)).toEqual(['item', 'item', 'surcharge', 'payment'])
    expect(remito.lines[2]!.detail).toBe('Recargo por mora (mes 1 de atraso, 5%)')
    expect(remito.lines[2]!.total).toMatch(/^\$\s?17,50$/)
    expect(remito.lines[3]!.detail).toMatch(/^Pago .* · Transferencia$/)
    expect(remito.lines[3]!.total).toMatch(/^−\s*\$\s?47,50$/)
    expect(remito.totalCents).toBe(36750) // 350 + 17,50
    expect(remito.paidCents).toBe(4750)
    expect(remito.balanceCents).toBe(32000) // el saldo lo calcula el servidor
  })

  it('suma en centavos sin errores de decimales', () => {
    const venta = (id: number, total: string) => ({ ...cuenta().sales[0]!, id, total, items: [] })
    const { totalCents } = buildRemito(cuenta({ sales: [venta(1, '0.10'), venta(2, '0.20'), venta(3, '1234.56')] }))

    expect(totalCents).toBe(123486)
  })

  it('los recargos que ya corresponden se muestran aparte y se suman a lo que hay que pagar hoy', () => {
    const remito = buildRemito(cuenta({ pendingSurchargesTotal: '17.50', payable: '367.50' }))

    expect(remito.pendingCents).toBe(1750)
    expect(remito.payableCents).toBe(36750)
    expect(remito.lines.some((l) => l.kind === 'surcharge')).toBe(false) // todavía no están registrados
  })

  it('en una ficha cancelada no hay recargos pendientes', () => {
    const remito = buildRemito(cuenta({ status: 'CANCELLED', pendingSurchargesTotal: '17.50', balance: '0.00' }))

    expect(remito.pendingCents).toBe(0)
    expect(remito.payableCents).toBe(0)
  })
})
