// Formatos de pantalla compartidos.
export const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export const dateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

// Importe corto para los ejes de los gráficos ("$ 1,5 M"); el detalle exacto va en el tooltip y en la tabla.
export const pesoCompact = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact', maximumFractionDigits: 1 })

// "2026-11-04" -> "04/11". Los días de los reportes ya vienen como texto AAAA-MM-DD: no se pasan por Date para no mover el día por huso horario.
export const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

// "2026-11-04" -> "04/11/2026".
export const fullDay = (day: string) => `${shortDay(day)}/${day.slice(0, 4)}`
