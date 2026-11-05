import type { KeyboardEvent } from 'react'

import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'

export type PickerResult = {
  id: number
  label: string
  hint?: string // dato chico a la derecha (precio, stock...)
  disabled?: boolean // se ve en la lista pero no se puede elegir (por ejemplo, un producto sin stock)
}

type Props = {
  label: string // nombre del campo para lectores de pantalla
  placeholder?: string
  value: string
  onChange: (text: string) => void
  results: PickerResult[] // lo que coincide con lo escrito
  onPick: (id: number) => void
  emptyText: string // qué se dice cuando nada coincide
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  className?: string
}

// Buscador con lupa que muestra las coincidencias en una lista debajo, apenas se escribe: se toca una y queda elegida.
// Sin texto no se muestra nada. Escape borra la búsqueda. Al elegir, la búsqueda se limpia para el próximo.
function SearchPicker({ label, placeholder, value, onChange, results, onPick, emptyText, onKeyDown, className }: Props) {
  const open = value.trim() !== ''

  return (
    <div className={cn('relative', className)}>
      <SearchInput
        label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('')
          onKeyDown?.(e)
        }}
      />
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg">
          {results.length === 0 ? (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            <ul aria-label={`Resultados de ${label.toLowerCase()}`}>
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    disabled={result.disabled}
                    onClick={() => {
                      onPick(result.id)
                      onChange('')
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{result.label}</span>
                    {result.hint && <span className="shrink-0 text-xs text-muted-foreground">{result.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export { SearchPicker }
