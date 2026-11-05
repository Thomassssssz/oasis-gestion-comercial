export type Supplier = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean // false = dado de baja
  createdAt: string
  updatedAt: string
}

// Datos que se envían para crear o editar un proveedor. Los opcionales vacíos ('') la API los guarda como "sin dato".
export type SupplierFormData = {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

export type SupplierFilters = {
  search: string
  status: 'active' | 'inactive' | 'all'
}
