import { Search } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = Omit<ComponentProps<'input'>, 'type'> & { label: string }

// Campo de búsqueda con lupa: se escribe un texto y la pantalla filtra mientras tanto.
// `label` es el nombre del campo para lectores de pantalla (la lupa es solo un dibujo).
function SearchInput({ label, className, ...props }: Props) {
  return (
    <div className={cn('relative', className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" aria-label={label} className="pl-8" autoComplete="off" {...props} />
    </div>
  )
}

export { SearchInput }
