import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, selectClass, exportCsv } from '@/components/ui/data-tools';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { AuditLog } from '@/types';
import { formatDateTime } from '@/utils/format';
const ACTIONS: Record<string, string> = {
  CREATE_SALE: 'Venta', VOID_SALE_INTERNAL: 'Anulación de venta', CREATE_CREDIT_NOTE: 'Nota de crédito',
  OPEN_CASH: 'Apertura de caja', CLOSE_CASH: 'Cierre de caja', CASH_MOVEMENT: 'Movimiento de caja',
  ADJUST_STOCK: 'Ajuste de stock', SET_PRICE: 'Cambio de precio',
  CREATE_PURCHASE: 'Factura de compra', UPDATE_PURCHASE: 'Edición de factura de compra',
  CREATE_PRODUCT: 'Producto creado', CREATE_QUICK_PRODUCT: 'Producto rápido', UPDATE_PRODUCT: 'Producto editado', DELETE_PRODUCT: 'Producto eliminado',
  CREATE_VARIANT_GROUP: 'Grupo creado', UPDATE_VARIANT_GROUP: 'Grupo editado', DELETE_VARIANT_GROUP: 'Grupo eliminado',
  CREATE_VARIANT: 'Variante creada', UPDATE_VARIANT: 'Variante editada', DELETE_VARIANT: 'Variante eliminada',
  CREATE_WHOLESALE_TIER: 'Tramo mayorista creado', UPDATE_WHOLESALE_TIER: 'Tramo mayorista editado', DELETE_WHOLESALE_TIER: 'Tramo mayorista eliminado',
  CREATE_CATEGORY: 'Categoría creada', UPDATE_CATEGORY: 'Categoría editada', DELETE_CATEGORY: 'Categoría eliminada',
  CREATE_SUPPLIER: 'Proveedor creado', UPDATE_SUPPLIER: 'Proveedor editado',
  CREATE_EMPLOYEE: 'Empleado creado', UPDATE_EMPLOYEE: 'Empleado editado',
  CREATE_CUSTOMER: 'Cliente creado', UPDATE_CUSTOMER: 'Cliente editado',
  CHANGE_USER_ACCESS: 'Cambio de acceso de usuario', CHANGE_USER_ROLE: 'Cambio de rol',
  CHANGE_OWN_PASSWORD: 'Cambio de contraseña propia', RESET_USER_PASSWORD: 'Contraseña asignada por admin',
};
const ENTITIES: Record<string, string> = {
  SalesDocument: 'Venta', CashSession: 'Sesión de caja', CashMovement: 'Movimiento de caja', InventoryMovement: 'Movimiento de stock',
  VariantPrice: 'Precio', PurchaseInvoice: 'Factura de compra', Product: 'Producto', VariantGroup: 'Grupo de variantes',
  Variant: 'Variante', WholesaleTier: 'Tramo mayorista', ProductCategory: 'Categoría', Supplier: 'Proveedor',
  Employee: 'Empleado', Customer: 'Cliente', User: 'Usuario',
};
export default function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const filters = { action: action || undefined, userId: userId || undefined, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined, offset };
  const valid = !from || !to || from <= to;
  const logs = useQuery({ queryKey: ['audit', entityType, entityId, filters], queryFn: () => apiClient.getAuditLogs(entityType || undefined, entityId.trim() || undefined, filters), enabled: valid });
  const users = useQuery({ queryKey: ['audit-users'], queryFn: () => apiClient.getUsers() });
  const change = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setter(e.target.value); setOffset(0); };
  const actor = (id: string) => users.data?.find(u => u.id === id)?.name ?? id;
  return <div className="p-4 md:p-6 lg:p-8 space-y-6"><header><h1 className="text-2xl font-bold">Auditoría</h1><p className="text-muted-foreground">Quién cambió qué y cuándo · Acceso exclusivo de administración</p></header>
    <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-3"><Filter label="Acción"><select className={selectClass} value={action} onChange={change(setAction)}><option value="">Todas</option>{Object.entries(ACTIONS).map(([a, label]) => <option key={a} value={a}>{label}</option>)}</select></Filter><Filter label="Usuario"><select className={selectClass} value={userId} onChange={change(setUserId)}><option value="">Todos</option>{users.data?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Filter><Filter label="Entidad"><select className={selectClass} value={entityType} onChange={change(setEntityType)}><option value="">Todas</option>{Object.entries(ENTITIES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></Filter>
      <Filter label="ID de entidad"><Input data-search-focus value={entityId} onChange={change(setEntityId)} placeholder="Identificador exacto · F1" /></Filter><Filter label="Desde (hora de este equipo)"><Input type="datetime-local" value={from} onChange={change(setFrom)} /></Filter><Filter label="Hasta (hora de este equipo)"><Input type="datetime-local" value={to} onChange={change(setTo)} /></Filter><Button variant="outline" onClick={() => { setEntityType(''); setEntityId(''); setAction(''); setUserId(''); setFrom(''); setTo(''); setOffset(0); }}>Limpiar filtros</Button>
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">Cobertura: ventas, devoluciones, caja, stock, compras, precios, catálogo (productos, variantes, grupos, mayoristas y categorías), proveedores, empleados, clientes y usuarios. Los registros anteriores a cada ampliación conservan su cobertura original.</p>
    {!valid && <p role="alert" className="text-destructive">El rango de fechas es inválido.</p>}
    {logs.isError && <p role="alert">No se pudo cargar la auditoría. <Button onClick={() => logs.refetch()}>Reintentar</Button></p>}
    <Button variant="outline" disabled={!valid || !logs.data?.length} onClick={() => exportCsv('auditoria-pagina.csv', [['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID', 'Antes', 'Después'], ...(logs.data ?? []).map(l => [l.createdAt, actor(l.userId), l.action, l.entityType, l.entityId, JSON.stringify(l.beforeData), JSON.stringify(l.afterData)])])}>Exportar esta página</Button>
    <div className="md:border md:rounded-lg md:overflow-x-auto"><table className="table-cards w-full text-sm"><thead className="bg-muted"><tr>{['Fecha', 'Usuario', 'Acción', 'Entidad', 'Cambios'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{valid && logs.data?.map(l => <tr key={l.id} className="border-t"><td data-label="Fecha" className="p-3">{formatDateTime(l.createdAt)}</td><td data-label="Usuario" className="p-3">{actor(l.userId)}</td><td data-label="Acción" className="p-3">{ACTIONS[l.action] ?? l.action}</td><td data-label="Entidad" className="p-3">{ENTITIES[l.entityType] ?? l.entityType}<div className="text-xs text-muted-foreground break-all">{l.entityId}</div></td><td data-label="" className="p-3"><Button size="sm" variant="outline" onClick={() => setDetail(l)}>Ver cambios</Button></td></tr>)}{logs.isFetching && <tr><td colSpan={5} className="p-6">Cargando…</td></tr>}{valid && logs.data?.length === 0 && <tr><td colSpan={5} className="p-6">Sin eventos para estos filtros.</td></tr>}</tbody></table></div>
    <div className="flex justify-between items-center"><span>Página {offset / 100 + 1} · Hasta 100 eventos por página</span><div className="flex gap-2"><Button variant="outline" disabled={!offset || logs.isFetching} onClick={() => setOffset(offset - 100)}>Anterior</Button><Button variant="outline" disabled={!valid || logs.data?.length !== 100 || logs.isFetching} onClick={() => setOffset(offset + 100)}>Siguiente</Button></div></div>
    <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}><DialogContent className="max-w-3xl max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>{detail ? ACTIONS[detail.action] ?? detail.action : ''}</DialogTitle><DialogDescription>{detail && actor(detail.userId)} · {detail ? ENTITIES[detail.entityType] ?? detail.entityType : ''}</DialogDescription></DialogHeader><div className="grid md:grid-cols-2 gap-4">{[['Antes', detail?.beforeData], ['Después', detail?.afterData]].map(([title, value]) => <section key={String(title)}><h2 className="font-semibold mb-2">{String(title)}</h2><pre className="bg-muted p-4 rounded text-xs whitespace-pre-wrap break-all">{value ? JSON.stringify(value, null, 2) : 'Sin datos registrados'}</pre></section>)}</div></DialogContent></Dialog>
  </div>;
}
