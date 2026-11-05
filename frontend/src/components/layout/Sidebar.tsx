import { BarChart3, Boxes, ScrollText, Package, PanelLeftClose, PanelLeftOpen, Settings, ShoppingCart, Tags, Users, Wallet, X, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Secciones del sistema, en el orden en que se muestran en la barra.
const sections: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/categorias', label: 'Categorías', icon: Tags },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/cuentas', label: 'Cuentas corrientes', icon: Wallet },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/auditoria', label: 'Auditoría', icon: ScrollText },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
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
        'fixed inset-y-0 left-0 z-40 flex w-56 flex-col gap-2 border-r border-border bg-white p-3 transition-transform',
        'md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 md:transition-[width]',
        mobileOpen ? 'translate-x-0' : 'max-md:invisible max-md:-translate-x-full',
        collapsed && 'md:w-16',
      )}
    >
      <div className={cn('flex items-center justify-between', collapsed && 'md:justify-center')}>
        <span className={cn('px-2 text-sm font-semibold text-muted-foreground', collapsed && 'md:hidden')}>Menú</span>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!collapsed}
          aria-controls="sidebar"
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Cerrar menú" onClick={onClose}>
          <X />
        </Button>
      </div>

      <nav aria-label="Secciones" className="flex flex-col gap-1">
        {sections.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium',
                collapsed && 'md:justify-center md:px-0',
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )
            }
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {/* Con la barra angosta el nombre se oculta a la vista pero lo siguen leyendo los lectores de pantalla. */}
            <span className={cn(collapsed && 'md:sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
