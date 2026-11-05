import { EditableArea, EditableSelect, EditableText } from '@/components/customers/EditableField'
import { cn } from '@/lib/utils'
import { businessTaxLabels, taxConditionLabels, type FieldKey, type RemitoTotals, type RemitoValues } from '@/utils/remito'
import { peso } from '@/utils/format'

type Props = {
  values: RemitoValues // lo que se muestra: lo guardado, más lo que se cambió y todavía no se guardó
  changed: ReadonlySet<FieldKey> // los campos cambiados sin guardar (se resaltan en pantalla)
  onChange: (key: FieldKey, value: string) => void
  accountFields: boolean // false = no hay ficha abierta: "Nº" y "Remito Nº" no se pueden completar
  condition: 'CASH' | 'CURRENT_ACCOUNT' | null // cuál de las dos condiciones de venta se tilda; null = ninguna
  date: { day: string; month: string; year: string }
  onDateChange: (part: 'day' | 'month' | 'year', value: string) => void
  dateLocked?: boolean // true = la fecha es la de apertura de la ficha y no se escribe a mano
  remito: RemitoTotals
  dueDate: string | null // vencimiento de la ficha abierta
  overdueMonths: number | null // null = no está vencida
  paid?: boolean // la cuenta se pagó por completo: el remito lleva el sello PAGADO
  closedAt?: string | null // cuándo se canceló (solo en fichas pagadas)
  onPayClick?: () => void // si viene, tocar el pie del remito abre "Registrar pago" (solo con ficha abierta)
}

// El talonario tiene 12 renglones; si hay más, la grilla crece en lugar de cortar la lista.
export const REMITO_ROWS = 12

const day = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' })
const NO_ACCOUNT_HINT = 'Se puede completar cuando el cliente tiene una ficha abierta'

