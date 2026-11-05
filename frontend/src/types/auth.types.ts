// Usuario con la sesión abierta, tal como lo devuelve la API (nunca incluye la contraseña).
export type AuthUser = { id: number; username: string; fullName: string }

// 'loading' = todavía se está preguntando a la API si hay una sesión abierta.
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'
