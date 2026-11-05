import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { buildRemito, type FieldKey, type RemitoTotals, type RemitoValues } from '@/utils/remito'
import RemitoSheet, { REMITO_ROWS } from './RemitoSheet'

const vacios: RemitoValues = {
  customerName: 'María Gómez',
  address: 'España 123',
  locality: '',
  taxCondition: '',
  cuit: '',
  number: '',
  remitoNumber: '',
  bizName: 'Comercio de prueba',
  bizOwner: 'Titular de prueba',
  bizAddress: 'Calle 1\nFormosa',
  bizTaxCondition: 'MONOTAX',
  bizCuit: '20-11111111-1',
  bizGrossIncome: '123-456',
  bizActivityStart: '03/2011',
}

const sinRenglones: RemitoTotals = buildRemito(null)
const fecha = { day: '05', month: '11', year: '2026' }

type Extra = Partial<Parameters<typeof RemitoSheet>[0]>

// Un remito que guarda lo que se escribe, como lo hace la pantalla.
function Remito({ initial = vacios, changed = new Set<FieldKey>(), ...extra }: Extra & { initial?: RemitoValues }) {
  const [values, setValues] = useState(initial)
  return (
    <RemitoSheet
      values={values}
      changed={changed}
      onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      accountFields
      condition="CURRENT_ACCOUNT"
      date={fecha}
      onDateChange={() => {}}
      remito={sinRenglones}
      dueDate={null}
      overdueMonths={null}
      {...extra}
    />
  )
}

const linea = (kind: 'item' | 'surcharge' | 'payment', detail: string, total = '$ 10,00') => ({ kind, quantity: kind === 'item' ? '1' : '', detail, unitPrice: '', total })
const conRenglones = (lines: ReturnType<typeof linea>[], extra: Partial<RemitoTotals> = {}): RemitoTotals => ({
  lines,
  totalCents: 0,
  paidCents: 0,
  balanceCents: 0,
  pendingCents: 0,
  payableCents: 0,
  ...extra,
})

