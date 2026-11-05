// Nombre legible de cada acción del registro de auditoría, en el orden en que se ofrecen como filtro.
export const auditActionLabels: Record<string, string> = {
  SALE_REGISTERED: 'Venta registrada',
  SALE_ANNULLED: 'Venta anulada',
  STOCK_MOVEMENT_REGISTERED: 'Movimiento de stock',
  ACCOUNT_PAYMENT_REGISTERED: 'Pago de cuenta corriente',
  SURCHARGES_APPLIED: 'Recargos aplicados',
  SETTING_CHANGED: 'Cambio de parámetros',
  CUSTOMER_CREATED: 'Cliente creado',
  CUSTOMER_UPDATED: 'Cliente modificado',
  PRODUCT_CREATED: 'Producto creado',
  PRODUCT_UPDATED: 'Producto modificado',
  CATEGORY_CREATED: 'Categoría creada',
  CATEGORY_UPDATED: 'Categoría modificada',
  CATEGORY_DELETED: 'Categoría borrada',
  PASSWORD_CHANGED: 'Cambio de contraseña',
}

// Si aparece una acción que esta pantalla todavía no conoce, se muestra su clave en lugar de esconderla.
export const auditActionLabel = (action: string) => auditActionLabels[action] ?? action
