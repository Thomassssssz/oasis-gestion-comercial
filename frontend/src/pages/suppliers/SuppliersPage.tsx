import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import SupplierForm from '@/components/suppliers/SupplierForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { listSuppliers, updateSupplier } from '@/services/suppliers/supplier.service'
import type { Supplier, SupplierFilters } from '@/types/supplier.types'
import { describeError } from '@/utils/errors'

export default function SuppliersPage() {
  const [filters, setFilters] = useState<SupplierFilters>({ search: '', status: 'active' })
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // null = formulario cerrado, 'new' = proveedor nuevo, o el proveedor que se está editando.
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const [reload, setReload] = useState(0)

  // La lista se vuelve a pedir cuando cambian los filtros o hay que recargar.
  useEffect(() => {
    let ignore = false
    listSuppliers(filters)
      .then((list) => {
        if (!ignore) {
          setSuppliers(list)
          setError(null)
        }
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [filters, reload])

  async function toggleActive(supplier: Supplier) {
    try {
      await updateSupplier(supplier.id, {
        name: supplier.name,
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        address: supplier.address ?? '',
        notes: supplier.notes ?? '',
        active: !supplier.active,
      })
      setReload((n) => n + 1)
    } catch (e) {
      setError(describeError(e))
    }
  }

  function handleSaved() {
    setEditing(null)
    setReload((n) => n + 1)
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Proveedores</h2>
        <Button onClick={() => setEditing('new')} disabled={editing !== null}>
          <Plus />
          Nuevo proveedor
        </Button>
      </div>

      {editing !== null && (
        <SupplierForm
          // La clave hace que el formulario empiece de cero al cambiar de proveedor.
          key={editing === 'new' ? 'new' : editing.id}
          supplier={editing === 'new' ? null : editing}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="mb-4 grid items-center gap-2 sm:grid-cols-2">
        <Input
          aria-label="Buscar proveedor"
          placeholder="Buscar por nombre, email o teléfono"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <Select
          aria-label="Filtrar por estado"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as SupplierFilters['status'] })}
        >
          <option value="active">Activos</option>
          <option value="inactive">Dados de baja</option>
          <option value="all">Todos</option>
        </Select>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {suppliers === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {suppliers?.length === 0 && <p className="text-muted-foreground">No hay proveedores que coincidan.</p>}

      {suppliers && suppliers.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Teléfono</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-3 py-2">
                    {supplier.name}
                    {supplier.address && <p className="text-xs text-muted-foreground">{supplier.address}</p>}
                    {supplier.notes && <p className="text-xs text-muted-foreground">{supplier.notes}</p>}
                  </td>
                  <td className="px-3 py-2">{supplier.email ?? '—'}</td>
                  <td className="px-3 py-2">{supplier.phone ?? '—'}</td>
                  <td className="px-3 py-2">{supplier.active ? 'Activo' : 'De baja'}</td>
                  <td className="px-3 py-2">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Editar ${supplier.name}`}
                        onClick={() => setEditing(supplier)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`${supplier.active ? 'Dar de baja' : 'Reactivar'} a ${supplier.name}`}
                        onClick={() => void toggleActive(supplier)}
                      >
                        {supplier.active ? 'Dar de baja' : 'Reactivar'}
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
