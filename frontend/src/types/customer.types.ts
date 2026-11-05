export type Customer = {
  id: number
  name: string
  phone: string | null
  dni: string | null // solo dígitos, sin puntos
  address: string | null
  notes: string | null
  creditAuthorized: boolean // true = puede comprar a crédito
  active: boolean // false = dado de baja
  createdAt: string
  updatedAt: string
}

// Datos que se envían para crear o editar un cliente. Los opcionales vacíos ('') la API los guarda como "sin dato".
export type CustomerFormData = {
  name: string
  phone: string
  dni: string
  address: string
  notes: string
  creditAuthorized: boolean
}

export type CustomerFilters = {
  search: string
  status: 'active' | 'inactive' | 'all'
  credit: 'all' | 'authorized' | 'not-authorized'
  debt: 'all' | 'with-debt' // 'with-debt' = solo los que tienen una ficha pendiente; se filtra en la pantalla
}
