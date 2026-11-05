import { apiRequest } from '@/services/api/client'
import type { Customer, CustomerFilters, CustomerFormData } from '@/types/customer.types'

// Arma el texto de filtros (?search=...&active=true) solo con los que tienen valor.
function toQueryString({ search, status, credit }: CustomerFilters) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (status !== 'all') params.set('active', String(status === 'active'))
  if (credit !== 'all') params.set('creditAuthorized', String(credit === 'authorized'))
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const listCustomers = (filters: CustomerFilters) =>
  apiRequest<Customer[]>(`/customers${toQueryString(filters)}`)

export const getCustomer = (id: number) => apiRequest<Customer>(`/customers/${id}`)

export const createCustomer = (data: CustomerFormData) =>
  apiRequest<Customer>('/customers', { method: 'POST', body: data })

// Todos los datos de un cliente tal como los espera la API, para volver a enviarlos con un solo cambio.
// Editar reemplaza la ficha completa: si se omitiera un dato (la localidad, por ejemplo), la API lo borraría.
export const customerData = (customer: Customer, changes: Partial<CustomerFormData & { active: boolean }> = {}) => ({
  name: customer.name,
  phone: customer.phone ?? '',
  dni: customer.dni ?? '',
  address: customer.address ?? '',
  locality: customer.locality ?? '',
  taxCondition: customer.taxCondition,
  cuit: customer.cuit ?? '',
  notes: customer.notes ?? '',
  creditAuthorized: customer.creditAuthorized,
  active: customer.active,
  ...changes,
})

// Editar reemplaza toda la ficha, por eso se envían todos los datos más el estado.
export const updateCustomer = (id: number, data: CustomerFormData & { active: boolean }) =>
  apiRequest<Customer>(`/customers/${id}`, { method: 'PUT', body: data })
