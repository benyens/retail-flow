import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Store } from 'lucide-react';
import KeyboardShortcuts from './KeyboardShortcuts';
import Sidebar from './Sidebar';
import { useApp } from '@/state/AppContext';
import BranchSelector from '@/modules/pos/components/BranchSelector';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

export default function MainLayout() {
  const { selectedBranch, selectedCashRegister, auth } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Cierra el menú del celular si la ruta cambia por otro medio (atajo, redirección).
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // El cajero elige sucursal y caja al entrar; admin y encargado solo la sucursal
  // (la caja se pide al ir a vender, ver RegisterGate).
  const needsRegister = auth.user?.role === 'CASHIER';
  if (!selectedBranch || (needsRegister && !selectedCashRegister)) {
    return <BranchSelector />;
  }

  return (
    <div className="flex h-dvh w-full bg-background">
      <Sidebar className="hidden md:flex shrink-0" />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] p-0 border-0 bg-sidebar [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SheetDescription className="sr-only">Navegación, sucursal y sesión</SheetDescription>
          <Sidebar className="w-full" onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior en celular: menú, sucursal y caja actuales. */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b bg-sidebar text-sidebar-foreground px-2 pt-[env(safe-area-inset-top)] min-h-14">
          <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </Button>
          <Store className="h-5 w-5 shrink-0 text-sidebar-primary" aria-hidden="true" />
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold truncate">{selectedBranch.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{selectedCashRegister?.name ?? 'Sin caja'}</p>
          </div>
        </header>
        <div className="hidden md:flex justify-end px-6 border-b"><KeyboardShortcuts /></div>
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
