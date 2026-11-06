import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/api";
import type { Receipt } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils/format";
import { Button } from "@/components/ui/button";

const DOC_LABEL = { BOLETA: "Boleta", FACTURA: "Factura", CREDIT_NOTE: "Nota de crédito" } as const;
const METHOD_LABEL = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", CHECK: "Cheque", OTHER: "Otro" } as const;
const STATUS_NOTE = { VOID_INTERNAL: "ANULADA", PENDING_ISSUE: "PENDIENTE", REJECTED: "RECHAZADA", ISSUED: "" } as const;
const qty = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const WIDTH_PREF = "receipt_width";

/** Texto plano del comprobante, para WhatsApp o correo. */
function receiptText(r: Receipt): string {
  const d = r.document;
  const lines = [
    r.company.name, `RUT ${r.company.rut}`, r.branch.name, "",
    `${DOC_LABEL[d.docType]} ${d.folio ? `N° ${d.folio}` : ""}`.trim(), formatDateTime(d.createdAt), "",
    ...r.lines.map((l) => `${qty.format(l.quantity)} x ${l.name}  ${formatCurrency(l.subtotal)}`), "",
    `Neto ${formatCurrency(d.subtotal)}`, `IVA ${formatCurrency(d.tax)}`, `TOTAL ${formatCurrency(d.total)}`, "",
    "Comprobante interno, no válido como documento tributario.",
  ];
  return lines.join("\n");
}

/**
 * Comprobante imprimible (impresora térmica 58/80 mm o "Guardar como PDF") y
 * compartible. Va fuera del menú para que la impresión salga limpia.
 */
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [width, setWidth] = useState<"58" | "80">(() => {
    try { return localStorage.getItem(WIDTH_PREF) === "58" ? "58" : "80"; } catch { return "80"; }
  });
  useEffect(() => { try { localStorage.setItem(WIDTH_PREF, width); } catch { /* sin almacenamiento */ } }, [width]);
  const receipt = useQuery({ queryKey: ["receipt", id], queryFn: () => apiClient.getReceipt(id!), enabled: !!id });
  const r = receipt.data;

  useEffect(() => {
    if (r) document.title = `${DOC_LABEL[r.document.docType]} ${r.document.folio ?? ""} · Retail Flow`;
    return () => { document.title = "Retail Flow · Punto de venta"; };
  }, [r]);

  const share = async () => {
    if (!r) return;
    const text = receiptText(r);
    try {
      if (navigator.share) { await navigator.share({ title: `${DOC_LABEL[r.document.docType]} ${r.document.folio ?? ""}`, text }); return; }
      await navigator.clipboard.writeText(text);
      toast.success("Comprobante copiado. Pégalo en WhatsApp o en un correo.");
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") toast.error("No se pudo compartir");
    }
  };

  const paid = r?.payments.reduce((n, p) => n + p.amount, 0) ?? 0;
  const change = r ? Math.max(0, paid - r.document.total) : 0;

  return (
    <div className="min-h-dvh bg-muted print:bg-white">
      <style>{`@media print { @page { size: ${width}mm auto; margin: 3mm; } }`}</style>
      <div className="print:hidden sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button asChild variant="ghost" size="sm"><Link to="/pos/ventas"><ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />Ventas</Link></Button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="paper">Papel</label>
          <select id="paper" className="h-9 rounded-md border bg-background px-2 text-sm" value={width} onChange={(e) => setWidth(e.target.value as "58" | "80")}>
            <option value="80">80 mm</option><option value="58">58 mm</option>
          </select>
          <Button variant="outline" size="sm" onClick={share} disabled={!r}><Share2 className="h-4 w-4 sm:mr-1" aria-hidden="true" /><span className="hidden sm:inline">Compartir</span></Button>
          <Button size="sm" onClick={() => window.print()} disabled={!r}><Printer className="h-4 w-4 mr-1" aria-hidden="true" />Imprimir</Button>
        </div>
      </div>

      {receipt.isPending && <p role="status" className="p-6 text-center text-muted-foreground">Cargando comprobante…</p>}
      {receipt.isError && <p role="alert" className="p-6 text-center text-destructive">{receipt.error.message}</p>}

      {r && (
        <article
          className="mx-auto my-4 print:my-0 bg-white text-black shadow print:shadow-none px-3 py-4 print:p-0 font-mono text-[12px] leading-snug"
          style={{ width: `${width}mm`, maxWidth: "100%" }}
          aria-label="Comprobante de venta"
        >
          <header className="text-center space-y-0.5">
            <p className="font-bold text-[14px] uppercase break-words">{r.company.name}</p>
            <p>RUT {r.company.rut}</p>
            <p className="break-words">{r.branch.name}</p>
            {r.branch.address && r.branch.address !== "Sin dirección" && <p className="break-words">{r.branch.address}</p>}
          </header>
          <hr className="my-2 border-dashed border-black" />
          <p className="text-center font-bold uppercase">
            {DOC_LABEL[r.document.docType]}{r.document.folio ? ` N° ${r.document.folio}` : ""}
            {STATUS_NOTE[r.document.status] && ` · ${STATUS_NOTE[r.document.status]}`}
          </p>
          <p className="text-center">{formatDateTime(r.document.createdAt)}</p>
          {(r.registerName || r.cashierName) && <p className="text-center">{[r.registerName, r.cashierName].filter(Boolean).join(" · ")}</p>}
          {r.customer && <p className="text-center break-words">Cliente: {r.customer.name} · {r.customer.rut}</p>}
          <hr className="my-2 border-dashed border-black" />
          <ul className="space-y-1.5">
            {r.lines.map((l, i) => (
              <li key={i}>
                <p className="break-words">{l.name}</p>
                <p className="flex justify-between gap-2 tabular-nums">
                  <span>{qty.format(l.quantity)} x {formatCurrency(l.unitPrice)}{l.priceSource === "WHOLESALE" ? " (may.)" : ""}</span>
                  <span>{formatCurrency(l.subtotal)}</span>
                </p>
              </li>
            ))}
          </ul>
          <hr className="my-2 border-dashed border-black" />
          <div className="space-y-0.5 tabular-nums">
            <p className="flex justify-between"><span>Neto</span><span>{formatCurrency(r.document.subtotal)}</span></p>
            <p className="flex justify-between"><span>IVA 19%</span><span>{formatCurrency(r.document.tax)}</span></p>
            <p className="flex justify-between font-bold text-[14px]"><span>TOTAL</span><span>{formatCurrency(r.document.total)}</span></p>
          </div>
          {r.payments.length > 0 && <>
            <hr className="my-2 border-dashed border-black" />
            <div className="space-y-0.5 tabular-nums">
              {r.payments.map((p) => <p key={p.id} className="flex justify-between"><span>{METHOD_LABEL[p.method]}</span><span>{formatCurrency(p.amount)}</span></p>)}
              {change > 0 && <p className="flex justify-between"><span>Vuelto</span><span>{formatCurrency(change)}</span></p>}
            </div>
          </>}
          <hr className="my-2 border-dashed border-black" />
          <p className="text-center text-[11px]">Comprobante interno. No válido como documento tributario electrónico.</p>
          <p className="text-center mt-1">¡Gracias por su compra!</p>
        </article>
      )}
    </div>
  );
}
