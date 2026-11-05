import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setUnauthorizedHandler } from '@/services/api/client'
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from '@/services/auth/auth.service'
import type { AuthStatus, AuthUser } from '@/types/auth.types'
import { AuthContext } from './auth-context'

// Mantiene el estado de la sesión de toda la app: al arrancar le pregunta a la API si ya hay una
// sesión abierta, y ofrece login() y logout() a las pantallas.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let ignore = false
    getCurrentUser()
      .then((current) => {
        if (ignore) return
        setUser(current)
        setStatus('authenticated')
      })
      .catch(() => {
        if (ignore) return
        setUser(null)
        setStatus('anonymous')
      })
    return () => {
      ignore = true
    }
  }, [])

  // Si en cualquier pedido la API responde 401 (por ejemplo, la sesión venció), se vuelve al login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setStatus('anonymous')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setUser(await loginRequest(username, password))
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      // Aunque falle el pedido, en esta pantalla se sale igual.
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout])

  return <AuthContext value={value}>{children}</AuthContext>
}
