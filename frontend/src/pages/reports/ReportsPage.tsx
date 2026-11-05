import { useEffect, useState, type FormEvent } from 'react'
import ChartCard from '@/components/reports/ChartCard'
import { HorizontalBars, SalesByDayChart } from '@/components/reports/charts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listProducts } from '@/services/products/product.service'
import { getDebtReport, getSalesReport } from '@/services/reports/report.service'
import type { Product } from '@/types/product.types'
import type { DateRange, DebtReport, SalesReport } from '@/types/report.types'
import { describeError } from '@/utils/errors'
import { fullDay, peso } from '@/utils/format'
import { reportMethodLabels } from '@/utils/report-labels'

const day = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })
const th = 'px-3 py-2 font-medium'
const tableBox = 'overflow-x-auto rounded-md border border-border'
const thead = 'border-b border-border bg-muted text-left text-muted-foreground'

// Reportes y estadísticas (D19): ventas del período, medios de pago, más vendidos, stock bajo y deuda de clientes.
// Todo lo calcula la API; acá se muestra. El período por defecto lo elige la API (últimos 30 días) y se refleja en los campos.
export default function ReportsPage() {
  const [range, setRange] = useState<DateRange | undefined>(undefined) // undefined = período por defecto
  const [draft, setDraft] = useState<DateRange>({ from: '', to: '' })
  const [sales, setSales] = useState<SalesReport | null>(null)
  const [debt, setDebt] = useState<DebtReport | null>(null)
  const [lowStock, setLowStock] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getSalesReport(range)
      .then((report) => {
        if (ignore) return
        setSales(report)
        setDraft({ from: report.from, to: report.to })
        setError(null)
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [range])

  // Deuda y stock bajo no dependen del período: se piden una sola vez.
  useEffect(() => {
    let ignore = false
    Promise.all([getDebtReport(), listProducts({ search: '', categoryId: '', status: 'active', lowStockOnly: true })])
      .then(([debtReport, products]) => {
        if (ignore) return
        setDebt(debtReport)
        setLowStock(products)
      })
      .catch((e) => {
        if (!ignore) setError(describeError(e))
      })
    return () => {
      ignore = true
    }
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (draft.from && draft.to) setRange({ from: draft.from, to: draft.to })
  }

  const noSales = sales !== null && sales.totals.count === 0

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Reportes</h2>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Desde
          <Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">
          Hasta
          <Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </label>
        <Button type="submit" disabled={!draft.from || !draft.to}>
          Ver período
        </Button>
        <Button type="button" variant="outline" onClick={() => setRange(undefined)}>
          Últimos 30 días
        </Button>
      </form>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {sales === null && !error && <p className="text-muted-foreground">Cargando…</p>}

      {sales && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Ventas confirmadas del {fullDay(sales.from)} al {fullDay(sales.to)}. Las anuladas no se cuentan.
          </p>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Tile label="Total vendido" value={peso.format(Number(sales.totals.total))} testId="tile-total" />
            <Tile label="Ventas" value={String(sales.totals.count)} testId="tile-count" />
            <Tile label="Ticket promedio" value={peso.format(Number(sales.totals.average))} testId="tile-average" />
          </div>

          {noSales ? (
            <p className="mb-6 rounded-md border border-border bg-white p-4 text-muted-foreground">No hay ventas en este período.</p>
          ) : (
            <div className="mb-6 grid gap-6">
              <ChartCard
                title="Ventas por día"
                chart={<SalesByDayChart data={sales.byDay.map((d) => ({ date: d.date, count: d.count, total: Number(d.total) }))} />}
                table={
                  <div className={tableBox}>
                    <table className="w-full text-sm">
                      <thead className={thead}>
                        <tr>
                          <th className={th}>Día</th>
                          <th className={`${th} text-right`}>Ventas</th>
                          <th className={`${th} text-right`}>Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sales.byDay.map((d) => (
                          <tr key={d.date}>
                            <td className="px-3 py-2">{fullDay(d.date)}</td>
                            <td className="px-3 py-2 text-right">{d.count}</td>
                            <td className="px-3 py-2 text-right">{peso.format(Number(d.total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              />

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Ventas por medio de pago"
                  chart={
                    <HorizontalBars
                      ariaLabel="Gráfico de barras: ventas por medio de pago"
                      data={sales.byPaymentMethod.map((m) => ({
                        name: reportMethodLabels[m.method],
                        value: Number(m.total),
                        label: peso.format(Number(m.total)),
                      }))}
                    />
                  }
                  table={
                    <div className={tableBox}>
                      <table className="w-full text-sm">
                        <thead className={thead}>
                          <tr>
                            <th className={th}>Medio de pago</th>
                            <th className={`${th} text-right`}>Ventas</th>
                            <th className={`${th} text-right`}>Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sales.byPaymentMethod.map((m) => (
                            <tr key={m.method}>
                              <td className="px-3 py-2">{reportMethodLabels[m.method]}</td>
                              <td className="px-3 py-2 text-right">{m.count}</td>
                              <td className="px-3 py-2 text-right">{peso.format(Number(m.total))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                />

                <ChartCard
                  title="Productos más vendidos"
                  chart={
                    <HorizontalBars
                      ariaLabel="Gráfico de barras: productos más vendidos, por unidades"
                      data={sales.topProducts.map((p) => ({
                        name: p.productName,
                        value: p.quantity,
                        label: `${p.quantity} ${p.quantity === 1 ? 'unidad' : 'unidades'}`,
                      }))}
                    />
                  }
                  table={
                    <div className={tableBox}>
                      <table className="w-full text-sm">
                        <thead className={thead}>
                          <tr>
                            <th className={th}>Producto</th>
                            <th className={`${th} text-right`}>Unidades</th>
                            <th className={`${th} text-right`}>Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sales.topProducts.map((p) => (
                            <tr key={p.productId}>
                              <td className="px-3 py-2">{p.productName}</td>
                              <td className="px-3 py-2 text-right">{p.quantity}</td>
                              <td className="px-3 py-2 text-right">{peso.format(Number(p.total))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                />
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold">Stock bajo</h3>
          {lowStock === null ? (
            !error && <p className="text-muted-foreground">Cargando…</p>
          ) : lowStock.length === 0 ? (
            <p className="text-muted-foreground">No hay productos con stock bajo.</p>
          ) : (
            <div className={tableBox}>
              <table className="w-full text-sm">
                <thead className={thead}>
                  <tr>
                    <th className={th}>Producto</th>
                    <th className={`${th} text-right`}>Stock</th>
                    <th className={`${th} text-right`}>Mínimo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lowStock.map((product) => (
                    <tr key={product.id}>
                      <td className="px-3 py-2">{product.name}</td>
                      <td className="px-3 py-2 text-right font-medium">{product.stock}</td>
                      <td className="px-3 py-2 text-right">{product.minStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-md border border-border bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold">Deuda de clientes</h3>
          {debt === null ? (
            !error && <p className="text-muted-foreground">Cargando…</p>
          ) : debt.accounts.length === 0 ? (
            <p className="text-muted-foreground">No hay cuentas pendientes.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                A pagar hoy en total: <strong data-testid="debt-total">{peso.format(Number(debt.totalPayable))}</strong>
                {debt.totalPayable !== debt.totalBalance && <> (saldo {peso.format(Number(debt.totalBalance))} + recargos que ya corresponden)</>}
              </p>
              <div className={tableBox}>
                <table className="w-full text-sm">
                  <thead className={thead}>
                    <tr>
                      <th className={th}>Cliente</th>
                      <th className={th}>Vence</th>
                      <th className={`${th} text-right`}>A pagar</th>
                      <th className={th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {debt.accounts.map((account) => (
                      <tr key={account.accountId}>
                        <td className="px-3 py-2">{account.customer.name}</td>
                        <td className="whitespace-nowrap px-3 py-2">{day.format(new Date(account.dueDate))}</td>
                        <td className="px-3 py-2 text-right">{peso.format(Number(account.payable))}</td>
                        <td className="px-3 py-2">
                          {account.overdue ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Vencida</span>
                          ) : (
                            'Al día'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  )
}

function Tile({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold" data-testid={testId}>
        {value}
      </p>
    </div>
  )
}
