import AccountActions from '@/components/accounts/AccountActions'
import ArticlesTable from '@/components/customers/ArticlesTable'
import type { CreditAccount } from '@/types/account.types'
import { dateTime, peso } from '@/utils/format'
import { paymentMethodLabels } from '@/utils/sale-labels'

type Props = {
  account: CreditAccount
  onChanged?: (message: string) => void // si viene, y la ficha está abierta, se ofrecen el pago y los recargos
}

const day = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })

// Una ficha de cuenta corriente con el formato del remito: los artículos con su precio y total, los recargos, los pagos y el saldo.
// El saldo y la mora los calcula el servidor (D17, D18); acá solo se muestran.
export default function AccountSheet({ account, onChanged }: Props) {
  const open = account.status === 'OPEN'

  return (
    <div className="grid gap-4 text-sm">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Desde <strong>{day.format(new Date(account.openedAt))}</strong>
        </span>
        {open ? (
          <span>
            Vence <strong>{day.format(new Date(account.dueDate))}</strong>
          </span>
        ) : (
          <span>
            Cancelada el <strong>{day.format(new Date(account.closedAt ?? account.dueDate))}</strong>
          </span>
        )}
        {open &&
          (account.overdue ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
              Vencida{account.monthsOverdue > 0 ? ` (${account.monthsOverdue} ${account.monthsOverdue === 1 ? 'mes' : 'meses'})` : ''}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Al día</span>
          ))}
      </p>

      <ArticlesTable sales={account.sales} totalLabel="Total de las ventas" />

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

      <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border border-border bg-white p-3 print:border-black">
        <dt>Saldo</dt>
        <dd className="text-right font-semibold">{peso.format(Number(account.balance))}</dd>
        {open && Number(account.pendingSurchargesTotal) > 0 && (
          <>
            <dt>Recargos que ya corresponden</dt>
            <dd className="text-right">+ {peso.format(Number(account.pendingSurchargesTotal))}</dd>
          </>
        )}
        {open && (
          <>
            <dt className="font-semibold">A pagar hoy</dt>
            <dd className="text-right font-semibold">{peso.format(Number(account.payable))}</dd>
          </>
        )}
      </dl>

      {open && onChanged && <AccountActions account={account} onChanged={onChanged} />}
    </div>
  )
}