describe('RemitoSheet: lo fijo del papel', () => {
  it('tiene la X, la leyenda de documento no válido como factura, Recibí conforme, la barra REMITO y el pie', () => {
    render(<Remito />)

    expect(screen.getByText('X')).toBeInTheDocument()
    expect(screen.getByText('DOCUMENTO NO VÁLIDO COMO FACTURA')).toBeInTheDocument()
    expect(screen.getByText('RECIBÍ CONFORME:')).toBeInTheDocument()
    expect(screen.getByText('REMITO')).toBeInTheDocument()
    expect(screen.getByText(/ORIGINAL para el CLIENTE/)).toBeInTheDocument()
  })

  it('el encabezado muestra los datos del comercio que le llegan (no trae ninguno de fábrica)', () => {
    render(<Remito />)

    expect(screen.getByLabelText('Nombre del comercio')).toHaveValue('Comercio de prueba')
    expect(screen.getByLabelText('Titular')).toHaveValue('Titular de prueba')
    expect(screen.getByLabelText('Domicilio del comercio')).toHaveValue('Calle 1\nFormosa')
    expect(screen.getByLabelText('Condición frente a ARCA del comercio')).toHaveValue('MONOTAX')
    expect(screen.getByRole('option', { name: 'RESPONSABLE MONOTRIBUTO' })).toBeInTheDocument()
    expect(screen.getByLabelText('C.U.I.T. del comercio')).toHaveValue('20-11111111-1')
    expect(screen.getByLabelText('Ingresos Brutos')).toHaveValue('123-456')
    expect(screen.getByLabelText('Inicio de actividades')).toHaveValue('03/2011')
  })

  it('con el encabezado vacío muestra guías para completarlo', () => {
    render(<Remito initial={{ ...vacios, bizName: '', bizOwner: '', bizAddress: '', bizTaxCondition: '', bizCuit: '', bizGrossIncome: '', bizActivityStart: '' }} />)

    expect(screen.getByLabelText('Nombre del comercio')).toHaveAttribute('placeholder', 'Nombre del comercio')
    expect(screen.getByLabelText('Titular')).toHaveAttribute('placeholder', 'Titular')
    expect(screen.getByLabelText('Domicilio del comercio')).toHaveAttribute('placeholder', 'Domicilio del comercio')
    expect(screen.getByLabelText('Condición frente a ARCA del comercio')).toHaveValue('')
    expect(screen.getByLabelText('C.U.I.T. del comercio')).toHaveAttribute('placeholder', '00-00000000-0')
  })

  it('la fecha va en tres casilleros: día, mes y año', () => {
    render(<Remito />)

    const grupo = screen.getByRole('group', { name: 'Fecha' })
    expect(grupo).toHaveTextContent('FECHA')
    expect(within(grupo).getByLabelText('Día')).toHaveValue('05')
    expect(within(grupo).getByLabelText('Mes')).toHaveValue('11')
    expect(within(grupo).getByLabelText('Año')).toHaveValue('2026')
  })

  it('la fecha se puede cambiar, solo con números', async () => {
    const onDateChange = vi.fn()
    render(<Remito onDateChange={onDateChange} />)

    fireEvent.change(screen.getByLabelText('Día'), { target: { value: '1a2' } })
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '20x26' } })

    expect(onDateChange).toHaveBeenCalledWith('day', '12') // las letras no entran
    expect(onDateChange).toHaveBeenCalledWith('year', '2026')
    expect(screen.getByLabelText('Día')).toHaveAttribute('maxlength', '2')
    expect(screen.getByLabelText('Año')).toHaveAttribute('maxlength', '4')
  })

  it('con la fecha bloqueada (ficha abierta) los casilleros son de solo lectura y avisan por qué', () => {
    render(<Remito dateLocked />)

    for (const parte of ['Día', 'Mes', 'Año']) expect(screen.getByLabelText(parte)).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Día')).toHaveAttribute('title', 'Es el día en que se abrió la ficha')
  })

  it('sin bloquear, los casilleros de la fecha se escriben', () => {
    render(<Remito />)

    expect(screen.getByLabelText('Día')).not.toHaveAttribute('readonly')
  })
})

describe('RemitoSheet: se edita tocando cada dato', () => {
  it.each([
    ['Señor/es', 'María Gómez', 'María del Carmen Gómez'],
    ['Domicilio', 'España 123', 'Belgrano 456'],
    ['Localidad', '', 'Formosa'],
    ['C.U.I.T. del cliente', '', '27-12345678-9'],
    ['Número de ficha', '', '0123'],
    ['Remito Nº', '', '0001-00004567'],
    ['Nombre del comercio', 'Comercio de prueba', 'Otro comercio'],
    ['Titular', 'Titular de prueba', 'Otro titular'],
    ['C.U.I.T. del comercio', '20-11111111-1', '30-71234567-8'],
    ['Ingresos Brutos', '123-456', '999'],
    ['Inicio de actividades', '03/2011', '05/2015'],
  ])('%s', async (label, before, after) => {
    render(<Remito />)
    const campo = screen.getByLabelText(label)
    expect(campo).toHaveValue(before)

    await userEvent.clear(campo)
    await userEvent.type(campo, after)

    expect(campo).toHaveValue(after)
  })

  it('el domicilio del comercio admite varias líneas', async () => {
    render(<Remito />)
    const campo = screen.getByLabelText('Domicilio del comercio')

    await userEvent.type(campo, '{Enter}3601')

    expect(campo).toHaveValue('Calle 1\nFormosa\n3601')
  })

  it('la condición del comercio se elige de la lista', async () => {
    render(<Remito />)

    await userEvent.selectOptions(screen.getByLabelText('Condición frente a ARCA del comercio'), 'EXEMPT')

    expect(screen.getByLabelText('Condición frente a ARCA del comercio')).toHaveValue('EXEMPT')
  })

  it('avisa cada cambio con el campo y el texto nuevo', async () => {
    const onChange = vi.fn()
    render(<RemitoSheet values={vacios} changed={new Set()} onChange={onChange} accountFields condition={null} date={fecha} onDateChange={() => {}} remito={sinRenglones} dueDate={null} overdueMonths={null} />)

    await userEvent.type(screen.getByLabelText('Localidad'), 'F')

    expect(onChange).toHaveBeenCalledWith('locality', 'F')
  })

  it('los campos cambiados sin guardar se resaltan; los demás no', () => {
    render(<Remito changed={new Set<FieldKey>(['locality'])} />)

    expect(screen.getByLabelText('Localidad')).toHaveClass('bg-amber-100')
    expect(screen.getByLabelText('Domicilio')).not.toHaveClass('bg-amber-100')
  })
})

