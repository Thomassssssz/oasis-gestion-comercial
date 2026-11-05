// Datos del emisor que van en el encabezado del remito. Están copiados tal cual del remito en papel del comercio
// (el talonario "X"); son información relevada, no inventada. Se cambian acá, en un solo lugar.
export const business = {
  name: 'Ediciones Oasis',
  owner: 'DIEGO FRANCISCO SCAGLIA',
  addressLines: ['Bº LA PLATA - MZ. 50 - LOTE A', '3601 - HERRADURA', 'FORMOSA'],
  taxCondition: 'RESPONSABLE MONOTRIBUTO',
  cuit: '20-30255539-8',
  grossIncome: '01-20-30255539-8',
  activityStart: '03/2011',
} as const
