import { Button } from './button';

export const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>;
}
export function Pager({ page, count, size = 25, onChange }: { page: number; count: number; size?: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / size));
  return <div className="flex items-center justify-between gap-4 py-3 text-sm">
    <span role="status">{count} resultados · Página {page + 1} de {pages}</span>
    <div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => onChange(page - 1)}>Anterior</Button>
      <Button variant="outline" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>Siguiente</Button></div>
  </div>;
}
export function exportCsv(name: string, rows: (string | number | undefined)[][]) {
  const csv = rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const localDay = (value: string | Date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));
