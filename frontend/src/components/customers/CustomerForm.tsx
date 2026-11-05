import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCustomer, customerData, updateCustomer } from '@/services/customers/customer.service'
import type { Customer } from '@/types/customer.types'
import { describeError } from '@/utils/errors'

type Props = {
  customer: Customer | null // null = cliente nuevo
  onSaved: () => void
  onCancel: () => void
}

export default function CustomerForm({ customer, onSaved, onCancel }: Props) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [dni, setDni] = useState(customer?.dni ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const [creditAuthorized, setCreditAuthorized] = useState(customer?.creditAuthorized ?? false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    // Los datos opcionales vacíos se mandan como están: la API los guarda como "sin dato".
    const data = { name, phone, dni, address, notes, creditAuthorized }

    try {
      // Al editar se reenvían también la localidad, la condición de IVA y el CUIT, que se editan en el remito: no se borran.
      if (customer) await updateCustomer(customer.id, customerData(customer, data))
      else await createCustomer(data)
      onSaved()
    } catch (e) {
      setError(describeError(e))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-md border border-border bg-white p-4 sm:grid-cols-2">
      <h3 className="text-lg font-semibold sm:col-span-2">{customer ? 'Editar cliente' : 'Nuevo cliente'}</h3>

      <label className="grid gap-1 text-sm sm:col-span-2">
        Nombre
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm">
        Teléfono
        <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <label className="grid gap-1 text-sm">
        DNI
        <Input inputMode="numeric" placeholder="Con o sin puntos" value={dni} onChange={(e) => setDni(e.target.value)} />
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

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={creditAuthorized} onChange={(e) => setCreditAuthorized(e.target.checked)} />
        Autorizado a comprar a crédito
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
