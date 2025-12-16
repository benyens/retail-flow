import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '@/state/AppContext';
import { cn } from '@/lib/utils';
import {
  ShoppingCart,
  Receipt,
  RotateCcw,
  ArrowLeftRight,
  Clock,
  Package,
  Tags,
  Boxes,
  Truck,
  Users,
  BarChart3,
  Shield,
  Settings,
  LogOut,
  Store,
  ChevronDown,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const posLinks = [
  { to: '/pos', icon: ShoppingCart, label: 'Venta' },
  { to: '/pos/ventas', icon: Receipt, label: 'Ventas del Día' },
  { to: '/pos/devoluciones', icon: RotateCcw, label: 'Devoluciones' },
  { to: '/pos/movimientos', icon: ArrowLeftRight, label: 'Movimientos' },
  { to: '/pos/cerrar', icon: Clock, label: 'Cierre Caja' },
];

const adminLinks = [
  { to: '/admin/catalogo', icon: Package, label: 'Catálogo' },
  { to: '/admin/precios', icon: DollarSign, label: 'Precios' },
  { to: '/admin/mayorista', icon: Tags, label: 'Mayorista' },
  { to: '/admin/ingresar-factura', icon: Receipt, label: 'Ingresar Factura' },
  { to: '/admin/stock', icon: Boxes, label: 'Stock' },
  { to: '/admin/purchases', icon: Truck, label: 'Compras' },
  { to: '/admin/employees', icon: Users, label: 'Empleados' },
  { to: '/admin/reports', icon: BarChart3, label: 'Reportes' },
  { to: '/admin/audit', icon: Shield, label: 'Auditoría' },
  { to: '/admin/users', icon: Settings, label: 'Usuarios' },
];

export default function Sidebar() {
  const location = useLocation();
  const { auth, logout, selectedBranch, branches, setSelectedBranch, currentSession } = useApp();

  const isAdmin = auth.user?.role === 'ADMIN' || auth.user?.role === 'MANAGER';

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold">Sistema POS</h1>
            <p className="text-xs text-sidebar-foreground/60">{auth.user?.name}</p>
          </div>
        </div>
        
        {/* Branch Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent">
              <span className="truncate">{selectedBranch?.name || 'Seleccionar sucursal'}</span>
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {branches.map(branch => (
              <DropdownMenuItem key={branch.id} onClick={() => setSelectedBranch(branch)}>
                {branch.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {currentSession && (
          <div className="mt-2 px-3 py-2 bg-success/10 rounded-lg">
            <p className="text-xs text-success font-medium">Caja Abierta</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin">
        {/* POS Section */}
        <div>
          <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
            POS
          </p>
          <div className="space-y-1">
            {posLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/pos'} 
                className={({ isActive }) => cn(
                  'sidebar-item',
                  isActive && 'sidebar-item-active'
                )}
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div>
            <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Administración
            </p>
            <div className="space-y-1">
              {adminLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => cn(
                    'sidebar-item',
                    isActive && 'sidebar-item-active'
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  );
}