describe('RemitoSheet: condición de IVA del cliente', () => {
  const casilleros = ['Cons. Final', 'Exento', 'Resp. Inscripto', 'Monotributo']

  it('tiene los cuatro casilleros, todos sin tildar si no hay dato', () => {
    render(<Remito />)

    for (const nombre of casilleros) expect(screen.getByRole('radio', { name: nombre })).toHaveAttribute('aria-checked', 'false')
  })

  it('tilda el que corresponde', () => {
    render(<Remito initial={{ ...vacios, taxCondition: 'REGISTERED' }} />)

    expect(screen.getByRole('radio', { name: 'Resp. Inscripto' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Exento' })).toHaveAttribute('aria-checked', 'false')
  })

  it('al tocar uno lo tilda y destilda el anterior', async () => {
    render(<Remito initial={{ ...vacios, taxCondition: 'EXEMPT' }} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Monotributo' }))

    expect(screen.getByRole('radio', { name: 'Monotributo' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Exento' })).toHaveAttribute('aria-checked', 'false')
  })

  it('tocar el tildado lo destilda (vuelve a sin dato)', async () => {
    render(<Remito initial={{ ...vacios, taxCondition: 'EXEMPT' }} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Exento' }))

    expect(screen.getByRole('radio', { name: 'Exento' })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('RemitoSheet: condiciones de venta y números de la ficha', () => {
  it('con ficha abierta tilda "Cuenta Corriente" y no "Contado"; no se tocan (las decide el sistema)', () => {
    render(<Remito />)

    expect(screen.getByRole('img', { name: 'Cuenta Corriente: tildado' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Contado: sin tildar' })).toBeInTheDocument()
  })

  it('con condición "Contado" tilda solo "Contado"', () => {
    render(<Remito condition="CASH" />)

    expect(screen.getByRole('img', { name: 'Contado: tildado' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Cuenta Corriente: sin tildar' })).toBeInTheDocument()
  })

  it('sin condición no tilda ninguna', () => {
    render(<Remito condition={null} />)

    expect(screen.getByRole('img', { name: 'Contado: sin tildar' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Cuenta Corriente: sin tildar' })).toBeInTheDocument()
  })

  it('sin ficha abierta "Nº" y "Remito Nº" no se pueden completar, y dicen por qué', () => {
    render(<Remito accountFields={false} />)

    for (const nombre of ['Número de ficha', 'Remito Nº']) {
      expect(screen.getByLabelText(nombre)).toBeDisabled()
      expect(screen.getByLabelText(nombre)).toHaveAttribute('title', 'Se puede completar cuando el cliente tiene una ficha abierta')
    }
    expect(screen.getByLabelText('Localidad')).toBeEnabled()
  })

  it('con ficha abierta se pueden completar', () => {
    render(<Remito />)

    expect(screen.getByLabelText('Número de ficha')).toBeEnabled()
    expect(screen.getByLabelText('Remito Nº')).toBeEnabled()
  })
})

describe('RemitoSheet: renglones y totales', () => {
  it('los renglones son de solo lectura: no hay campos para escribir en la grilla', () => {
    render(<Remito remito={conRenglones([linea('item', 'Cuaderno rayado')])} />)

    const grilla = screen.getByText('Cuaderno rayado').closest('table')!
    expect(within(grilla).queryAllByRole('textbox')).toHaveLength(0)
  })

  it('cada renglón muestra cantidad, detalle, precio unitario y total', () => {
    render(<Remito remito={conRenglones([{ kind: 'item', quantity: '3', detail: 'Cuaderno rayado', unitPrice: '$ 100,00', total: '$ 300,00' }])} />)

    const celdas = within(screen.getByText('Cuaderno rayado').closest('tr')!).getAllByRole('cell')
    expect(celdas.map((c) => c.textContent)).toEqual(['3', 'Cuaderno rayado', '$ 100,00', '$ 300,00'])
  })

  it('la grilla tiene 12 renglones, como el talonario: los que no se usan quedan en blanco', () => {
    render(<Remito remito={conRenglones([linea('item', 'Cuaderno rayado')])} />)

    expect(REMITO_ROWS).toBe(12)
    expect(within(screen.getByText('Cuaderno rayado').closest('tbody')!).getAllByRole('row', { hidden: true })).toHaveLength(12)
  })

  it('sin renglones muestra los 12 vacíos y los totales en cero', () => {
    render(<Remito />)

    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(1 + 12) // encabezado de la tabla + renglones
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?0,00/)
    expect(screen.getByTestId('remito-balance')).toHaveTextContent(/\$\s?0,00/)
  })

  it('con más de 12 renglones la grilla crece; con exactamente 12 no agrega en blanco', () => {
    const muchos = (n: number) => conRenglones(Array.from({ length: n }, (_, i) => linea('item', `Artículo ${i + 1}`)))
    const { unmount } = render(<Remito remito={muchos(15)} />)
    expect(within(screen.getByText('Artículo 1').closest('tbody')!).getAllByRole('row', { hidden: true })).toHaveLength(15)
    unmount()

    render(<Remito remito={muchos(12)} />)
    expect(within(screen.getByText('Artículo 1').closest('tbody')!).getAllByRole('row', { hidden: true })).toHaveLength(12)
  })

  it('los renglones que no son artículos (recargo, pago) van en cursiva; los artículos no', () => {
    render(<Remito remito={conRenglones([linea('item', 'Cuaderno'), linea('surcharge', 'Recargo'), linea('payment', 'Pago')])} />)

    expect(screen.getByText('Cuaderno')).not.toHaveClass('italic')
    for (const detalle of ['Recargo', 'Pago']) expect(screen.getByText(detalle)).toHaveClass('italic')
  })

  it('el pie muestra TOTAL, PAGADO y SALDO en pesos', () => {
    render(<Remito remito={conRenglones([], { totalCents: 123486, paidCents: 20000, balanceCents: 103486 })} />)

    expect(screen.getByTestId('remito-total')).toHaveTextContent(/TOTAL \$\s*\$\s?1\.234,86/)
    expect(screen.getByTestId('remito-paid')).toHaveTextContent(/PAGADO \$\s*\$\s?200,00/)
    expect(screen.getByTestId('remito-balance')).toHaveTextContent(/SALDO \$\s*\$\s?1\.034,86/)
  })

  it('con recargos que ya corresponden los muestra y calcula "A pagar hoy"; sin ellos no', () => {
    const { unmount } = render(<Remito remito={conRenglones([], { balanceCents: 100000, pendingCents: 5000, payableCents: 105000 })} />)
    expect(screen.getByTestId('remito-pending')).toHaveTextContent(/\$\s?50,00/)
    expect(screen.getByTestId('remito-payable')).toHaveTextContent(/A PAGAR HOY \$\s*\$\s?1\.050,00/)
    unmount()

    render(<Remito remito={conRenglones([], { balanceCents: 100000 })} />)
    expect(screen.queryByTestId('remito-pending')).not.toBeInTheDocument()
    expect(screen.queryByTestId('remito-payable')).not.toBeInTheDocument()
  })

  it('muestra el vencimiento, y "VENCIDA" con los meses de atraso solo si está vencida', () => {
    const { unmount } = render(<Remito dueDate="2026-04-10T15:00:00.000Z" overdueMonths={null} />)
    expect(screen.getByTestId('remito-due')).toHaveTextContent(/Vence 10\/4\/26/)
    expect(screen.getByTestId('remito-due')).not.toHaveTextContent('VENCIDA')
    unmount()

    const { unmount: u2 } = render(<Remito dueDate="2026-04-10T15:00:00.000Z" overdueMonths={2} />)
    expect(screen.getByTestId('remito-due')).toHaveTextContent('VENCIDA (2 meses)')
    u2()

    const { unmount: u3 } = render(<Remito dueDate="2026-04-10T15:00:00.000Z" overdueMonths={1} />)
    expect(screen.getByTestId('remito-due')).toHaveTextContent('VENCIDA (1 mes)')
    u3()

    render(<Remito dueDate="2026-04-10T15:00:00.000Z" overdueMonths={0} />)
    expect(screen.getByTestId('remito-due')).toHaveTextContent(/VENCIDA$/)
  })

  it('sin ficha abierta no hay vencimiento', () => {
    render(<Remito />)

    expect(screen.queryByTestId('remito-due')).not.toBeInTheDocument()
  })
})

describe('RemitoSheet: tocar el pie para registrar un pago', () => {
  it('con ficha abierta el pie es un botón que avisa al tocarlo', async () => {
    const onPayClick = vi.fn()
    render(<Remito onPayClick={onPayClick} />)

    await userEvent.click(screen.getByRole('button', { name: 'Registrar un pago' }))

    expect(onPayClick).toHaveBeenCalledTimes(1)
  })

  it('sin ficha abierta no hay botón de pago', () => {
    render(<Remito />)

    expect(screen.queryByRole('button', { name: 'Registrar un pago' })).not.toBeInTheDocument()
  })
})

describe('RemitoSheet: sello PAGADO', () => {
  it('sin "paid" no hay sello', () => {
    render(<Remito />)

    expect(screen.queryByTestId('remito-paid-stamp')).not.toBeInTheDocument()
  })

  it('con "paid" el sello PAGADO queda dentro del remito, sin recibir toques', () => {
    render(<Remito paid />)

    const sello = screen.getByTestId('remito-paid-stamp')
    expect(sello).toHaveTextContent('PAGADO')
    expect(screen.getByTestId('remito').contains(sello)).toBe(true)
    expect(sello.parentElement).toHaveClass('pointer-events-none')
  })

  it('el sello no tapa los campos: siguen editables', async () => {
    render(<Remito paid />)

    await userEvent.type(screen.getByLabelText('Localidad'), 'F')

    expect(screen.getByLabelText('Localidad')).toHaveValue('F')
  })

  it('una ficha pagada muestra cuándo se canceló y no el vencimiento', () => {
    render(<Remito paid closedAt="2026-03-20T10:00:00.000Z" dueDate="2026-04-10T15:00:00.000Z" />)

    expect(screen.getByTestId('remito-closed')).toHaveTextContent('Cancelada el 20/3/26')
    expect(screen.queryByTestId('remito-due')).not.toBeInTheDocument()
  })

  it('sin fecha de cancelación muestra el vencimiento', () => {
    render(<Remito dueDate="2026-04-10T15:00:00.000Z" />)

    expect(screen.getByTestId('remito-due')).toBeInTheDocument()
    expect(screen.queryByTestId('remito-closed')).not.toBeInTheDocument()
  })
})
