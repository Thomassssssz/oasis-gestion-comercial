import { apiRequest } from '@/services/api/client'
import type { Category } from '@/types/category.types'

export const listCategories = () => apiRequest<Category[]>('/categories')

export const createCategory = (name: string) =>
  apiRequest<Category>('/categories', { method: 'POST', body: { name } })

export const updateCategory = (id: number, name: string) =>
  apiRequest<Category>(`/categories/${id}`, { method: 'PUT', body: { name } })

export const deleteCategory = (id: number) => apiRequest<void>(`/categories/${id}`, { method: 'DELETE' })
