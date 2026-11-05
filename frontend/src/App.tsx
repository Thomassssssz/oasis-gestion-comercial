import { AuthProvider } from '@/context'
import AppRoutes from '@/routes/AppRoutes'

// El BrowserRouter está en main.tsx, así las pruebas pueden usar un MemoryRouter.
export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
