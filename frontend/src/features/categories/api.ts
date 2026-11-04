import { apiRequest } from '@/lib/api'

export type Category = { id: number; name: string }

export const listCategories = () => apiRequest<Category[]>('/categories')

export const createCategory = (name: string) =>
  apiRequest<Category>('/categories', { method: 'POST', body: { name } })

export const updateCategory = (id: number, name: string) =>
  apiRequest<Category>(`/categories/${id}`, { method: 'PUT', body: { name } })

export const deleteCategory = (id: number) => apiRequest<void>(`/categories/${id}`, { method: 'DELETE' })
