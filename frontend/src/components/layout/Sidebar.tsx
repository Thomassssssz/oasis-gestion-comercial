import { Bookmark, Library, NotebookText, PanelLeftClose, PanelLeftOpen, PencilRuler, Receipt, Settings, TrendingUp, X, type LucideIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { OasisEmblem } from '@/components/brand/OasisLogo'
import { PencilRow } from '@/components/brand/Stationery'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Secciones del sistema, en el orden en que se muestran en la barra. Cada una lleva su ícono de papelería sobre un cuadradito de color.
const sections: { to: string; label: string; icon: LucideIcon; chip: string }[] = [
  { to: '/productos', label: 'Productos', icon: NotebookText, chip: 'bg-[#e2592b] text-white' },
  { to: '/categorias', label: 'Categorías', icon: Bookmark, chip: 'bg-sun text-wood' },
  { to: '/inventario', label: 'Inventario', icon: Library, chip: 'bg-[#5aa6e0] text-ink' },
  { to: '/ventas', label: 'Ventas', icon: Receipt, chip: 'bg-leaf text-white' },
  { to: '/clientes', label: 'Clientes', icon: PencilRuler, chip: 'bg-[#e2592b] text-white' },
  { to: '/reportes', label: 'Reportes', icon: TrendingUp, chip: 'bg-sun text-wood' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, chip: 'bg-white/90 text-ink' },
]

type Props = {
  collapsed: boolean // solo en pantallas grandes: true = barra angosta, solo con íconos
  mobileOpen: boolean // solo en pantallas chicas: true = la barra está abierta sobre la pantalla
  onToggleCollapsed: () => void
  onClose: () => void
}

// Barra lateral con las secciones. En pantallas grandes está siempre a la vista y se puede achicar a solo íconos;
// en pantallas chicas queda oculta y se abre con el botón de menú.
export default function Sidebar({ collapsed, mobileOpen, onToggleCollapsed, onClose }: Props) {
  return (
    <aside
      id="sidebar"
      data-state={mobileOpen ? 'open' : 'closed'}
      className={cn(
        'print:hidden fixed inset-y-0 left-0 z-40 flex w-60 flex-col gap-3 bg-ink p-3 text-white shadow-xl transition-transform',
        'md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 md:shadow-none md:transition-[width]',
        mobileOpen ? 'translate-x-0' : 'max-md:invisible max-md:-translate-x-full',
        collapsed && 'md:w-16',
      )}
    >
      {/* El emblema y el nombre llevan a la pantalla de inicio. Con la barra angosta queda solo el emblema. */}
      <Link
        to="/"
        onClick={onClose}
        aria-label="Ir al inicio"
        className={cn('flex items-center gap-2.5 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sun', collapsed && 'md:justify-center')}
      >
        <OasisEmblem className="size-10" />
        <span className={cn('font-script text-[1.65rem] leading-none text-white', collapsed && 'md:hidden')}>Ediciones Oasis</span>
      </Link>

      <div className={cn('flex items-center justify-between border-b border-white/15 pb-3', collapsed && 'md:justify-center')}>
        <span className={cn('px-2 text-sm font-semibold text-white/70', collapsed && 'md:hidden')}>Menú</span>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-white hover:bg-white/10 md:inline-flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!collapsed}
          aria-controls="sidebar"
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 md:hidden" aria-label="Cerrar menú" onClick={onClose}>
          <X />
        </Button>
      </div>

      <nav aria-label="Secciones" className="flex flex-col gap-1">
        {sections.map(({ to, label, icon: Icon, chip }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex h-11 items-center gap-3 rounded-lg px-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-sun',
                collapsed && 'md:justify-center md:px-0',
                isActive ? 'bg-white text-ink shadow-sm' : 'text-white/90 hover:bg-white/10',
              )
            }
          >
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', chip)}>
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            {/* Con la barra angosta el nombre se oculta a la vista pero lo siguen leyendo los lectores de pantalla. */}
            <span className={cn(collapsed && 'md:sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Adorno: lápices de colores al pie de la barra. Se ocultan con la barra angosta. */}
      <PencilRow className={cn('mt-auto opacity-95', collapsed && 'md:hidden')} />
    </aside>
  )
}
