import { useEffect, useState } from 'react'
import AccountDetail from '@/components/accounts/AccountDetail'
import { Button } from '@/components/ui/button'
import { listAccounts } from '@/services/accounts/account.service'
import type { AccountStatus, CreditAccount } from '@/types/account.types'
import { describeError } from '@/utils/errors'
import { peso } from '@/utils/format'

const day = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })

// Cuentas corrientes: las fichas pendientes y, aparte, el historial de las canceladas (D17).
// El saldo y la mora los calcula el servidor; acá solo se muestran.
export default function AccountsPage() {
  const [status, setStatus] = useState<AccountStatus>('OPEN')
  const [accounts, setAccounts] = useState<CreditAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState<string | null>(null) // confirmación de un pago o de recargos aplicados

  useEffect(() => {
    let ignore = false
    listAccounts(status)
      .then((list) => {
        if (!ignore) {
          setAccounts(list)
          setError(null)
        }
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [status, reload])

  function changeStatus(next: AccountStatus) {
    setStatus(next)
    setAccounts(null)
    setExpanded(null)
    setNotice(null)
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Cuentas corrientes</h2>

      <div className="mb-4 flex gap-2" role="group" aria-label="Estado de las cuentas">
        <Button variant={status === 'OPEN' ? 'default' : 'outline'} aria-pressed={status === 'OPEN'} onClick={() => changeStatus('OPEN')}>
          Pendientes
        </Button>
        <Button
          variant={status === 'CANCELLED' ? 'default' : 'outline'}
          aria-pressed={status === 'CANCELLED'}
          onClick={() => changeStatus('CANCELLED')}
        >
          Historial de canceladas
        </Button>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {accounts === null && !error && <p className="text-muted-foreground">Cargando…</p>}
      {accounts?.length === 0 && (
        <p className="text-muted-foreground">
          {status === 'OPEN' ? 'No hay cuentas pendientes.' : 'Todavía no hay cuentas canceladas.'}
        </p>
      )}

      {accounts && accounts.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Desde</th>
                <th className="px-3 py-2 font-medium">{status === 'OPEN' ? 'Vence' : 'Cancelada'}</th>
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map((account) => (
                <AccountRows
                  key={account.id}
                  account={account}
                  open={expanded === account.id}
                  onToggle={() => setExpanded(expanded === account.id ? null : account.id)}
                  onChanged={(message) => {
                    setNotice(message)
                    setReload((n) => n + 1)
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AccountRows({
  account,
  open,
  onToggle,
  onChanged,
}: {
  account: CreditAccount
  open: boolean
  onToggle: () => void
  onChanged: (message: string) => void
}) {
  return (
    <>
      <tr>
        <td className="px-3 py-2 font-medium">{account.customer.name}</td>
        <td className="whitespace-nowrap px-3 py-2">{day.format(new Date(account.openedAt))}</td>
        <td className="whitespace-nowrap px-3 py-2">
          {day.format(new Date(account.status === 'OPEN' ? account.dueDate : (account.closedAt ?? account.dueDate)))}
        </td>
        <td className="px-3 py-2 text-right">
          {peso.format(Number(account.balance))}
          {Number(account.pendingSurchargesTotal) > 0 && (
            <span className="block text-xs text-muted-foreground">
              + {peso.format(Number(account.pendingSurchargesTotal))} de recargos
            </span>
          )}
        </td>
        <td className="px-3 py-2">
          {account.status === 'CANCELLED' ? (
            'Cancelada'
          ) : account.overdue ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
              Vencida{account.monthsOverdue > 0 ? ` (${account.monthsOverdue} ${account.monthsOverdue === 1 ? 'mes' : 'meses'})` : ''}
            </span>
          ) : (
            'Al día'
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <Button
            size="sm"
            variant="outline"
            aria-expanded={open}
            aria-label={`${open ? 'Ocultar' : 'Ver'} detalle de ${account.customer.name}`}
            onClick={onToggle}
          >
            {open ? 'Ocultar' : 'Ver detalle'}
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/40">
          <td colSpan={6} className="px-3 py-2">
            <AccountDetail account={account} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  )
}
