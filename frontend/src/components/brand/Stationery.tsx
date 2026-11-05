import { cn } from '@/lib/utils'

// Dibujos de papelería para decorar (lápices, cuaderno, regla, clip). Son solo adorno: los lectores de pantalla los saltean.
type Art = { className?: string }
const base = { 'aria-hidden': true, focusable: false } as const

export function Pencil({ className, color = '#f4b82f' }: Art & { color?: string }) {
  return (
    <svg viewBox="0 0 24 120" className={className} {...base}>
      <path d="M12 0 L22 22 H2 Z" fill="#f1d9b5" />
      <path d="M12 0 L16.4 9.5 H7.6 Z" fill="#33261f" />
      <rect x="2" y="22" width="20" height="78" fill={color} />
      <rect x="9" y="22" width="2.5" height="78" fill="#ffffff" opacity=".28" />
      <rect x="2" y="100" width="20" height="6" fill="#b9c9e0" />
      <rect x="2" y="106" width="20" height="14" rx="3" fill="#e2592b" />
    </svg>
  )
}

export function Notebook({ className, color = '#e2592b' }: Art & { color?: string }) {
  return (
    <svg viewBox="0 0 100 130" className={className} {...base}>
      <rect x="6" y="4" width="88" height="122" rx="6" fill={color} />
      <rect x="6" y="4" width="88" height="122" rx="6" fill="none" stroke="#000" strokeOpacity=".15" />
      <rect x="22" y="22" width="56" height="34" rx="3" fill="#ffffff" opacity=".92" />
      <path d="M30 34 H70 M30 44 H62" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {[18, 38, 58, 78, 98].map((y) => (
        <g key={y}>
          <circle cx="12" cy={y} r="4.2" fill="#ffffff" opacity=".9" />
          <rect x="2" y={y - 1.5} width="14" height="3" rx="1.5" fill="#cfd8e6" />
        </g>
      ))}
    </svg>
  )
}

export function Ruler({ className }: Art) {
  return (
    <svg viewBox="0 0 180 34" className={className} {...base}>
      <rect x="1" y="1" width="178" height="32" rx="4" fill="#f4b82f" />
      {Array.from({ length: 36 }, (_, i) => (
        <line key={i} x1={8 + i * 4.7} x2={8 + i * 4.7} y1="1" y2={i % 5 === 0 ? 16 : 9} stroke="#4a2d22" strokeWidth="1.2" />
      ))}
    </svg>
  )
}

export function Paperclip({ className }: Art) {
  return (
    <svg viewBox="0 0 30 70" className={className} {...base}>
      <path d="M21 22 V48 a9 9 0 0 1 -18 0 V14 a6 6 0 0 1 12 0 V46" fill="none" stroke="#2a67b0" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Una tira de lápices de colores parados, con la punta hacia arriba (adorno del menú lateral).
export function PencilRow({ className }: Art) {
  const colors = ['#f4b82f', '#e2592b', '#3f9b5a', '#5aa6e0', '#f4b82f', '#e2592b']
  return (
    <div className={cn('flex items-end justify-center gap-1', className)} aria-hidden="true">
      {colors.map((c, i) => (
        <Pencil key={i} color={c} className={cn('w-3.5', i % 2 ? 'h-14' : 'h-16')} />
      ))}
    </div>
  )
}
