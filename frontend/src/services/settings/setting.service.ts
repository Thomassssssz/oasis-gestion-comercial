import { apiRequest } from '@/services/api/client'
import type { Settings } from '@/types/setting.types'

export const getSettings = () => apiRequest<Settings>('/settings')

export const updateSettings = (data: { lateFeePercent: string }) =>
  apiRequest<Settings>('/settings', { method: 'PUT', body: data })
