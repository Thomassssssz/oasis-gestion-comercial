import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  title: string
  chart: ReactNode
  table: ReactNode // la misma información como tabla: para leer los números exactos y para quien no puede distinguir colores
}

// Tarjeta de un gráfico con un botón para ver los mismos datos como tabla.
export default function ChartCard({ title, chart, table }: Props) {
  const [asTable, setAsTable] = useState(false)

  return (
    <section className="rounded-md border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button size="sm" variant="outline" aria-pressed={asTable} onClick={() => setAsTable((value) => !value)}>
          {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </Button>
      </div>
      {asTable ? table : chart}
    </section>
  )
}
