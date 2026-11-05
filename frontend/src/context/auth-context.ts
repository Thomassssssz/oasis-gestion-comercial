import { createContext } from 'react'
import type { AuthStatus, AuthUser } from '@/types/auth.types'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

// Guarda quién tiene la sesión abierta, para que cualquier pantalla pueda saberlo con useAuth().
export const AuthContext = createContext<AuthContextValue | null>(null)
