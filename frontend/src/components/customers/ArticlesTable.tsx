import { dateTime, peso } from '@/utils/format'

// Lo mínimo que hace falta de una venta para armar las líneas de la ficha (sirve para ventas de cuenta corriente y de contado).
export type SheetSale = {
  id: number
  status: 'CONFIRMED' | 'ANNULLED'
  createdAt: string
  discount: string
  total: string
  items: { productName: string; quantity: number; unitPrice: string; subtotal: string }[]
}

type Props = { sales: SheetSale[]; totalLabel?: string }

// Las líneas de la ficha, como en el remito: cantidad, detalle, precio unitario y total de la línea.
// Una venta anulada se muestra tachada y no suma al total; el descuento va en su propia línea.
export default function ArticlesTable({ sales, totalLabel = 'Total' }: Props) {
  const grandTotal = sales.filter((sale) => sale.status === 'CONFIRMED').reduce((sum, sale) => sum + Number(sale.total) * 100, 0) / 100

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-white print:border-black">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted text-muted-foreground print:border-black print:bg-white print:text-black">
          <tr>
            <th className="px-3 py-2 font-medium">Cant.</th>
            <th className="px-3 py-2 font-medium">Detalle</th>
            <th className="px-3 py-2 text-right font-medium">Precio unit.</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        {sales.map((sale) => {
          const annulled = sale.status === 'ANNULLED'
          return (
            <tbody key={sale.id} className="divide-y divide-border border-t border-border print:divide-gray-400 print:border-black">
              <tr className="bg-muted/40 print:bg-white">
                <th colSpan={4} className="px-3 py-1 text-left text-xs font-medium text-muted-foreground print:text-black">
                  {dateTime.format(new Date(sale.createdAt))} · Venta #{sale.id}
                  {annulled ? ' (anulada: no suma al total)' : ''}
                </th>
              </tr>
              {sale.items.map((item) => (
                <tr key={item.productName} className={annulled ? 'text-muted-foreground line-through' : undefined}>
                  <td className="px-3 py-1.5">{item.quantity}</td>
                  <td className="px-3 py-1.5">{item.productName}</td>
                  <td className="px-3 py-1.5 text-right">{peso.format(Number(item.unitPrice))}</td>
                  <td className="px-3 py-1.5 text-right">{peso.format(Number(item.subtotal))}</td>
                </tr>
              ))}
              {Number(sale.discount) > 0 && (
                <tr className={annulled ? 'text-muted-foreground line-through' : undefined}>
                  <td />
                  <td className="px-3 py-1.5 italic">Descuento</td>
                  <td />
                  <td className="px-3 py-1.5 text-right">− {peso.format(Number(sale.discount))}</td>
                </tr>
              )}
            </tbody>
          )
        })}
        <tfoot className="border-t border-border font-semibold print:border-black">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right">
              {totalLabel}
            </td>
            <td className="px-3 py-2 text-right">{peso.format(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
