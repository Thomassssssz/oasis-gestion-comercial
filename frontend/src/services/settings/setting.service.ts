import { apiRequest } from '@/services/api/client'
import type { BusinessSettings, BusinessSettingsInput, Settings } from '@/types/setting.types'

export const getSettings = () => apiRequest<Settings>('/settings')

export const updateSettings = (data: { lateFeePercent: string }) =>
  apiRequest<Settings>('/settings', { method: 'PUT', body: data })

// Datos del comercio para el encabezado del remito. Guardar reemplaza todos los datos juntos (D23).
export const getBusinessSettings = () => apiRequest<BusinessSettings>('/settings/business')

export const updateBusinessSettings = (data: BusinessSettingsInput) =>
  apiRequest<BusinessSettings>('/settings/business', { method: 'PUT', body: data })
