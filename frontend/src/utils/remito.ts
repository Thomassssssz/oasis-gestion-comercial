import type { CreditAccount } from '@/types/account.types'
import type { Customer, TaxCondition } from '@/types/customer.types'
import type { BusinessSettings } from '@/types/setting.types'
import { peso } from '@/utils/format'
import { paymentMethodLabels } from '@/utils/sale-labels'

// Cada dato del remito que se puede tocar y cambiar. Se agrupan por lo que se guarda: el cliente, la ficha o el comercio (D23).
export const CUSTOMER_KEYS = ['customerName', 'address', 'locality', 'taxCondition', 'cuit'] as const
export const ACCOUNT_KEYS = ['number', 'remitoNumber'] as const
export const BUSINESS_KEYS = ['bizName', 'bizOwner', 'bizAddress', 'bizTaxCondition', 'bizCuit', 'bizGrossIncome', 'bizActivityStart'] as const

export type FieldKey = (typeof CUSTOMER_KEYS)[number] | (typeof ACCOUNT_KEYS)[number] | (typeof BUSINESS_KEYS)[number]
export type RemitoValues = Record<FieldKey, string> // todo como texto; '' = sin dato

export const taxConditionLabels: Record<TaxCondition, string> = {
  CONSUMER: 'Cons. Final',
  EXEMPT: 'Exento',
  REGISTERED: 'Resp. Inscripto',
  MONOTAX: 'Monotributo',
}

// Cómo se escribe la condición del comercio en el encabezado del papel.
export const businessTaxLabels: Record<TaxCondition, string> = {
  CONSUMER: 'CONSUMIDOR FINAL',
  EXEMPT: 'EXENTO',
  REGISTERED: 'RESPONSABLE INSCRIPTO',
  MONOTAX: 'RESPONSABLE MONOTRIBUTO',
}

export const isTaxCondition = (value: string): value is TaxCondition => Object.hasOwn(taxConditionLabels, value)

// 20123456789 -> 20-12345678-9. Si no son 11 dígitos se deja como está.
export function formatCuit(value: string | null): string {
  if (!value) return ''
  return /^\d{11}$/.test(value) ? `${value.slice(0, 2)}-${value.slice(2, 10)}-${value.slice(10)}` : value
}

// Para comparar lo escrito con lo guardado: sin espacios de los costados y, en los CUIT, sin guiones ni puntos.
export function normalizeValue(key: FieldKey, value: string): string {
  const text = value.trim()
  return key === 'cuit' || key === 'bizCuit' ? text.replace(/[-.\s]/g, '') : text
}

// Los valores que hoy tiene guardados la base, en la forma en que se muestran en el remito.
export function serverValues(customer: Customer, account: CreditAccount | null, business: BusinessSettings): RemitoValues {
  return {
    customerName: customer.name,
    address: customer.address ?? '',
    locality: customer.locality ?? '',
    taxCondition: customer.taxCondition ?? '',
    cuit: formatCuit(customer.cuit),
    number: account?.number ?? '',
    remitoNumber: account?.remitoNumber ?? '',
    bizName: business.name ?? '',
    bizOwner: business.owner ?? '',
    bizAddress: business.address ?? '',
    bizTaxCondition: business.taxCondition ?? '',
    bizCuit: formatCuit(business.cuit),
    bizGrossIncome: business.grossIncome ?? '',
    bizActivityStart: business.activityStart ?? '',
  }
}

// Un renglón de la grilla del remito. `kind` distingue lo que se llevó (item) de lo que ajusta la cuenta.
export type RemitoLine = {
  kind: 'item' | 'surcharge' | 'payment'
  quantity: string
  detail: string
  unitPrice: string
  total: string
}

export type RemitoTotals = {
  lines: RemitoLine[]
  totalCents: number // ventas + recargos registrados
  paidCents: number // pagos
  balanceCents: number // saldo que calcula el servidor
  pendingCents: number // recargos que ya corresponden y todavía no se registraron
  payableCents: number // saldo + recargos pendientes: lo que hay que pagar hoy
}

const cents = (value: string) => Math.round(Number(value) * 100)
const shortDay = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })

// Arma los renglones y los totales del remito a partir de la ficha abierta. Los importes salen de lo que calcula el servidor;
// acá solo se ordenan y se suman en centavos para no arrastrar errores de decimales.
// Orden: lo que se llevó el cliente, los recargos por mora registrados y, al final, los pagos (restan).
// Las ventas anuladas no figuran: el cliente no se llevó esos artículos.
export function buildRemito(account: CreditAccount | null): RemitoTotals {
  if (!account) return { lines: [], totalCents: 0, paidCents: 0, balanceCents: 0, pendingCents: 0, payableCents: 0 }

  const confirmed = account.sales.filter((sale) => sale.status === 'CONFIRMED')
  const lines: RemitoLine[] = []

  for (const sale of confirmed) {
    for (const item of sale.items) {
      lines.push({
        kind: 'item',
        quantity: String(item.quantity),
        detail: item.productName,
        unitPrice: peso.format(Number(item.unitPrice)),
        total: peso.format(Number(item.subtotal)),
      })
    }
  }
  for (const s of account.surcharges) {
    lines.push({
      kind: 'surcharge',
      quantity: '',
      detail: `Recargo por mora (mes ${s.monthNumber} de atraso, ${Number(s.percent)}%)`,
      unitPrice: '',
      total: peso.format(Number(s.amount)),
    })
  }
  for (const p of account.payments) {
    lines.push({
      kind: 'payment',
      quantity: '',
      detail: `Pago ${shortDay.format(new Date(p.createdAt))} · ${paymentMethodLabels[p.paymentMethod]}`,
      unitPrice: '',
      total: `− ${peso.format(Number(p.amount))}`,
    })
  }

  const totalCents =
    confirmed.reduce((sum, sale) => sum + cents(sale.total), 0) + account.surcharges.reduce((sum, s) => sum + cents(s.amount), 0)
  const paidCents = account.payments.reduce((sum, p) => sum + cents(p.amount), 0)
  const pendingCents = account.status === 'OPEN' ? cents(account.pendingSurchargesTotal) : 0
  const balanceCents = cents(account.balance)

  return { lines, totalCents, paidCents, balanceCents, pendingCents, payableCents: balanceCents + pendingCents }
}
