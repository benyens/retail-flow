import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { useApp } from '@/state/AppContext';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Filter, Pager, selectClass, exportCsv } from '@/components/ui/data-tools';
import type { PurchaseInvoice } from '@/types';
import { toast } from 'sonner';
import { Plus, Receipt, Download } from 'lucide-react';

const statuses = { DRAFT: 'Registrada', SII_SENT: 'En proceso (simulado)', SII_ACCEPTED: 'Aceptada (simulado)', SII_REJECTED: 'Rechazada (simulado)' };
export default function PurchaseListPage() {
  const { selectedBranch } = useApp();
  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<PurchaseInvoice | null>(null);
  const [number, setNumber] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const cache = useQueryClient();
  const purchases = useQuery({ queryKey: ['purchases', selectedBranch?.id], queryFn: () => apiClient.getPurchases(selectedBranch!.id), enabled: !!selectedBranch });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => apiClient.getSuppliers() });
  const variants = useQuery({ queryKey: ['purchase-variants', selectedBranch?.id], queryFn: () => apiClient.getVariants(selectedBranch!.id), enabled: !!detail && !!selectedBranch });
  const lines = useQuery({ queryKey: ['purchase-lines', detail?.id], queryFn: () => apiClient.getPurchaseLines(detail!.id), enabled: !!detail });
  useEffect(() => { setDetail(null); setPage(0); }, [selectedBranch?.id]);
  const supplierMap = useMemo(() => new Map((suppliers.data ?? []).map(s => [s.id, s])), [suppliers.data]);
  const invalidRange = !!from && !!to && from > to;
  const filtered = useMemo(() => (purchases.data ?? []).filter(i => {
    const s = supplierMap.get(i.supplierId);
    return !invalidRange && (!supplier || i.supplierId === supplier) && (!status || i.status === status) &&
      (!from || i.invoiceDate.slice(0, 10) >= from) && (!to || i.invoiceDate.slice(0, 10) <= to) &&
      `${i.invoiceNumber} ${s?.name ?? ''} ${s?.rut ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => sort === 'amount' ? b.total - a.total : b.invoiceDate.localeCompare(a.invoiceDate)),
  [purchases.data, supplierMap, supplier, status, from, to, query, sort, invalidRange]);
  useEffect(() => setPage(0), [query, supplier, from, to, status, sort]);
  const save = useMutation({ mutationFn: () => apiClient.updatePurchaseInvoice(detail!.id, { invoiceNumber: number.trim(), invoiceDate: date, notes }),
    onSuccess: updated => { setDetail(updated); cache.invalidateQueries({ queryKey: ['purchases'] }); toast.success('Factura actualizada'); },
    onError: e => toast.error(e.message),
  });
  const open = (invoice: PurchaseInvoice) => { setDetail(invoice); setNumber(invoice.invoiceNumber); setDate(invoice.invoiceDate.slice(0, 10)); setNotes(invoice.notes ?? ''); };
  if (!selectedBranch) return <p className="p-8">Selecciona una sucursal.</p>;
  const selectedSupplier = detail ? supplierMap.get(detail.supplierId) : null;
  return <div className="p-6 lg:p-8 space-y-6">
    <header className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-bold flex gap-2 items-center"><Receipt />Facturas de compra</h1><p className="text-muted-foreground">{selectedBranch.name} · Busca, revisa y registra tus compras</p></div>
      <Button asChild><Link to="/admin/ingresar-factura"><Plus className="mr-2 h-4 w-4" />Ingresar factura <kbd className="ml-2 text-xs">Alt+N</kbd></Link></Button></header>
    <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-3">
      <Filter label="Buscar factura, proveedor o RUT"><Input data-search-focus value={query} onChange={e => setQuery(e.target.value)} placeholder="Número, nombre o RUT · F1" /></Filter>
      <Filter label="Proveedor"><select className={selectClass} value={supplier} onChange={e => setSupplier(e.target.value)}><option value="">Todos los proveedores</option>{suppliers.data?.map(s => <option key={s.id} value={s.id}>{s.name} · {s.rut}</option>)}</select></Filter>
      <Filter label="Estado"><select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos los estados</option>{Object.entries(statuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Filter>
      <Filter label="Fecha de factura desde"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Filter>
      <Filter label="Fecha de factura hasta"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Filter>
      <Filter label="Ordenar"><select className={selectClass} value={sort} onChange={e => setSort(e.target.value)}><option value="date">Más recientes</option><option value="amount">Mayor monto</option></select></Filter>
      <Button variant="outline" onClick={() => { setQuery(''); setSupplier(''); setFrom(''); setTo(''); setStatus(''); }}>Limpiar filtros</Button>
      {invalidRange && <p role="alert" className="text-destructive">La fecha inicial debe ser anterior o igual a la final.</p>}
    </CardContent></Card>
    {(purchases.isError || suppliers.isError) && <p role="alert" className="text-destructive">No se pudieron cargar los datos. <Button variant="outline" onClick={() => { purchases.refetch(); suppliers.refetch(); }}>Reintentar</Button></p>}
    <div className="flex flex-wrap justify-between gap-3 items-center"><p className="font-medium">Total filtrado: {formatCurrency(filtered.reduce((s, i) => s + i.total, 0))} · {new Set(filtered.map(i => i.supplierId)).size} proveedores</p>
      <Button variant="outline" disabled={!filtered.length} onClick={() => exportCsv('facturas.csv', [['Factura', 'Proveedor', 'RUT', 'Fecha', 'Neto', 'IVA', 'Total', 'Estado'], ...filtered.map(i => [i.invoiceNumber, supplierMap.get(i.supplierId)?.name, supplierMap.get(i.supplierId)?.rut, i.invoiceDate, i.subtotal, i.tax, i.total, statuses[i.status]])])}><Download className="mr-2 h-4 w-4" />Exportar resultados</Button></div>
    <div className="rounded-lg border overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Factura', 'Proveedor', 'Fecha', 'Total', 'Estado', 'Detalle'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>
      {purchases.isPending ? <tr><td colSpan={6} className="p-8 text-center">Cargando…</td></tr> : filtered.slice(page * 25, (page + 1) * 25).map(i => <tr key={i.id} className="border-t"><td className="p-3 font-medium">{i.invoiceNumber}</td><td className="p-3">{supplierMap.get(i.supplierId)?.name}<div className="text-xs text-muted-foreground">{supplierMap.get(i.supplierId)?.rut}</div></td><td className="p-3">{i.invoiceDate.slice(0, 10)}</td><td className="p-3 tabular-nums">{formatCurrency(i.total)}</td><td className="p-3">{statuses[i.status]}</td><td className="p-3"><Button variant="outline" size="sm" onClick={() => open(i)} aria-label={`Ver factura ${i.invoiceNumber}`}>Ver detalle</Button></td></tr>)}
      {!purchases.isPending && !purchases.isError && !filtered.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No hay facturas para estos filtros.</td></tr>}
    </tbody></table></div><Pager page={page} count={filtered.length} onChange={setPage} />
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Factura {detail?.invoiceNumber}</DialogTitle><DialogDescription>{selectedSupplier?.name} · {selectedSupplier?.rut}</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">{selectedSupplier?.email} {selectedSupplier?.phone} {selectedSupplier?.address}</p>
      {lines.isPending ? <p>Cargando detalle…</p> : lines.isError ? <p role="alert">No se pudo cargar el detalle.</p> : <table className="text-sm w-full"><thead><tr><th className="text-left">Producto</th><th>Cantidad</th><th>Costo neto</th><th>Subtotal</th></tr></thead><tbody>{lines.data?.map(l => { const v = variants.data?.find(v => v.id === l.variantId); return <tr key={l.id} className="border-t"><td className="py-3">{v ? `${v.product.name} · ${v.name}` : l.variantId}</td><td className="text-center">{l.quantity}</td><td className="text-center">{formatCurrency(l.unitCost)}</td><td className="text-center">{formatCurrency(l.subtotal)}</td></tr>; })}</tbody></table>}
      <p className="font-medium">Neto {formatCurrency(detail?.subtotal ?? 0)} + IVA {formatCurrency(detail?.tax ?? 0)} = {formatCurrency(detail?.total ?? 0)}</p>
      <form className="grid gap-3" onSubmit={e => { e.preventDefault(); if (!save.isPending) save.mutate(); }}><div className="grid grid-cols-2 gap-3"><Filter label="Número de factura"><Input required value={number} onChange={e => setNumber(e.target.value)} disabled={detail?.status !== 'DRAFT'} /></Filter><Filter label="Fecha de factura"><Input required type="date" value={date} onChange={e => setDate(e.target.value)} disabled={detail?.status !== 'DRAFT'} /></Filter></div><Filter label="Observaciones"><Input value={notes} onChange={e => setNotes(e.target.value)} disabled={detail?.status !== 'DRAFT'} /></Filter>
      <p className="text-xs text-muted-foreground">El stock se aplicó al registrar la factura. Editar estos datos no modifica cantidades ni costos.</p>{detail?.status === 'DRAFT' && <Button disabled={save.isPending || !number.trim() || !date}>Guardar datos de factura</Button>}</form>
    </DialogContent></Dialog>
  </div>;
}
