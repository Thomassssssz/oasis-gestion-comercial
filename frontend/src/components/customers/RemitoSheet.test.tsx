import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { business } from '@/utils/business'
import RemitoSheet, { REMITO_ROWS, type RemitoSale } from './RemitoSheet'

const date = { day: '05', month: '11', year: '2026' }

const venta = (extra: Partial<RemitoSale> = {}): RemitoSale => ({
  status: 'CONFIRMED',
  discount: '0.00',
  total: '350.00',
  items: [
    { productName: 'Cuaderno rayado', quantity: 3, unitPrice: '100.00', subtotal: '300.00' },
    { productName: 'Lapicera azul', quantity: 2, unitPrice: '25.00', subtotal: '50.00' },
  ],
  ...extra,
})

const props = { customerName: 'María Gómez', address: 'España 123', condition: 'CURRENT_ACCOUNT' as const, date }

describe('RemitoSheet: encabezado', () => {
  it('lleva los datos del emisor tal como en el remito en papel', () => {
    render(<RemitoSheet {...props} sales={[]} />)

    expect(screen.getByText(business.name)).toBeInTheDocument()
    expect(screen.getByText(`de ${business.owner}`)).toBeInTheDocument()
    for (const line of business.addressLines) expect(screen.getByText(line)).toBeInTheDocument()
    expect(screen.getByText(business.taxCondition)).toBeInTheDocument()
    expect(screen.getByText(business.cuit)).toBeInTheDocument()
    expect(screen.getByText(business.grossIncome)).toBeInTheDocument()
    expect(screen.getByText(business.activityStart)).toBeInTheDocument()
    expect(screen.getByText('X')).toBeInTheDocument()
    expect(screen.getByText('DOCUMENTO NO VÁLIDO COMO FACTURA')).toBeInTheDocument()
    expect(screen.getByText('REMITO')).toBeInTheDocument()
    expect(screen.getByText(/ORIGINAL para el CLIENTE/)).toBeInTheDocument()
  })

  it('los datos del emisor son los de la foto del remito', () => {
    expect(business).toMatchObject({
      name: 'Ediciones Oasis',
      owner: 'DIEGO FRANCISCO SCAGLIA',
      taxCondition: 'RESPONSABLE MONOTRIBUTO',
      cuit: '20-30255539-8',
      grossIncome: '01-20-30255539-8',
      activityStart: '03/2011',
    })
    expect(business.addressLines).toEqual(['Bº LA PLATA - MZ. 50 - LOTE A', '3601 - HERRADURA', 'FORMOSA'])
  })

  it('la fecha va en tres casilleros: día, mes y año', () => {
    render(<RemitoSheet {...props} sales={[]} />)

    const fecha = screen.getByLabelText('Fecha')
    expect(fecha).toHaveTextContent('FECHA')
    expect(within(fecha).getByText('05')).toBeInTheDocument()
    expect(within(fecha).getByText('11')).toBeInTheDocument()
    expect(within(fecha).getByText('2026')).toBeInTheDocument()
    expect(fecha.textContent).toMatch(/05.*11.*2026/) // en ese orden: día, mes, año
  })
})