// Ficha formal del comercio (remito "X", documento no válido como factura), armada como la hoja de papel y editable:
// cada dato que el papel deja escribir se toca y se cambia (el cliente, la ficha, el encabezado del comercio).
// Los renglones NO se editan: salen de las ventas y de los pagos (D22/D23). Guardar es cosa de la pantalla que la usa.
export default function RemitoSheet({ values, changed, onChange, accountFields, condition, date, onDateChange, dateLocked = false, remito, dueDate, overdueMonths, paid = false, closedAt = null, onPayClick }: Props) {
  const blanks = Math.max(0, REMITO_ROWS - remito.lines.length)
  const mark = (key: FieldKey) => changed.has(key)
  const text = (key: FieldKey, label: string, className?: string, placeholder = '') => (
    <EditableText label={label} value={values[key]} onValue={(v) => onChange(key, v)} changed={mark(key)} className={className} placeholder={placeholder} />
  )

  return (
    <div // Los fondos negros (la X y la barra REMITO) se imprimen aunque el navegador tenga desactivados los fondos.
      className="relative mx-auto w-full max-w-3xl overflow-hidden border-2 border-black bg-white text-black [-webkit-print-color-adjust:exact] [print-color-adjust:exact]"
      data-testid="remito">
      {/* Cuenta pagada por completo: sello grande cruzado por la mitad del remito (no tapa lo escrito debajo: no recibe toques). */}
      {paid && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span
            data-testid="remito-paid-stamp"
            className="-rotate-[18deg] rounded-xl border-[10px] border-red-700/70 px-10 py-2 text-[7rem] leading-none font-black tracking-[0.2em] text-red-700/70 select-none max-sm:border-4 max-sm:px-4 max-sm:text-5xl">
            PAGADO
          </span>
        </div>
      )}
      {/* Encabezado del emisor: datos del comercio, guardados en la base */}
      <div className="grid grid-cols-[1fr_auto_1fr] border-b-2 border-black">
        <div className="grid content-start gap-1 p-3 text-center">
          {text('bizName', 'Nombre del comercio', 'text-center font-serif text-3xl font-bold leading-none', 'Nombre del comercio')}
          <div className="flex items-center justify-center gap-1 text-sm font-semibold">
            <span>de</span>
            {text('bizOwner', 'Titular', 'flex-1 text-center', 'Titular')}
          </div>
          <EditableArea
            label="Domicilio del comercio"
            rows={3}
            className="text-center text-sm"
            placeholder="Domicilio del comercio"
            value={values.bizAddress}
            onValue={(v) => onChange('bizAddress', v)}
            changed={mark('bizAddress')}
          />
          <EditableSelect
            label="Condición frente a ARCA del comercio"
            placeholder="Condición del comercio"
            className="text-center text-sm font-bold"
            value={values.bizTaxCondition}
            onValue={(v) => onChange('bizTaxCondition', v)}
            changed={mark('bizTaxCondition')}
            options={Object.entries(businessTaxLabels).map(([value, label]) => ({ value, text: label }))}
          />
        </div>

        <div className="flex items-start px-2">
          <span className="flex h-20 w-14 items-center justify-center bg-black text-5xl font-bold text-white">X</span>
        </div>

        <div className="p-3 text-sm">
          <div className="flex items-end gap-1 text-lg font-semibold">
            <span>Nº</span>
            <EditableText
              label="Número de ficha"
              value={values.number}
              onValue={(v) => onChange('number', v)}
              changed={mark('number')}
              disabled={!accountFields}
              title={accountFields ? undefined : NO_ACCOUNT_HINT}
              maxLength={30}
              className="w-32"
            />
          </div>
          <div className="mt-2 flex items-center gap-1" role="group" aria-label="Fecha">
            <span className="rounded-full border border-black px-2 py-0.5 text-xs font-bold">FECHA</span>
            {(['day', 'month', 'year'] as const).map((part) => (
              <input
                key={part}
                aria-label={{ day: 'Día', month: 'Mes', year: 'Año' }[part]}
                inputMode="numeric"
                maxLength={part === 'year' ? 4 : 2}
                value={date[part]}
                onChange={(e) => onDateChange(part, e.target.value.replace(/\D/g, ''))}
                readOnly={dateLocked}
                title={dateLocked ? 'Es el día en que se abrió la ficha' : undefined}
                className={cn(
                  'rounded-lg border border-black bg-transparent px-1 py-0.5 text-center font-semibold outline-none print:hover:bg-transparent',
                  !dateLocked && 'hover:bg-amber-50 focus:bg-amber-50',
                  part === 'year' ? 'w-14' : 'w-9',
                )}
              />
            ))}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] items-end gap-x-2 gap-y-0.5 text-xs">
            <dt>C.U.I.T. Nº</dt>
            <dd>{text('bizCuit', 'C.U.I.T. del comercio', 'text-right', '00-00000000-0')}</dd>
            <dt>INGRESOS BRUTOS</dt>
            <dd>{text('bizGrossIncome', 'Ingresos Brutos', 'text-right', 'Nº')}</dd>
            <dt>INICIO DE ACTIVIDADES</dt>
            <dd>{text('bizActivityStart', 'Inicio de actividades', 'text-right', 'MM/AAAA')}</dd>
          </dl>
        </div>
      </div>

      <p className="border-b-2 border-black py-0.5 text-center text-sm font-bold">DOCUMENTO NO VÁLIDO COMO FACTURA</p>

      {/* Datos del cliente */}
      <div className="grid gap-2 border-b border-black p-3 text-sm">
        <p className="flex items-end gap-2">
          <strong>SEÑOR/ES:</strong>
          {text('customerName', 'Señor/es', 'flex-1')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <p className="flex items-end gap-2">
            <strong>DOMICILIO:</strong>
            {text('address', 'Domicilio', 'min-w-0 flex-1')}
          </p>
          <p className="flex items-end gap-2">
            <strong>LOCALIDAD:</strong>
            {text('locality', 'Localidad', 'min-w-0 flex-1')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[3fr_2fr] border-b border-black text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-r border-black px-3 py-2">
          <strong>I.V.A.</strong>
          {(Object.keys(taxConditionLabels) as (keyof typeof taxConditionLabels)[]).map((value) => (
            <Choice
              key={value}
              label={taxConditionLabels[value]}
              checked={values.taxCondition === value}
              changed={mark('taxCondition')}
              // Tocar el casillero tildado lo destilda (vuelve a "sin dato").
              onClick={() => onChange('taxCondition', values.taxCondition === value ? '' : value)}
            />
          ))}
        </div>
        <div className="flex items-end gap-2 px-3 py-2 font-bold">
          <span className="whitespace-nowrap">C.U.I.T. Nº</span>
          {text('cuit', 'C.U.I.T. del cliente', 'min-w-0 flex-1 font-normal', '00-00000000-0')}
        </div>
      </div>

      <div className="grid grid-cols-[3fr_2fr] border-b-2 border-black text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-r border-black px-3 py-2">
          <strong>CONDICIONES DE VENTA</strong>
          <Choice label="Contado" checked={condition === 'CASH'} />
          <Choice label="Cuenta Corriente" checked={condition === 'CURRENT_ACCOUNT'} />
        </div>
        <div className="flex items-end gap-2 px-3 py-2 font-semibold">
          <span className="whitespace-nowrap">Remito Nº</span>
          <EditableText
            label="Remito Nº"
            value={values.remitoNumber}
            onValue={(v) => onChange('remitoNumber', v)}
            changed={mark('remitoNumber')}
            disabled={!accountFields}
            title={accountFields ? undefined : NO_ACCOUNT_HINT}
            maxLength={30}
            className="min-w-0 flex-1 font-normal"
          />
        </div>
      </div>

      {/* Grilla de renglones (de solo lectura: salen de las ventas y los pagos) */}
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
          {remito.lines.map((line, i) => (
            <tr key={i} className="h-8 border-b border-black">
              <td className="border-r border-black px-1">{line.quantity}</td>
              <td className={cn('truncate border-r border-black px-1', line.kind !== 'item' && 'italic')}>{line.detail}</td>
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

      {/* Pie: firma, y los totales de la cuenta */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-4 p-3">
        <div className="grid gap-3 text-sm">
          <p>
            <strong>RECIBÍ CONFORME:</strong> <span className="inline-block w-56 border-b border-dotted border-black">&nbsp;</span>
          </p>
          <p className="inline-block bg-black px-6 py-1 text-center text-3xl font-bold tracking-widest text-white">REMITO</p>
        </div>

        <Totals remito={remito} dueDate={dueDate} overdueMonths={overdueMonths} closedAt={closedAt} onPayClick={onPayClick} />
      </div>

      <p className="border-t-2 border-black px-3 py-1 text-right text-[10px] font-semibold">
        ORIGINAL para el CLIENTE · DUPLICADO para el EMISOR
      </p>
    </div>
  )
}

function Totals({ remito, dueDate, overdueMonths, closedAt, onPayClick }: Pick<Props, 'remito' | 'dueDate' | 'overdueMonths' | 'onPayClick'> & { closedAt: string | null }) {
  const money = (c: number) => peso.format(c / 100)
  const rows = (
    <>
      <p className="flex items-center justify-between gap-4 text-base font-bold" data-testid="remito-total">
        <span>TOTAL $</span>
        <span className="min-w-28 text-right">{money(remito.totalCents)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-sm" data-testid="remito-paid">
        <span>PAGADO $</span>
        <span className="min-w-28 text-right">{money(remito.paidCents)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-base font-bold" data-testid="remito-balance">
        <span>SALDO $</span>
        <span className="min-w-28 text-right">{money(remito.balanceCents)}</span>
      </p>
      {remito.pendingCents > 0 && (
        <>
          <p className="flex items-center justify-between gap-4 text-xs" data-testid="remito-pending">
            <span>+ Recargos que ya corresponden</span>
            <span className="min-w-28 text-right">{money(remito.pendingCents)}</span>
          </p>
          <p className="flex items-center justify-between gap-4 text-sm font-bold" data-testid="remito-payable">
            <span>A PAGAR HOY $</span>
            <span className="min-w-28 text-right">{money(remito.payableCents)}</span>
          </p>
        </>
      )}
      {closedAt && (
        <p className="text-right text-xs" data-testid="remito-closed">
          Cancelada el {day.format(new Date(closedAt))}
        </p>
      )}
      {dueDate && !closedAt && (
        <p className="text-right text-xs" data-testid="remito-due">
          Vence {day.format(new Date(dueDate))}
          {overdueMonths !== null && (
            <strong className="ml-1 text-red-700 print:text-black">
              · VENCIDA{overdueMonths > 0 ? ` (${overdueMonths} ${overdueMonths === 1 ? 'mes' : 'meses'})` : ''}
            </strong>
          )}
        </p>
      )}
    </>
  )

  const box = 'grid min-w-64 gap-1 self-start border border-black px-3 py-2 text-left'
  // Con ficha abierta, tocar el pie abre "Registrar pago"; en papel no se nota.
  if (!onPayClick) return <div className={box}>{rows}</div>
  return (
    <button type="button" onClick={onPayClick} aria-label="Registrar un pago" title="Tocá para registrar un pago" className={cn(box, 'cursor-pointer hover:bg-amber-50 print:hover:bg-transparent')}>
      {rows}
      <span className="text-center text-[10px] text-gray-500 print:hidden">Tocá acá para registrar un pago</span>
    </button>
  )
}

// Casillero redondo de la hoja de papel. Con `onClick` se puede tocar (IVA del cliente); sin él es solo informativo
// (las condiciones de venta las decide el sistema: hay ficha abierta o no).
function Choice({ label, checked, onClick, changed = false }: { label: string; checked: boolean; onClick?: () => void; changed?: boolean }) {
  const dot = cn('inline-block size-4 rounded-full border border-black', checked && 'bg-black', changed && 'ring-2 ring-amber-400 print:ring-0')
  if (!onClick) {
    return (
      <span className="inline-flex items-center gap-1">
        {label}
        <span role="img" aria-label={checked ? `${label}: tildado` : `${label}: sin tildar`} className={dot} />
      </span>
    )
  }
  return (
    <button type="button" role="radio" aria-checked={checked} aria-label={label} onClick={onClick} className="inline-flex cursor-pointer items-center gap-1">
      {label}
      <span className={dot} />
    </button>
  )
}
