// Formatos de pantalla compartidos.
export const peso = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

export const dateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })
