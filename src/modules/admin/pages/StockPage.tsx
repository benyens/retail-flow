import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import { Stock, VariantWithProduct } from "@/types";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, Search, SlidersHorizontal } from "lucide-react";

interface StockRow { variantId: string; sku: string; productName: string; attributesLabel: string; quantity: number; }

export default function StockPage() {
  const { selectedBranch } = useApp();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<StockRow | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    if (!selectedBranch) return;
    setIsLoading(true);
    try {
      const [stocks, variants] = await Promise.all([apiClient.getStock(selectedBranch.id), apiClient.getVariants(selectedBranch.id)]);
      const merged: StockRow[] = variants.map((v) => {
        const stock = stocks.find((s: Stock) => s.variantId === v.id);
        return { variantId: v.id, sku: v.sku, productName: v.product.name, attributesLabel: Object.values(v.attributes).join(" · "), quantity: stock?.quantity ?? 0 };
      });
      merged.sort((a, b) => a.productName.localeCompare(b.productName));
      setRows(merged);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar el stock");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.productName.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  }, [rows, search]);

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

  if (!selectedBranch) return <div className="p-8 text-muted-foreground">Selecciona una sucursal para ver el stock.</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="h-6 w-6" />Stock</h1>
        <p className="text-muted-foreground">{selectedBranch.name}</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por producto o SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Producto</TableHead><TableHead>Variante</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="w-24" /></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>}
              {!isLoading && filteredRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>}
              {filteredRows.map((row) => (
                <TableRow key={row.variantId}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.attributesLabel}</TableCell>
                  <TableCell className="text-muted-foreground">{row.sku}</TableCell>
                  <TableCell className={`text-right font-semibold ${row.quantity <= 0 ? "text-destructive" : ""}`}>{row.quantity}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => setAdjustTarget(row)}><SlidersHorizontal className="h-4 w-4 mr-1" />Ajustar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!adjustTarget} onOpenChange={(open) => !open && setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>{adjustTarget?.productName} {adjustTarget?.attributesLabel} — stock actual: {adjustTarget?.quantity}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="adjust-qty">Cantidad (positiva suma, negativa resta)</Label>
              <Input id="adjust-qty" type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="ej: -2 (merma) o 10 (conteo físico)" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjust-notes">Motivo</Label>
              <Input id="adjust-notes" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} placeholder="ej: Merma por rotura, conteo físico mensual…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSubmitAdjustment} disabled={isSubmitting}>{isSubmitting ? "Aplicando…" : "Aplicar ajuste"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
