import type { TaxCondition } from '@/types/customer.types'

// Parámetros del sistema, tal como los devuelve la API.
export type Settings = {
  lateFeePercent: string // porcentaje de recargo por mes de atraso, como texto con 2 decimales, ej.: "5.00"
  updatedAt: string
  updatedBy: { id: number; fullName: string } | null // null = nadie lo cambió todavía (valor por defecto)
}

// Datos del comercio que van en el encabezado del remito (D23). Mientras nadie los cargue, todos son null.
export type BusinessSettings = {
  name: string | null
  owner: string | null
  address: string | null // puede tener varias líneas
  taxCondition: TaxCondition | null
  cuit: string | null // 11 dígitos, sin guiones
  grossIncome: string | null
  activityStart: string | null // texto libre, ej.: "03/2011"
  updatedAt: string
  updatedBy: { id: number; fullName: string } | null
}

export type BusinessSettingsInput = {
  name: string
  owner: string
  address: string
  taxCondition: TaxCondition | null
  cuit: string
  grossIncome: string
  activityStart: string
}
