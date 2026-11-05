// Parámetros del sistema, tal como los devuelve la API.
export type Settings = {
  lateFeePercent: string // porcentaje de recargo por mes de atraso, como texto con 2 decimales, ej.: "5.00"
  updatedAt: string
  updatedBy: { id: number; fullName: string } | null // null = nadie lo cambió todavía (valor por defecto)
}
