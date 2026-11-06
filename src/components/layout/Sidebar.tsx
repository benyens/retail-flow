import { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
  KeyRound,
  LayoutDashboard,
} from 'lucide-react';
import ChangePasswordDialog from './ChangePasswordDialog';
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
  { to: '/inicio', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/admin/catalogo', icon: Package, label: 'Catálogo' },
  { to: '/admin/precios', icon: DollarSign, label: 'Precios' },
  { to: '/admin/mayorista', icon: Tags, label: 'Mayorista' },
  { to: '/admin/facturas', icon: Receipt, label: 'Facturas' },
  { to: '/admin/stock', icon: Boxes, label: 'Stock' },
  { to: '/admin/employees', icon: Users, label: 'Empleados' },
  { to: '/admin/reports', icon: BarChart3, label: 'Reportes' },
  { to: '/admin/audit', icon: Shield, label: 'Auditoría' },
  { to: '/admin/users', icon: Settings, label: 'Usuarios' },
];

/**
 * Navegación principal. En escritorio va fija a la izquierda; en celular se
 * muestra dentro de un panel deslizable (ver MainLayout) y `onNavigate` lo cierra
 * al elegir una opción.
 */
export default function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { auth, logout, selectedBranch, branches, setSelectedBranch, currentSession, selectedCashRegister, setSelectedCashRegister } = useApp();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const isAdmin = auth.user?.role === 'ADMIN' || auth.user?.role === 'MANAGER';

  return (
    <aside className={cn('w-64 bg-sidebar text-sidebar-foreground flex flex-col h-dvh', className)}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 shrink-0 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5 text-sidebar-primary-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Sistema POS</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{auth.user?.name}</p>
          </div>
        </div>
        
        {/* Branch Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent">
              <span className="truncate">{selectedBranch?.name || 'Seleccionar sucursal'}</span>
              <ChevronDown className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {branches.map(branch => (
              <DropdownMenuItem key={branch.id} onClick={() => { setSelectedBranch(branch); onNavigate?.(); }}>
                {branch.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedCashRegister && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-sidebar-accent/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs truncate">{selectedCashRegister.name}</p>
              <p className={cn('text-xs font-medium', currentSession ? 'text-success' : 'text-sidebar-foreground/60')}>
                {!currentSession ? 'Cerrada' : currentSession.userId === auth.user?.id ? 'Abierta' : 'Abierta por otra persona'}
              </p>
            </div>
            {/* Admin y encargado pueden soltar la caja y volver a la vista general. */}
            {auth.user?.role !== 'CASHIER' && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => { setSelectedCashRegister(null); onNavigate?.(); }}>
                Soltar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Principal" className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-6 scrollbar-thin">
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
                onClick={onNavigate}
                className={({ isActive }) => cn(
                  'sidebar-item',
                  isActive && 'sidebar-item-active'
                )}
              >
                <link.icon className="w-5 h-5" aria-hidden="true" />
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
              {adminLinks.filter(link => auth.user?.role === "ADMIN" || !["/admin/users", "/admin/audit"].includes(link.to)).map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onNavigate}
                  className={({ isActive }) => cn(
                    'sidebar-item',
                    isActive && 'sidebar-item-active'
                  )}
                >
                  <link.icon className="w-5 h-5" aria-hidden="true" />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setPasswordOpen(true)}
        >
          <KeyRound className="w-5 h-5 mr-3" aria-hidden="true" />
          Cambiar contraseña
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="w-5 h-5 mr-3" aria-hidden="true" />
          Cerrar sesión
        </Button>
      </div>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </aside>
  );
}
