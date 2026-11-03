import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export default function KeyboardShortcuts() {
  const { auth } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const manager = auth.user?.role !== 'CASHIER';
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]')) return;
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setOpen(true); return; }
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const routes: Record<string, string> = { p: '/pos', ...(manager ? { f: '/admin/facturas', n: '/admin/ingresar-factura', r: '/admin/precios' } : {}) };
        const path = routes[e.key.toLowerCase()];
        if (path) {
          e.preventDefault();
          if (path !== pathname && window.dispatchEvent(new Event('app:before-navigate', { cancelable: true }))) navigate(path);
        }
      }
      if (e.key === 'F1' && pathname !== '/pos') {
        const input = document.querySelector<HTMLInputElement>('[data-search-focus]');
        if (input) { e.preventDefault(); input.focus(); input.select(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [manager, pathname, navigate]);
  return <><Button variant="ghost" className="text-xs" onClick={() => setOpen(true)}>Atajos de teclado · Ctrl+/</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Atajos de teclado</DialogTitle><DialogDescription>Tab y Shift+Tab recorren los controles; Enter activa botones y Escape cierra diálogos.</DialogDescription></DialogHeader>
      <dl className="grid grid-cols-2 gap-3 text-sm"><dt>Alt+P</dt><dd>Punto de venta</dd>{manager && <><dt>Alt+F</dt><dd>Facturas de compra</dd><dt>Alt+N</dt><dd>Ingresar factura</dd><dt>Alt+R</dt><dd>Precios</dd></>}<dt>F1</dt><dd>Buscar productos o documentos</dd><dt>Factura: F4</dt><dd>Guardar factura</dd><dt>Factura: F6 / F7</dt><dd>Nuevo proveedor / producto</dd><dt>Precios: Enter</dt><dd>Guardar precio de la fila</dd><dt>POS: F2 / F3 / F4</dt><dd>Tipo de documento / cliente / pagar</dd><dt>Ctrl+/</dt><dd>Esta ayuda</dd></dl>
    </DialogContent></Dialog></>;
}
