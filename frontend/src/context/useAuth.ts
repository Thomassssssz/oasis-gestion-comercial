import { useContext } from 'react'
import { AuthContext } from './auth-context'

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth se tiene que usar dentro de un AuthProvider')
  return value
}
