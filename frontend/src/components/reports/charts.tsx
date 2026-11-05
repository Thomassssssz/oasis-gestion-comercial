import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { peso, pesoCompact, shortDay, fullDay } from '@/utils/format'

// Una sola serie por gráfico: un solo color (azul de la paleta de referencia), grilla y ejes discretos.
const BAR = '#2a78d6'
const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'
const TEXT = '#52514e'
const tick = { fill: TEXT, fontSize: 12 }
const tooltipBox = 'rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm'

// En los tests (y antes de medir la pantalla) el contenedor no tiene tamaño: se parte de uno inicial para que el gráfico se dibuje.
const initialDimension = { width: 600, height: 280 }

type DayPoint = { date: string; total: number; count: number }

// Ventas por día: columnas (una por día). Sin etiqueta en cada columna: el valor exacto sale al pasar el mouse o en la tabla.
export function SalesByDayChart({ data }: { data: DayPoint[] }) {
  return (
    <div role="img" aria-label="Gráfico de columnas: ventas por día" className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={initialDimension}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} minTickGap={16} />
          <YAxis tickFormatter={(value: number) => pesoCompact.format(value)} tick={tick} tickLine={false} axisLine={false} width={64} />
          <Tooltip
            cursor={{ fill: '#f0efec' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as DayPoint | undefined
              if (!active || !point) return null
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{fullDay(point.date)}</p>
                  <p>{peso.format(point.total)}</p>
                  <p className="text-muted-foreground">
                    {point.count} {point.count === 1 ? 'venta' : 'ventas'}
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="total" fill={BAR} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

type BarPoint = { name: string; value: number; label: string }

// Barras horizontales con el valor al final de cada barra (pocas categorías, nombres largos).
export function HorizontalBars({ data, ariaLabel }: { data: BarPoint[]; ariaLabel: string }) {
  const height = Math.max(120, data.length * 36 + 16)

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height }}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 80, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: AXIS }}
            tickFormatter={(name: string) => (name.length > 20 ? `${name.slice(0, 19)}…` : name)}
          />
          <Tooltip
            cursor={{ fill: '#f0efec' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as BarPoint | undefined
              if (!active || !point) return null
              return (
                <div className={tooltipBox}>
                  <p className="font-medium">{point.name}</p>
                  <p>{point.label}</p>
                </div>
              )
            }}
          />
          <Bar dataKey="value" fill={BAR} barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="label" position="right" fill={TEXT} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
