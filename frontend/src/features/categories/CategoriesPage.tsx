import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { describeError } from '@/lib/api'
import { createCategory, deleteCategory, listCategories, updateCategory, type Category } from './api'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  // Sube cada vez que hay que volver a pedir la lista a la API.
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let ignore = false
    listCategories()
      .then((list) => {
        if (!ignore) setCategories(list)
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [reload])

  // Ejecuta una acción contra la API; si sale bien recarga la lista, si falla muestra el motivo.
  async function run(action: () => Promise<unknown>, onDone?: () => void) {
    setError(null)
    try {
      await action()
      onDone?.()
      setReload((n) => n + 1)
    } catch (e) {
      setError(describeError(e))
    }
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    void run(() => createCategory(newName), () => setNewName(''))
  }

  function handleSaveEdit(event: FormEvent) {
    event.preventDefault()
    if (editingId === null) return
    void run(() => updateCategory(editingId, editingName), () => setEditingId(null))
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Categorías</h2>

      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <Input
          aria-label="Nombre de la nueva categoría"
          placeholder="Nueva categoría"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit">Agregar</Button>
      </form>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {categories === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {categories?.length === 0 && <p className="text-muted-foreground">Todavía no hay categorías.</p>}

      <ul className="divide-y divide-border rounded-md border border-border bg-white">
        {categories?.map((category) => (
          <li key={category.id} className="flex items-center justify-between gap-2 px-3 py-2">
            {editingId === category.id ? (
              <form onSubmit={handleSaveEdit} className="flex flex-1 gap-2">
                <Input
                  aria-label="Nuevo nombre de la categoría"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <Button type="submit" size="sm">
                  Guardar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <>
                <span>{category.name}</span>
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Editar ${category.name}`}
                    onClick={() => {
                      setEditingId(category.id)
                      setEditingName(category.name)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Borrar ${category.name}`}
                    onClick={() => void run(() => deleteCategory(category.id))}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
