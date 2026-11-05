export type Product = {
  id: number
  name: string
  categoryId: number
  category: { id: number; name: string }
  salePrice: string // importe como texto con 2 decimales, ej.: "1500.50"
  minStock: number
  active: boolean
  stock: number // suma de sus movimientos de inventario (la calcula la API)
  lowStock: boolean // true si el stock es igual o menor al mínimo
}

// Datos que se envían para crear o editar un producto.
export type ProductFormData = {
  name: string
  categoryId: number
  salePrice: string
  minStock: number
}

export type ProductFilters = {
  search: string
  categoryId: string
  status: 'active' | 'inactive' | 'all'
  lowStockOnly: boolean // true = solo los productos en alerta de stock mínimo
}
