import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { applySurcharges, payAccount } from '@/services/accounts/account.service'
import type { CreditAccount } from '@/types/account.types'
import type { PaymentMethod } from '@/types/sale.types'
import { describeError } from '@/utils/errors'
import { dateTime, peso } from '@/utils/format'
import { paymentMethodLabels } from '@/utils/sale-labels'

type Props = {
  account: CreditAccount
  onChanged: (message: string) => void // avisa que hubo un pago o recargos (la pantalla recarga y muestra el aviso)
}

const day = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })

// Detalle de una ficha: ventas, pagos, recargos, y (si está abierta) registrar un pago o aplicar los recargos que ya corresponden.
// El saldo, los recargos y las reglas los calcula y controla la API (D18); acá solo se muestran y sus mensajes se muestran tal cual.
export default function AccountDetail({ account, onChanged }: Props) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const open = account.status === 'OPEN'
  const hasPending = account.pendingSurcharges.length > 0

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null)
    setBusy(true)
    try {
      await action()
      onChanged(message)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  function handlePay(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      await payAccount(account.id, {
        amount: amount.trim().replace(',', '.'), // se acepta coma decimal; la API recibe punto
        paymentMethod,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      setAmount('')
      setNote('')
    }, 'Pago registrado')
  }

  return (
    <div className="grid gap-4 text-sm">
      <section>
        <h4 className="mb-1 font-semibold">Ventas</h4>
        <ul className="grid gap-1">
          {account.sales.map((sale) => (
            <li key={sale.id} className={sale.status === 'ANNULLED' ? 'text-muted-foreground line-through' : undefined}>
              Venta #{sale.id} · {dateTime.format(new Date(sale.createdAt))} · {peso.format(Number(sale.total))}
              {sale.status === 'ANNULLED' ? ' (anulada)' : ''}
              {sale.note ? ` · ${sale.note}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="mb-1 font-semibold">Pagos</h4>
        {account.payments.length === 0 ? (
          <p className="text-muted-foreground">Todavía no hay pagos.</p>
        ) : (
          <ul className="grid gap-1">
            {account.payments.map((payment) => (
              <li key={payment.id}>
                {dateTime.format(new Date(payment.createdAt))} · {peso.format(Number(payment.amount))} ·{' '}
                {paymentMethodLabels[payment.paymentMethod]} · {payment.userName}
                {payment.note ? ` · ${payment.note}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {account.surcharges.length > 0 && (
        <section>
          <h4 className="mb-1 font-semibold">Recargos por mora registrados</h4>
          <ul className="grid gap-1">
            {account.surcharges.map((s) => (
              <li key={s.monthNumber}>
                Mes {s.monthNumber} de atraso ({day.format(new Date(s.chargedOn))}) · {peso.format(Number(s.amount))} = {Number(s.percent)}% de{' '}
                {peso.format(Number(s.base))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && hasPending && (
        <section className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <h4 className="mb-1 font-semibold">Recargos que ya corresponden (todavía sin registrar)</h4>
          <ul className="mb-2 grid gap-1">
            {account.pendingSurcharges.map((s) => (
              <li key={s.monthNumber}>
                Mes {s.monthNumber} de atraso · {peso.format(Number(s.amount))} = {Number(s.percent)}% de {peso.format(Number(s.base))}
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => applySurcharges(account.id), 'Recargos registrados')}>
            Aplicar recargos
          </Button>
        </section>
      )}

      {open && (
        <form onSubmit={handlePay} className="grid gap-3 rounded-md border border-border bg-white p-3">
          <h4 className="font-semibold">Registrar pago</h4>
          <p className="text-muted-foreground">
            Saldo a pagar hoy: <strong>{peso.format(Number(account.payable))}</strong>
            {hasPending && ' (incluye los recargos que ya corresponden)'}. Un pago parcial no cambia el vencimiento.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              Importe
              <Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="grid gap-1">
              Medio de pago
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabels[method]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1">
              Nota (opcional)
              <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <div>
            <Button type="submit" size="sm" disabled={busy || !amount.trim()}>
              Registrar pago
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-red-800">
          {error}
        </p>
      )}
    </div>
  )
}
