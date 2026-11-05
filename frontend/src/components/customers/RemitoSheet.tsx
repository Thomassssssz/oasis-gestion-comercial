import { business } from '@/utils/business'
import { peso } from '@/utils/format'

// Lo mínimo de una venta para armar los renglones del remito.
export type RemitoSale = {
  status: 'CONFIRMED' | 'ANNULLED'
  discount: string
  total: string
  items: { productName: string; quantity: number; unitPrice: string; subtotal: string }[]
}

type Props = {
  customerName: string
  address: string | null
  sales: RemitoSale[]
  condition: 'CASH' | 'CURRENT_ACCOUNT' | null // cuál de las dos condiciones de venta se tilda; null = ninguna (se marca a mano)
  date: { day: string; month: string; year: string }
}

// El talonario tiene 12 renglones; si hay más artículos, la grilla crece en lugar de cortar la lista.
export const REMITO_ROWS = 12

type Line = { quantity: string; detail: string; unitPrice: string; total: string; italic?: boolean }

// Ficha formal del comercio (remito "X", documento no válido como factura), armada como la hoja de papel:
// encabezado del emisor, datos del cliente, grilla de renglones y TOTAL. Lo que el sistema no guarda
// (localidad, condición de IVA, CUIT del cliente, número de remito) queda en blanco para completar a mano.
// Las ventas anuladas no figuran: el cliente no se llevó esos artículos. El total sale de los importes que calcula el servidor.
export default function RemitoSheet({ customerName, address, sales, condition, date }: Props) {
  const confirmed = sales.filter((sale) => sale.status === 'CONFIRMED')

  const lines: Line[] = confirmed.flatMap((sale) => [
    ...sale.items.map((item) => ({
      quantity: String(item.quantity),
      detail: item.productName,
      unitPrice: peso.format(Number(item.unitPrice)),
      total: peso.format(Number(item.subtotal)),
    })),
    ...(Number(sale.discount) > 0
      ? [{ quantity: '', detail: 'Descuento', unitPrice: '', total: `− ${peso.format(Number(sale.discount))}`, italic: true }]
      : []),
  ])
  const blanks = Math.max(0, REMITO_ROWS - lines.length)

  // Se suma en centavos para no arrastrar errores de decimales.
  const totalCents = confirmed.reduce((sum, sale) => sum + Math.round(Number(sale.total) * 100), 0)

  return (
    <div // Los fondos negros (la X y la barra REMITO) se imprimen aunque el navegador tenga desactivados los fondos.
      className="mx-auto w-full max-w-3xl border-2 border-black bg-white text-black [-webkit-print-color-adjust:exact] [print-color-adjust:exact]"
      data-testid="remito">
      {/* Encabezado del emisor */}
      <div className="grid grid-cols-[1fr_auto_1fr] border-b-2 border-black">
        <div className="p-3 text-center">
          <p className="font-serif text-3xl font-bold leading-none">{business.name}</p>
          <p className="mt-1 text-sm font-semibold">de {business.owner}</p>
          <p className="mt-2 text-sm">
            {business.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="mt-1 text-sm font-bold">{business.taxCondition}</p>
        </div>

        <div className="flex items-start px-2">
          <span className="flex h-20 w-14 items-center justify-center bg-black text-5xl font-bold text-white">X</span>
        </div>

        <div className="p-3 text-sm">
          <p className="text-lg font-semibold">
            Nº <span className="inline-block w-32 border-b border-black align-bottom">&nbsp;</span>
          </p>
          <div className="mt-2 flex items-center gap-1" aria-label="Fecha">
            <span className="rounded-full border border-black px-2 py-0.5 text-xs font-bold">FECHA</span>
            {[date.day, date.month, date.year].map((part, i) => (
              <span key={i} className="min-w-9 rounded-lg border border-black px-1 py-0.5 text-center font-semibold">
                {part}
              </span>
            ))}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-xs">
            <dt>C.U.I.T. Nº</dt>
            <dd className="text-right">{business.cuit}</dd>
            <dt>INGRESOS BRUTOS</dt>
            <dd className="text-right">{business.grossIncome}</dd>
            <dt>INICIO DE ACTIVIDADES</dt>
            <dd className="text-right">{business.activityStart}</dd>
          </dl>
        </div>
      </div>

      <p className="border-b-2 border-black py-0.5 text-center text-sm font-bold">DOCUMENTO NO VÁLIDO COMO FACTURA</p>

      {/* Datos del cliente */}
      <div className="grid gap-2 border-b border-black p-3 text-sm">
        <p>
          <strong>SEÑOR/ES:</strong> <span className="border-b border-dotted border-black">{customerName}</span>
        </p>
        <p className="grid grid-cols-[1fr_1fr] gap-4">
          <span>
            <strong>DOMICILIO:</strong> <span className="border-b border-dotted border-black">{address ?? ''}</span>
          </span>
          <span>
            <strong>LOCALIDAD:</strong> <span className="inline-block min-w-24 border-b border-dotted border-black">&nbsp;</span>
          </span>
        </p>
      </div>

      <div className="grid grid-cols-[3fr_2fr] border-b border-black text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-r border-black px-3 py-2">
          <strong>I.V.A.</strong>
          <Radio label="Cons. Final" />
          <Radio label="Exento" />
          <Radio label="Resp. Inscripto" />
          <Radio label="Monotributo" />
        </div>
        <div className="px-3 py-2 font-bold">C.U.I.T. Nº</div>
      </div>

      <div className="grid grid-cols-[3fr_2fr] border-b-2 border-black text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-r border-black px-3 py-2">
          <strong>CONDICIONES DE VENTA</strong>
          <Radio label="Contado" checked={condition === 'CASH'} />
          <Radio label="Cuenta Corriente" checked={condition === 'CURRENT_ACCOUNT'} />
        </div>
        <div className="px-3 py-2 font-semibold">Remito Nº</div>
      </div>

      {/* Grilla de renglones */}
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-xs font-bold">
            <th className="w-14 border-r border-black px-1 py-1 text-left">CANT.</th>
            <th className="border-r border-black px-1 py-1 text-center tracking-widest">DETALLE</th>
            <th className="w-28 border-r border-black px-1 py-1 text-center">PRECIO UNIT.</th>
            <th className="w-28 px-1 py-1 text-center">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="h-8 border-b border-black">
              <td className="border-r border-black px-1">{line.quantity}</td>
              <td className={`truncate border-r border-black px-1 ${line.italic ? 'italic' : ''}`}>{line.detail}</td>
              <td className="border-r border-black px-1 text-right">{line.unitPrice}</td>
              <td className="px-1 text-right">{line.total}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <tr key={`blank-${i}`} className="h-8 border-b border-black" aria-hidden="true">
              <td className="border-r border-black" />
              <td className="border-r border-black" />
              <td className="border-r border-black" />
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pie */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-4 p-3">
        <div className="grid gap-3 text-sm">
          <p>
            <strong>RECIBÍ CONFORME:</strong> <span className="inline-block w-56 border-b border-dotted border-black">&nbsp;</span>
          </p>
          <p className="inline-block bg-black px-6 py-1 text-center text-3xl font-bold tracking-widest text-white">REMITO</p>
        </div>
        <p className="flex items-center gap-2 self-start border border-black px-2 py-3 text-base font-bold" data-testid="remito-total">
          <span>TOTAL $</span>
          <span className="min-w-28 text-right">{peso.format(totalCents / 100)}</span>
        </p>
      </div>

      <p className="border-t-2 border-black px-3 py-1 text-right text-[10px] font-semibold">
        ORIGINAL para el CLIENTE · DUPLICADO para el EMISOR
      </p>
    </div>
  )
}

// Casillero redondo de la hoja de papel; vacío para tildar a mano, o relleno si el sistema ya sabe la respuesta.
function Radio({ label, checked = false }: { label: string; checked?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span
        role="img"
        aria-label={checked ? `${label}: tildado` : `${label}: sin tildar`}
        className={`inline-block size-4 rounded-full border border-black ${checked ? 'bg-black' : ''}`}
      />
    </span>
  )
}
