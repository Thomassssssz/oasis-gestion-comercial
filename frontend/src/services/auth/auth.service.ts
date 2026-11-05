import { apiRequest } from '@/services/api/client'
import type { AuthUser } from '@/types/auth.types'

export const login = (username: string, password: string) =>
  apiRequest<AuthUser>('/auth/login', { method: 'POST', body: { username, password } })

export const logout = () => apiRequest<void>('/auth/logout', { method: 'POST' })

// Devuelve el usuario de la sesión abierta; si no hay sesión, la API responde 401 y esto lanza un ApiError.
export const getCurrentUser = () => apiRequest<AuthUser>('/auth/me')