describe('RemitoSheet: datos del cliente', () => {
  it('lleva el nombre y el domicilio; localidad, IVA, CUIT y número de remito quedan para completar a mano', () => {
    render(<RemitoSheet {...props} sales={[]} />)

    const remito = screen.getByTestId('remito')
    expect(within(remito).getByText('María Gómez')).toBeInTheDocument()
    expect(within(remito).getByText('España 123')).toBeInTheDocument()
    expect(within(remito).getByText('LOCALIDAD:')).toBeInTheDocument()
    expect(within(remito).getByText('I.V.A.')).toBeInTheDocument()
    for (const iva of ['Cons. Final', 'Exento', 'Resp. Inscripto', 'Monotributo']) {
      expect(within(remito).getByRole('img', { name: `${iva}: sin tildar` })).toBeInTheDocument()
    }
    expect(within(remito).getByText('Remito Nº')).toBeInTheDocument()
  })

  it('sin domicilio deja el renglón en blanco', () => {
    render(<RemitoSheet {...props} address={null} sales={[]} />)

    const domicilio = screen.getByText('DOMICILIO:').parentElement!
    expect(domicilio.textContent).toBe('DOMICILIO: ')
  })

  it('con ficha abierta tilda "Cuenta Corriente" y no "Contado"', () => {
    render(<RemitoSheet {...props} sales={[venta()]} />)

    expect(screen.getByRole('img', { name: 'Cuenta Corriente: tildado' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Contado: sin tildar' })).toBeInTheDocument()
  })

  it('con condición "Contado" tilda solo "Contado"', () => {
    render(<RemitoSheet {...props} condition="CASH" sales={[venta()]} />)

    expect(screen.getByRole('img', { name: 'Contado: tildado' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Cuenta Corriente: sin tildar' })).toBeInTheDocument()
  })

  it('sin condición no tilda ninguna', () => {
    render(<RemitoSheet {...props} condition={null} sales={[]} />)

    expect(screen.getByRole('img', { name: 'Contado: sin tildar' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Cuenta Corriente: sin tildar' })).toBeInTheDocument()
  })
})

describe('RemitoSheet: renglones y total', () => {
  it('cada artículo es un renglón con cantidad, detalle, precio unitario y total', () => {
    render(<RemitoSheet {...props} sales={[venta()]} />)

    const fila = screen.getByText('Cuaderno rayado').closest('tr')!
    const celdas = within(fila).getAllByRole('cell')
    expect(celdas[0]).toHaveTextContent('3')
    expect(celdas[1]).toHaveTextContent('Cuaderno rayado')
    expect(celdas[2]).toHaveTextContent(/\$\s?100,00/)
    expect(celdas[3]).toHaveTextContent(/\$\s?300,00/)
  })

  it('la grilla tiene 12 renglones, como el talonario: los que no se usan quedan en blanco', () => {
    render(<RemitoSheet {...props} sales={[venta()]} />)

    expect(REMITO_ROWS).toBe(12)
    const cuerpo = screen.getByText('Cuaderno rayado').closest('tbody')!
    expect(within(cuerpo).getAllByRole('row', { hidden: true })).toHaveLength(12)
  })

  it('sin ventas muestra los 12 renglones vacíos y el total en cero', () => {
    render(<RemitoSheet {...props} sales={[]} />)

    const cuerpo = screen.getAllByRole('row', { hidden: true })
    expect(cuerpo).toHaveLength(1 + 12) // encabezado de la tabla + renglones
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?0,00/)
  })

  it('con más de 12 artículos la grilla crece en lugar de cortar la lista', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ productName: `Artículo ${i + 1}`, quantity: 1, unitPrice: '10.00', subtotal: '10.00' }))
    render(<RemitoSheet {...props} sales={[venta({ items, total: '150.00' })]} />)

    expect(screen.getByText('Artículo 15')).toBeInTheDocument()
    const cuerpo = screen.getByText('Artículo 1').closest('tbody')!
    expect(within(cuerpo).getAllByRole('row', { hidden: true })).toHaveLength(15)
  })

  it('con exactamente 12 artículos no agrega renglones en blanco', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ productName: `Artículo ${i + 1}`, quantity: 1, unitPrice: '10.00', subtotal: '10.00' }))
    render(<RemitoSheet {...props} sales={[venta({ items, total: '120.00' })]} />)

    const cuerpo = screen.getByText('Artículo 1').closest('tbody')!
    expect(within(cuerpo).getAllByRole('row', { hidden: true })).toHaveLength(12)
  })

  it('el descuento va en un renglón propio, en cursiva, y se resta en el TOTAL', () => {
    render(<RemitoSheet {...props} sales={[venta({ discount: '50.00', total: '300.00' })]} />)

    const descuento = screen.getByText('Descuento').closest('tr')!
    expect(descuento).toHaveTextContent(/−\s*\$\s?50,00/)
    expect(screen.getByText('Descuento')).toHaveClass('italic')
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?300,00/)
  })

  it('sin descuento no hay renglón de descuento', () => {
    render(<RemitoSheet {...props} sales={[venta()]} />)

    expect(screen.queryByText('Descuento')).not.toBeInTheDocument()
  })

  it('suma el total de todas las ventas confirmadas en centavos, sin errores de decimales', () => {
    const sales = [venta({ total: '0.10' }), venta({ total: '0.20' }), venta({ total: '1234.56' })]
    render(<RemitoSheet {...props} sales={sales} />)

    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?1\.234,86/)
  })

  it('las ventas anuladas no aparecen ni suman', () => {
    const anulada = venta({ status: 'ANNULLED', total: '999.00', items: [{ productName: 'Anulado', quantity: 1, unitPrice: '999.00', subtotal: '999.00' }] })
    render(<RemitoSheet {...props} sales={[venta(), anulada]} />)

    expect(screen.queryByText('Anulado')).not.toBeInTheDocument()
    expect(screen.getByTestId('remito-total')).toHaveTextContent(/\$\s?350,00/)
  })

  it('tiene la línea de "Recibí conforme" para firmar', () => {
    render(<RemitoSheet {...props} sales={[]} />)

    expect(screen.getByText('RECIBÍ CONFORME:')).toBeInTheDocument()
  })
})
