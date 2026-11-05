import { cn } from '@/lib/utils'

// Emblema de la librería: un libro abierto del que crece una palmera (el oasis), con el sol detrás.
// Está dibujado con formas simples para que se vea bien desde 28 px (menú) hasta 120 px (login).
export function OasisEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={cn('shrink-0', className)}>
      <circle cx="32" cy="32" r="30" fill="#2a67b0" />
      <circle cx="32" cy="32" r="29" fill="none" stroke="#f4b82f" strokeWidth="2.4" />
      <circle cx="43" cy="21" r="8.5" fill="#f4b82f" />
      {/* tronco y hojas de la palmera */}
      <path d="M31 46 C29.5 38 31 30 34 22" fill="none" stroke="#4a2d22" strokeWidth="3.4" strokeLinecap="round" />
      <g fill="none" stroke="#3f9b5a" strokeWidth="3.2" strokeLinecap="round">
        <path d="M34 22 C28 15.5 20 16 14.5 21.5" />
        <path d="M34 22 C31 12.5 24 9.5 18 11.5" />
        <path d="M34 22 C35.5 12.5 43 9 49.5 12" />
        <path d="M34 22 C41 17.5 49 20 53 26.5" />
        <path d="M34 22 C27 22 22 27 21 33" />
      </g>
      {/* libro abierto */}
      <path d="M10 45.5 C18 41.5 27 41.5 32 45.5 C37 41.5 46 41.5 54 45.5 L54 53 C46 49 37 49 32 53 C27 49 18 49 10 53 Z" fill="#ffffff" />
      <path d="M32 45.5 V53" stroke="#b9c9e0" strokeWidth="1.2" />
      <path d="M14 48.6 C19 47 24 47 28 48.6 M36 48.6 C40 47 45 47 50 48.6" fill="none" stroke="#c9d6e8" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

type Props = {
  size?: 'sm' | 'lg'
  tone?: 'light' | 'dark' // light = sobre fondo oscuro (letras blancas); dark = sobre fondo claro (letras marrones)
  showTagline?: boolean
  className?: string
}

// Logo de Ediciones Oasis: emblema y nombre en letra cursiva, como el cartel del local.
export default function OasisLogo({ size = 'sm', tone = 'light', showTagline = false, className }: Props) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <OasisEmblem className={size === 'lg' ? 'size-24' : 'size-9'} />
      <div className="leading-none">
        <p className={cn('font-script', size === 'lg' ? 'text-6xl' : 'text-2xl', tone === 'light' ? 'text-white' : 'text-[#4a2d22]')}>Ediciones Oasis</p>
        {showTagline && <p className={cn('mt-1.5 text-sm font-semibold tracking-wide', tone === 'light' ? 'text-[#f4b82f]' : 'text-[#2a67b0]')}>Librería · Formosa</p>}
      </div>
    </div>
  )
}
