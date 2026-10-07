import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';
import { useApp } from '@/state/AppContext';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, Pager, selectClass, exportCsv, localDay } from '@/components/ui/data-tools';
import type { DocumentType, DocumentStatus } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const types = { BOLETA: 'Boleta', FACTURA: 'Factura', CREDIT_NOTE: 'Nota de crédito' };
const statuses = { ISSUED: 'Emitido', VOID_INTERNAL: 'Anulado', PENDING_ISSUE: 'Pendiente', REJECTED: 'Rechazado' };
const methods = { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', CHECK: 'Cheque', OTHER: 'Otro' };
export default function ReportsPage() {
  const { selectedBranch } = useApp();
  const [from, setFrom] = useState(localDay());
  const [to, setTo] = useState(localDay());
  const [docType, setDocType] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const valid = !!from && !!to && from <= to && +new Date(to) - +new Date(from) <= 366 * 86400000;
  const filters = { from, to, docType: (docType || undefined) as DocumentType | undefined, status: (status || undefined) as DocumentStatus | undefined, query: query.trim() || undefined };
  const report = useQuery({ queryKey: ['sales-report', selectedBranch?.id, filters], queryFn: () => apiClient.getSalesReport(selectedBranch!.id, filters), enabled: !!selectedBranch && valid });
  const variants = useQuery({ queryKey: ['report-variants', selectedBranch?.id], queryFn: () => apiClient.getVariants(selectedBranch!.id), enabled: !!detailId && !!selectedBranch });
  const detail = useQuery({ queryKey: ['sale-detail', detailId], queryFn: () => apiClient.getSaleDetail(detailId!), enabled: !!detailId });
  useEffect(() => { setPage(0); setDetailId(null); }, [selectedBranch?.id, from, to, docType, status, query]);
  const data = valid ? report.data : undefined;
  if (!selectedBranch) return <p className="p-8">Selecciona una sucursal.</p>;
  return <div className="p-6 lg:p-8 space-y-6"><header><h1 className="text-2xl font-bold">Reportes de ventas</h1><p className="text-muted-foreground">{selectedBranch.name} · Fechas en horario de Chile</p></header>
    <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-3"><Filter label="Desde"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Filter><Filter label="Hasta"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Filter><Filter label="Buscar folio, cliente o RUT"><Input data-search-focus placeholder="Buscar · F1" value={query} onChange={e => setQuery(e.target.value)} /></Filter>
      <Filter label="Tipo de documento"><select className={selectClass} value={docType} onChange={e => setDocType(e.target.value)}><option value="">Todos</option>{Object.entries(types).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Filter>
      <Filter label="Estado"><select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option>{Object.entries(statuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Filter>
      <div className="flex flex-wrap gap-2 items-end"><Button variant="outline" onClick={() => { setFrom(localDay()); setTo(localDay()); }}>Hoy</Button><Button variant="outline" onClick={() => { setFrom(`${localDay().slice(0, 7)}-01`); setTo(localDay()); }}>Este mes</Button><Button variant="ghost" onClick={() => { setQuery(''); setDocType(''); setStatus(''); }}>Limpiar búsqueda</Button></div>
    </CardContent></Card>
    {!valid && <p role="alert" className="text-destructive">Selecciona un rango válido de hasta 366 días.</p>}
    {report.isFetching && <p role="status">Cargando reporte…</p>}
    {report.isError && <p role="alert" className="text-destructive">{report.error.message} <Button variant="outline" onClick={() => report.refetch()}>Reintentar</Button></p>}
    {data && <><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[
      ['Ventas emitidas', formatCurrency(data.grossSales)], ['Devoluciones', formatCurrency(data.refunds)], ['Ventas menos devoluciones', formatCurrency(data.netSales)], ['Ticket promedio de ventas', formatCurrency(data.transactions ? data.grossSales / data.transactions : 0)],
    ].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-2">{value}</p></CardContent></Card>)}</div>
    <p className="text-sm text-muted-foreground">{data.transactions} ventas emitidas. Los totales incluyen IVA, descuentan notas de crédito y excluyen pendientes, rechazados y anulados. Todos los filtros se aplican también a los totales.</p>
    <Card><CardContent className="pt-5"><h2 className="font-semibold mb-4">Cobros menos devoluciones por medio de pago</h2><div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{Object.entries(methods).map(([key, label]) => <div key={key}><p className="text-sm text-muted-foreground">{label}</p><p className="font-semibold">{formatCurrency(data.byPaymentMethod[key as keyof typeof methods])}</p></div>)}</div></CardContent></Card>
    <div className="flex justify-between items-center"><h2 className="font-semibold">Documentos del período</h2><Button variant="outline" disabled={!data.documents.length} onClick={() => exportCsv('ventas.csv', [['Fecha Chile', 'Folio', 'Tipo', 'Estado', 'Neto', 'IVA', 'Total'], ...data.documents.map(d => [localDay(d.createdAt), d.folio, types[d.docType], statuses[d.status], d.subtotal, d.tax, d.total])])}>Exportar resultados</Button></div>
    <div className="border rounded-lg overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Fecha', 'Folio', 'Documento', 'Estado', 'Total', 'Detalle'].map(h => <th className="p-3 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{data.documents.slice(page * 25, (page + 1) * 25).map(d => <tr key={d.id} className="border-t"><td className="p-3">{localDay(d.createdAt)}</td><td className="p-3">{d.folio ?? 'Sin folio'}</td><td className="p-3">{types[d.docType]}</td><td className="p-3">{statuses[d.status]}</td><td className="p-3">{formatCurrency(d.total)}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setDetailId(d.id)} aria-label={`Ver ${types[d.docType]} ${d.folio}`}>Ver detalle</Button></td></tr>)}{!data.documents.length && <tr><td className="p-8 text-center" colSpan={6}>No hay documentos para estos filtros.</td></tr>}</tbody></table></div><Pager page={page} count={data.documents.length} onChange={setPage} /></>}
    <Dialog open={!!detailId} onOpenChange={open => !open && setDetailId(null)}><DialogContent className="max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>Detalle de venta {detail.data?.document.folio}</DialogTitle><DialogDescription>Productos y pagos del documento seleccionado</DialogDescription></DialogHeader>{detail.isPending ? <p>Cargando…</p> : detail.isError ? <p role="alert">No se pudo cargar el documento.</p> : <><ul className="space-y-3">{detail.data?.lines.map(l => <li key={l.id} className="border-b pb-2">{(() => { const v = variants.data?.find(v => v.id === l.variantId); return v ? `${v.product.name} · ${v.name}` : `Variante ${l.variantId}`; })()}<p>{l.quantity} × {formatCurrency(l.unitPrice)} = {formatCurrency(l.subtotal)}</p></li>)}</ul>{detail.data?.payments.map(p => <p key={p.id}>{methods[p.method]}: {formatCurrency(p.amount)}</p>)}</>}</DialogContent></Dialog>
  </div>;
}
