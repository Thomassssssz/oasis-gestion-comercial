import { apiRequest } from '@/services/api/client'
import type { Product, ProductFilters, ProductFormData } from '@/types/product.types'

// Arma el texto de filtros (?search=...&active=true) solo con los que tienen valor.
function toQueryString({ search, categoryId, status, lowStockOnly }: ProductFilters) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (categoryId) params.set('categoryId', categoryId)
  if (status !== 'all') params.set('active', String(status === 'active'))
  if (lowStockOnly) params.set('lowStock', 'true')
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const listProducts = (filters: ProductFilters) =>
  apiRequest<Product[]>(`/products${toQueryString(filters)}`)

export const createProduct = (data: ProductFormData) =>
  apiRequest<Product>('/products', { method: 'POST', body: data })

export const updateProduct = (id: number, data: ProductFormData & { active: boolean }) =>
  apiRequest<Product>(`/products/${id}`, { method: 'PUT', body: data })
