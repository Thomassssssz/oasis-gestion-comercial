import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Después de cada prueba se limpia la pantalla simulada y se restauran
// las funciones globales falsas, para que una prueba no afecte a la siguiente.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
