import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, selectClass, exportCsv } from '@/components/ui/data-tools';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { AuditLog } from '@/types';
const actions = ['CREATE_PURCHASE', 'UPDATE_PURCHASE', 'SET_PRICE', 'ADJUST_STOCK', 'CREATE_SALE', 'VOID_SALE_INTERNAL', 'CREATE_CREDIT_NOTE', 'CHANGE_USER_ACCESS', 'CHANGE_USER_ROLE', 'OPEN_CASH', 'CLOSE_CASH', 'CASH_MOVEMENT'];
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
  return <div className="p-6 lg:p-8 space-y-6"><header><h1 className="text-2xl font-bold">Auditoría</h1><p className="text-muted-foreground">Quién cambió qué y cuándo · Acceso exclusivo de administración</p></header>
    <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-3"><Filter label="Acción"><select className={selectClass} value={action} onChange={change(setAction)}><option value="">Todas</option>{actions.map(a => <option key={a}>{a}</option>)}</select></Filter><Filter label="Usuario"><select className={selectClass} value={userId} onChange={change(setUserId)}><option value="">Todos</option>{users.data?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Filter><Filter label="Entidad"><select className={selectClass} value={entityType} onChange={change(setEntityType)}><option value="">Todas</option>{['PurchaseInvoice', 'VariantPrice', 'SalesDocument', 'InventoryMovement', 'CashSession', 'CashMovement', 'User'].map(v => <option key={v}>{v}</option>)}</select></Filter>
      <Filter label="ID de entidad"><Input data-search-focus value={entityId} onChange={change(setEntityId)} placeholder="Identificador exacto · F1" /></Filter><Filter label="Desde (hora de este equipo)"><Input type="datetime-local" value={from} onChange={change(setFrom)} /></Filter><Filter label="Hasta (hora de este equipo)"><Input type="datetime-local" value={to} onChange={change(setTo)} /></Filter><Button variant="outline" onClick={() => { setEntityType(''); setEntityId(''); setAction(''); setUserId(''); setFrom(''); setTo(''); setOffset(0); }}>Limpiar filtros</Button>
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">Cobertura: compras, precios individuales, ajustes de stock, ventas, devoluciones, caja y cambios de acceso de usuarios. Los registros históricos anteriores a esta ampliación conservan su cobertura original.</p>
    {!valid && <p role="alert" className="text-destructive">El rango de fechas es inválido.</p>}
    {logs.isError && <p role="alert">No se pudo cargar la auditoría. <Button onClick={() => logs.refetch()}>Reintentar</Button></p>}
    <Button variant="outline" disabled={!valid || !logs.data?.length} onClick={() => exportCsv('auditoria-pagina.csv', [['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID', 'Antes', 'Después'], ...(logs.data ?? []).map(l => [l.createdAt, actor(l.userId), l.action, l.entityType, l.entityId, JSON.stringify(l.beforeData), JSON.stringify(l.afterData)])])}>Exportar esta página</Button>
    <div className="border rounded-lg overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Fecha', 'Usuario', 'Acción', 'Entidad', 'Cambios'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{valid && logs.data?.map(l => <tr key={l.id} className="border-t"><td className="p-3">{new Date(l.createdAt).toLocaleString('es-CL')}</td><td className="p-3">{actor(l.userId)}</td><td className="p-3">{l.action}</td><td className="p-3">{l.entityType}<div className="text-xs text-muted-foreground break-all">{l.entityId}</div></td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setDetail(l)}>Ver cambios</Button></td></tr>)}{logs.isFetching && <tr><td colSpan={5} className="p-6">Cargando…</td></tr>}{valid && logs.data?.length === 0 && <tr><td colSpan={5} className="p-6">Sin eventos para estos filtros.</td></tr>}</tbody></table></div>
    <div className="flex justify-between items-center"><span>Página {offset / 100 + 1} · Hasta 100 eventos por página</span><div className="flex gap-2"><Button variant="outline" disabled={!offset || logs.isFetching} onClick={() => setOffset(offset - 100)}>Anterior</Button><Button variant="outline" disabled={!valid || logs.data?.length !== 100 || logs.isFetching} onClick={() => setOffset(offset + 100)}>Siguiente</Button></div></div>
    <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}><DialogContent className="max-w-3xl max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>{detail?.action}</DialogTitle><DialogDescription>{detail && actor(detail.userId)} · {detail?.entityType}</DialogDescription></DialogHeader><div className="grid md:grid-cols-2 gap-4">{[['Antes', detail?.beforeData], ['Después', detail?.afterData]].map(([title, value]) => <section key={String(title)}><h2 className="font-semibold mb-2">{String(title)}</h2><pre className="bg-muted p-4 rounded text-xs whitespace-pre-wrap break-all">{value ? JSON.stringify(value, null, 2) : 'Sin datos registrados'}</pre></section>)}</div></DialogContent></Dialog>
  </div>;
}
