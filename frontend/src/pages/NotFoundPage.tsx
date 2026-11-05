import { Link } from 'react-router-dom'

// Se muestra cuando la dirección no corresponde a ninguna pantalla.
export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-bold">Página no encontrada</h1>
      <p className="mb-4 text-sm text-muted-foreground">La dirección que abriste no existe.</p>
      <Link to="/" className="text-sm font-medium underline">
        Volver al inicio
      </Link>
    </div>
  )
}
