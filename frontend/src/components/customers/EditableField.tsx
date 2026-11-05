import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Estos campos se ven como texto del papel (línea punteada) y al tocarlos se pueden escribir.
// Lo cambiado y todavía sin guardar se resalta en pantalla; en papel no se nota (print:bg-transparent).
const base =
  'bg-transparent border-b border-dotted border-black px-0.5 outline-none placeholder:text-gray-400 hover:bg-amber-50 focus:border-solid focus:bg-amber-50 print:placeholder:text-transparent print:hover:bg-transparent disabled:cursor-default disabled:hover:bg-transparent'
const highlight = 'bg-amber-100 print:bg-transparent'

type TextProps = Omit<ComponentProps<'input'>, 'onChange' | 'value'> & {
  label: string // nombre del campo para lectores de pantalla y para las pruebas
  value: string
  onValue: (value: string) => void
  changed?: boolean
}

export function EditableText({ label, value, onValue, changed = false, className, ...rest }: TextProps) {
  return (
    <input
      aria-label={label}
      className={cn(base, changed && highlight, className)}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      {...rest}
    />
  )
}

type AreaProps = Omit<ComponentProps<'textarea'>, 'onChange' | 'value'> & {
  label: string
  value: string
  onValue: (value: string) => void
  changed?: boolean
}

export function EditableArea({ label, value, onValue, changed = false, className, ...rest }: AreaProps) {
  return (
    <textarea
      aria-label={label}
      className={cn(base, 'resize-none', changed && highlight, className)}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      {...rest}
    />
  )
}

type SelectProps = {
  label: string
  value: string
  onValue: (value: string) => void
  options: { value: string; text: string }[]
  placeholder: string
  changed?: boolean
  className?: string
}

export function EditableSelect({ label, value, onValue, options, placeholder, changed = false, className }: SelectProps) {
  return (
    <select
      aria-label={label}
      className={cn(base, 'cursor-pointer appearance-none', !value && 'text-gray-400 print:text-transparent', changed && highlight, className)}
      value={value}
      onChange={(e) => onValue(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.text}
        </option>
      ))}
    </select>
  )
}
