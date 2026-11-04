import { apiRequest } from '@/lib/api'

export type Product = {
  id: number
  name: string
  categoryId: number
  category: { id: number; name: string }
  salePrice: string // importe como texto con 2 decimales, ej.: "1500.50"
  minStock: number
  active: boolean
}

// Datos que se envían para crear o editar un producto.
export type ProductFormData = {
  name: string
  categoryId: number
  salePrice: string
  minStock: number
}

export type ProductFilters = { search: string; categoryId: string; status: 'active' | 'inactive' | 'all' }

// Arma el texto de filtros (?search=...&active=true) solo con los que tienen valor.
function toQueryString({ search, categoryId, status }: ProductFilters) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (categoryId) params.set('categoryId', categoryId)
  if (status !== 'all') params.set('active', String(status === 'active'))
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const listProducts = (filters: ProductFilters) =>
  apiRequest<Product[]>(`/products${toQueryString(filters)}`)

export const createProduct = (data: ProductFormData) =>
  apiRequest<Product>('/products', { method: 'POST', body: data })

export const updateProduct = (id: number, data: ProductFormData & { active: boolean }) =>
  apiRequest<Product>(`/products/${id}`, { method: 'PUT', body: data })
