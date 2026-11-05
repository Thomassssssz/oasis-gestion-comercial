import type { ReportPaymentMethod } from '@/types/report.types'

// Medios de pago de los reportes: los cuatro confirmados más "A crédito" (ventas que se cobran después).
export const reportMethodLabels: Record<ReportPaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  DIGITAL_WALLET: 'Billetera virtual',
  ON_CREDIT: 'A crédito',
}
