import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import type { Stock } from "@/types";
import { isLowStock } from "@/utils/stock";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, Search, SlidersHorizontal, BellRing } from "lucide-react";
import BarcodeScanButton from "@/components/BarcodeScanButton";

interface StockRow {
  variantId: string; sku: string; barcode?: string; productName: string; variantLabel: string;
  quantity: number; minQuantity: number | null;
}
type View = "todos" | "reponer" | "sin-stock";

const fmtQty = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });

function StatusBadge({ row }: { row: StockRow }) {
  if (row.quantity <= 0) return <Badge variant="destructive">Sin stock</Badge>;
  if (isLowStock(row)) return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Por reponer</Badge>;
  return null;
}

export default function StockPage() {
  const { selectedBranch } = useApp();
  const [params, setParams] = useSearchParams();
  const view = (["reponer", "sin-stock"].includes(params.get("filtro") ?? "") ? params.get("filtro") : "todos") as View;
  const setView = (v: View) => setParams(v === "todos" ? {} : { filtro: v }, { replace: true });
  const [rows, setRows] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<StockRow | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [minTarget, setMinTarget] = useState<StockRow | null>(null);
  const [minValue, setMinValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    if (!selectedBranch) return;
    setIsLoading(true);
    try {
      const [stocks, variants] = await Promise.all([apiClient.getStock(selectedBranch.id), apiClient.getVariants(selectedBranch.id, { assortment: true })]);
      const byVariant = new Map(stocks.map((s: Stock) => [s.variantId, s]));
      const merged: StockRow[] = variants.map((v) => {
        const stock = byVariant.get(v.id);
        const attrs = Object.values(v.attributes).join(" · ");
        return {
          variantId: v.id, sku: v.sku, barcode: v.barcode, productName: v.product.name,
          variantLabel: attrs || (v.name !== "Única" ? v.name : ""),
          quantity: stock?.quantity ?? 0, minQuantity: stock?.minQuantity ?? null,
        };
      });
      merged.sort((a, b) => a.productName.localeCompare(b.productName, "es"));
      setRows(merged);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar el stock");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    reponer: rows.filter(isLowStock).length,
    sinStock: rows.filter((r) => r.quantity <= 0).length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (view === "todos" || (view === "reponer" ? isLowStock(r) : r.quantity <= 0)) &&
      (!q || r.productName.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.barcode === search.trim()));
  }, [rows, search, view]);

  async function handleSubmitAdjustment() {
    if (!selectedBranch || !adjustTarget) return;
    const qty = Number(adjustQty);
    if (!qty || Number.isNaN(qty)) { toast.error("Ingresa una cantidad válida (positiva o negativa)"); return; }
    if (!adjustNotes.trim()) { toast.error("El motivo del ajuste es obligatorio"); return; }
    setIsSubmitting(true);
    try {
      await apiClient.createAdjustment(selectedBranch.id, adjustTarget.variantId, qty, adjustNotes.trim());
      toast.success("Ajuste aplicado");
      setAdjustTarget(null); setAdjustQty(""); setAdjustNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar el ajuste");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveMinimum(value: number | null) {
    if (!selectedBranch || !minTarget) return;
    if (value !== null && (!Number.isFinite(value) || value < 0)) { toast.error("El mínimo debe ser 0 o mayor"); return; }
    setIsSubmitting(true);
    try {
      await apiClient.setMinStock(selectedBranch.id, minTarget.variantId, value);
      toast.success(value === null ? "Alerta de stock quitada" : `Avisaremos cuando queden ${fmtQty.format(value)} o menos`);
      setMinTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el mínimo");
    } finally {
      setIsSubmitting(false);
    }
  }

  const openMin = (row: StockRow) => { setMinTarget(row); setMinValue(row.minQuantity == null ? "" : String(row.minQuantity)); };

  if (!selectedBranch) return <div className="p-8 text-muted-foreground">Selecciona una sucursal para ver el stock.</div>;

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "todos", label: "Todos" },
    { id: "reponer", label: "Por reponer", count: counts.reponer },
    { id: "sin-stock", label: "Sin stock", count: counts.sinStock },
  ];

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="h-6 w-6" aria-hidden="true" />Stock</h1>
        <p className="text-muted-foreground">{selectedBranch.name}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input type="search" aria-label="Buscar producto" placeholder="Buscar por producto, SKU o código…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-8" autoComplete="off" spellCheck={false} />
        </div>
        <BarcodeScanButton onDetected={(code) => setSearch(code)} />
      </div>

      <div role="tablist" aria-label="Filtrar stock" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.id} role="tab" aria-selected={view === t.id} size="sm"
            variant={view === t.id ? "default" : "outline"} onClick={() => setView(t.id)}>
            {t.label}{t.count !== undefined && <span className="ml-1.5 tabular-nums">({t.count})</span>}
          </Button>
        ))}
      </div>

      {view === "reponer" && !isLoading && counts.reponer === 0 && (
        <p className="text-sm text-muted-foreground">
          Nada por reponer. Para recibir avisos, define un <strong>mínimo</strong> en los productos que no pueden faltar.
        </p>
      )}

      {/* Celular: tarjetas */}
      <div className="md:hidden space-y-2">
        {isLoading && <p role="status" className="text-center text-muted-foreground py-8">Cargando…</p>}
        {!isLoading && filteredRows.length === 0 && <p className="text-center text-muted-foreground py-8">Sin resultados.</p>}
        {filteredRows.map((row) => (
          <Card key={row.variantId}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{row.productName}</p>
                  {row.variantLabel && <p className="text-sm text-muted-foreground">{row.variantLabel}</p>}
                  <p className="text-xs text-muted-foreground font-mono truncate">{row.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-2xl font-semibold tabular-nums leading-none", row.quantity <= 0 && "text-destructive")}>{fmtQty.format(row.quantity)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{row.minQuantity == null ? "Sin mínimo" : `Mín. ${fmtQty.format(row.minQuantity)}`}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusBadge row={row} />
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" className="h-9" onClick={() => openMin(row)}>
                    <BellRing className="h-4 w-4 mr-1" aria-hidden="true" />Mínimo
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setAdjustTarget(row)}>
                    <SlidersHorizontal className="h-4 w-4 mr-1" aria-hidden="true" />Ajustar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Escritorio: tabla */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead><TableHead>Variante</TableHead><TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mínimo</TableHead>
                <TableHead>Estado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>}
              {!isLoading && filteredRows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>}
              {filteredRows.map((row) => (
                <TableRow key={row.variantId}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.variantLabel}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{row.sku}</TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", row.quantity <= 0 && "text-destructive")}>{fmtQty.format(row.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{row.minQuantity == null ? "—" : fmtQty.format(row.minQuantity)}</TableCell>
                  <TableCell><StatusBadge row={row} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openMin(row)} aria-label={`Stock mínimo de ${row.productName}`}>
                      <BellRing className="h-4 w-4 mr-1" aria-hidden="true" />Mínimo
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAdjustTarget(row)} aria-label={`Ajustar stock de ${row.productName}`}>
                      <SlidersHorizontal className="h-4 w-4 mr-1" aria-hidden="true" />Ajustar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!adjustTarget} onOpenChange={(open) => !open && setAdjustTarget(null)}>
        <DialogContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmitAdjustment(); }}>
            <DialogHeader>
              <DialogTitle>Ajustar stock</DialogTitle>
              <DialogDescription>{adjustTarget?.productName} {adjustTarget?.variantLabel} — stock actual: {adjustTarget ? fmtQty.format(adjustTarget.quantity) : ""}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="adjust-qty">Cantidad (positiva suma, negativa resta)</Label>
              <Input id="adjust-qty" type="number" inputMode="decimal" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="ej: -2 (merma) o 10 (conteo físico)" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjust-notes">Motivo</Label>
              <Input id="adjust-notes" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} placeholder="ej: Merma por rotura, conteo físico mensual…" />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setAdjustTarget(null)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Aplicando…" : "Aplicar ajuste"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!minTarget} onOpenChange={(open) => !open && setMinTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveMinimum(minValue.trim() === "" ? null : Number(minValue)); }}>
            <DialogHeader>
              <DialogTitle>Stock mínimo</DialogTitle>
              <DialogDescription>
                {minTarget?.productName} {minTarget?.variantLabel}: se marcará <strong>por reponer</strong> cuando queden esta cantidad o menos en {selectedBranch.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="min-qty">Mínimo</Label>
              <Input id="min-qty" type="number" inputMode="decimal" min={0} step="any" value={minValue}
                onChange={(e) => setMinValue(e.target.value)} placeholder="Vacío = sin alerta" autoFocus />
              <p className="text-xs text-muted-foreground">Stock actual: {minTarget ? fmtQty.format(minTarget.quantity) : ""}</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              {minTarget?.minQuantity != null && (
                <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => saveMinimum(null)} disabled={isSubmitting}>Quitar alerta</Button>
              )}
              <Button type="button" variant="outline" onClick={() => setMinTarget(null)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
