import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSupplier, updateSupplier } from '@/services/suppliers/supplier.service'
import type { Supplier } from '@/types/supplier.types'
import { describeError } from '@/utils/errors'

type Props = {
  supplier: Supplier | null // null = proveedor nuevo
  onSaved: () => void
  onCancel: () => void
}

export default function SupplierForm({ supplier, onSaved, onCancel }: Props) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    // Los datos opcionales vacíos se mandan como están: la API los guarda como "sin dato".
    const data = { name, phone, email, address, notes }

    try {
      if (supplier) await updateSupplier(supplier.id, { ...data, active: supplier.active })
      else await createSupplier(data)
      onSaved()
    } catch (e) {
      setError(describeError(e))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-md border border-border bg-white p-4 sm:grid-cols-2">
      <h3 className="text-lg font-semibold sm:col-span-2">{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>

      <label className="grid gap-1 text-sm sm:col-span-2">
        Nombre
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm">
        Teléfono
        <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm">
        Email
        <Input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm sm:col-span-2">
        Dirección
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm sm:col-span-2">
        Observaciones
        <textarea
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 sm:col-span-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          Guardar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
