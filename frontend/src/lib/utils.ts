import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Une clases de Tailwind sin duplicados ni conflictos.
// Ejemplo: cn('px-2', condicion && 'px-4') se queda con 'px-4'.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
