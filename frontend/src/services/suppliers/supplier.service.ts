import { apiRequest } from '@/services/api/client'
import type { Supplier, SupplierFilters, SupplierFormData } from '@/types/supplier.types'

// Arma el texto de filtros (?search=...&active=true) solo con los que tienen valor.
function toQueryString({ search, status }: SupplierFilters) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (status !== 'all') params.set('active', String(status === 'active'))
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const listSuppliers = (filters: SupplierFilters) =>
  apiRequest<Supplier[]>(`/suppliers${toQueryString(filters)}`)

export const createSupplier = (data: SupplierFormData) =>
  apiRequest<Supplier>('/suppliers', { method: 'POST', body: data })

// Editar reemplaza toda la ficha, por eso se envían todos los datos más el estado.
export const updateSupplier = (id: number, data: SupplierFormData & { active: boolean }) =>
  apiRequest<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: data })
