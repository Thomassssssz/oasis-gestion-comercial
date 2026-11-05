import type { PaymentMethod } from '@/types/sale.types'

// Medios de pago (regla de negocio confirmada), en el orden en que se muestran.
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  DIGITAL_WALLET: 'Billetera virtual',
}
