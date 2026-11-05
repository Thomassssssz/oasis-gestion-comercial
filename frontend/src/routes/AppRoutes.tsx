import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import CategoriesPage from '@/pages/categories/CategoriesPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ProductsPage from '@/pages/products/ProductsPage'
import SalesPage from '@/pages/sales/SalesPage'

// Mapa de direcciones de la app. Todo lo que está dentro de ProtectedRoute exige sesión abierta.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/productos" replace />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/ventas" element={<SalesPage />} />
          <Route path="/clientes" element={<CustomersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
